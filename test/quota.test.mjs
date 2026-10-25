import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { extractModels, normalizeModel, toConfigModel, toProviderModel } from "../models.mjs";
import {
  accountNameOf,
  codeFromPaste,
  compact,
  consoleLoginUrl,
  ensureToken,
  fmtNum,
  isExpired,
  loginWithCode,
  parseJwt,
  readCredentials,
  toQuota,
  QuotaError,
  writeCredentials,
} from "../quota.mjs";

/** 造一个解码得动的 JWT：只需要中间那段载荷是真的。 */
const jwt = (payload) => `x.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.y`;

/** 与控制台截图一致的样例数据。 */
const POOLS = [
  {
    id: "pool-general",
    name: "通用积分池",
    pool_type: "default",
    window_7d: { remaining: "591017.32584", limit: "600000", reset_at: 1792000200 },
    window_5h: { remaining: "60000", limit: "60000", reset_at: 1791983400 },
    grant_balance: "1292155358",
    nearest_grant_expiry: 1791907200,
    nearest_grant_expiring_balance: "7972.0004",
  },
  {
    id: "pool-flashlite",
    name: "Flash-Lite 专属积分池",
    pool_type: "dedicated",
    window_7d: { remaining: "408308.3972", limit: "600000", reset_at: 1792000200 },
    window_5h: { remaining: "52792.9776", limit: "60000", reset_at: 1791983400 },
  },
];

test("toQuota 把两个池映射成四个窗口", () => {
  const { windows } = toQuota(POOLS);
  assert.equal(windows.length, 4);
  assert.deepEqual(
    windows.map((w) => w.name),
    [
      "通用积分池 · 5 小时窗口 / General Pool · 5h window",
      "通用积分池 · 本周 / General Pool · This week",
      "Flash-Lite 专属积分池 · 5 小时窗口 / Flash-Lite Dedicated Pool · 5h window",
      "Flash-Lite 专属积分池 · 本周 / Flash-Lite Dedicated Pool · This week",
    ]
  );
});

test("toQuota 的 used 是已用百分比", () => {
  const { windows } = toQuota(POOLS);
  const [general5h, general7d, flash5h, flash7d] = windows;
  assert.equal(general5h.used, 0, "5h 窗口用满但额度未动，已用应为 0");
  assert.equal(general7d.used, 1.4971, "本周已用 (600000-591017.32584)/600000");
  assert.equal(flash5h.used, 12.0117);
  assert.equal(flash7d.used, 31.9486);
});

test("toQuota 的 limit / span / resetsAt 取自窗口", () => {
  const { windows } = toQuota(POOLS);
  assert.equal(windows[0].limit, 60000);
  assert.equal(windows[0].span, 18000);
  assert.equal(windows[0].resetsAt, 1791983400);
  assert.equal(windows[1].span, 604800);
  assert.equal(windows[1].unit, "积分 / credits");
});

test("专属池的窗口限定到 Flash-Lite 模型", () => {
  const { windows } = toQuota(POOLS);
  assert.equal(windows[0].model, undefined, "通用池不该限定模型");
  assert.equal(windows[2].model, "flash-lite");
  assert.equal(windows[3].model, "flash-lite");
});

test("有 model_ids 时用服务器声明的模型清单，而不是按名字猜", () => {
  const { windows } = toQuota({
    plan: { id: "free", name: "Free Plan", type: "TOKEN_PLAN_PLAN_TYPE_FREE" },
    pools: [
      {
        name: "Flash-Lite积分池",
        pool_type: "dedicated",
        model_ids: ["sensenova-6.7-flash-lite", "sensenova-6.8-flash-lite"],
        window_5h: { remaining: "60000", limit: "60000", reset_at: 1791983400 },
        window_7d: { remaining: "600000", limit: "600000", reset_at: 1792000200 },
      },
    ],
  });
  assert.deepEqual(windows[0].models, ["sensenova-6.7-flash-lite", "sensenova-6.8-flash-lite"]);
  assert.equal(windows[0].model, undefined, "有精确清单时不再用关键词匹配");
});

test("plan 取自接口，而不是写死", () => {
  const withPlan = toQuota({ plan: { name: "Free Plan" }, pools: POOLS });
  assert.equal(withPlan.plan, "Free Plan");
  const noPlan = toQuota({ pools: POOLS });
  assert.equal(noPlan.plan, undefined, "接口没给套餐名时不该编一个");
  assert.equal(toQuota(POOLS).plan, undefined, "裸数组入参同样没有套餐名");
});

test("活动固定积分余额作为 balance 上报，且只取通用池", () => {
  const { balance } = toQuota(POOLS);
  assert.equal(balance, "1,292,155,358 积分 / credits");
});

test("amount 是已用数量，limit - amount 还原出控制台的「本周余额」", () => {
  const { windows } = toQuota(POOLS);
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
  // 没有 amount 的话界面会显示成「0 / 600,000」，和真实余额对不上。
  near(windows[0].amount, 0);
  near(windows[1].amount, 8982.67416);
  near(windows[2].amount, 7207.0224);
  near(windows[3].amount, 191691.6028);
  // 剩余量必须能由 limit - amount 反推回控制台显示的余额
  near(windows[1].limit - windows[1].amount, 591017.32584);
  near(windows[3].limit - windows[3].amount, 408308.3972);
});

test("display 用 Magpie 自己的紧凑写法，和其它供应商并排不突兀", () => {
  const { windows } = toQuota(POOLS);
  assert.equal(windows[0].display, "0 / 60000");
  assert.equal(windows[1].display, "8982.67 / 600000");
  assert.equal(windows[2].display, "7207.02 / 60000");
});

test("compact 整数给整数，否则两位小数且不留尾零", () => {
  assert.equal(compact(4650), "4650");
  assert.equal(compact(0), "0");
  assert.equal(compact(8982.67416), "8982.67");
  assert.equal(compact(7207.0224), "7207.02");
  assert.equal(compact(100.5), "100.5");
});

test("额度字段缺失时不崩，也不编造窗口", () => {
  const { windows, balance } = toQuota([{ pool_type: "default", window_5h: { remaining: "1", limit: "0" } }]);
  assert.deepEqual(windows, [], "limit 为 0 的窗口应被跳过");
  assert.equal(balance, undefined);
  assert.deepEqual(toQuota(null).windows, []);
});

test("fmtNum 千分位 + 最多 6 位小数", () => {
  assert.equal(fmtNum("591017.32584"), "591,017.32584");
  assert.equal(fmtNum(60000), "60,000");
  assert.equal(fmtNum(undefined), "—");
});

test("parseJwt 解析 exp，非 JWT 返回 null", () => {
  const token = `x.${Buffer.from(JSON.stringify({ exp: 1800000000 })).toString("base64url")}.y`;
  assert.equal(parseJwt(token).exp, 1800000000);
  assert.equal(parseJwt("opaque-token"), null);
});

test("isExpired 用 expires_at 或 JWT exp 判断，并留 60 秒余量", () => {
  const now = 1_800_000_000_000;
  assert.equal(isExpired({ access_token: "x", expires_at: now / 1000 + 3600 }, now), false);
  assert.equal(isExpired({ access_token: "x", expires_at: now / 1000 + 30 }, now), true);
  assert.equal(isExpired({ access_token: "opaque" }, now), false, "无法判断时应先试一次");
});

test("ensureToken 在 token 有效时不发请求", async () => {
  let calls = 0;
  const cfg = { access_token: "good", expires_at: Math.floor(Date.now() / 1000) + 3600 };
  const changed = await ensureToken(cfg, { fetchImpl: async () => (calls++, new Response("{}")) });
  assert.equal(changed, false);
  assert.equal(calls, 0);
});

test("ensureToken 过期时用 refresh_token 续期", async () => {
  const cfg = { access_token: "stale", refresh_token: "rt", expires_at: 1 };
  const changed = await ensureToken(cfg, {
    fetchImpl: async (url, init) => {
      assert.match(String(url), /\/oauth2\/token$/);
      assert.match(String(init.body), /grant_type=refresh_token/);
      return new Response(JSON.stringify({ access_token: "fresh", refresh_token: "rt2", expires_in: 3600 }));
    },
  });
  assert.equal(changed, true);
  assert.equal(cfg.access_token, "fresh");
  assert.equal(cfg.refresh_token, "rt2");
});

test("ensureToken 在没有凭据时抛出可读错误", async () => {
  await assert.rejects(
    () => ensureToken({ access_token: "stale", expires_at: 1 }, { fetchImpl: async () => new Response("{}") }),
    (e) => e instanceof QuotaError && /snquota login/.test(e.message)
  );
});

test("normalizeModel 容忍 OpenAI 与裸数组两种信封", () => {
  const rows = extractModels({ data: [{ id: "a" }, { model_id: "b", context_length: 200000 }] });
  assert.deepEqual(rows.map((m) => m.id), ["a", "b"]);
  assert.equal(rows[1].contextLength, 200000);
  assert.deepEqual(extractModels([{ id: "c" }]).map((m) => m.id), ["c"]);
  assert.deepEqual(extractModels({ models: [{ id: "d" }] }).map((m) => m.id), ["d"]);
  assert.deepEqual(extractModels({ nope: 1 }), []);
});

test("normalizeModel 给未知模型兜底，没有 id 的条目被丢掉", () => {
  const m = normalizeModel({ id: "brand-new" });
  assert.equal(m.name, "brand-new");
  assert.equal(m.supportsTools, true);
  assert.equal(normalizeModel({ name: "无 id" }), null);
});

test("toConfigModel / toProviderModel 形状符合 Magpie 约定", () => {
  const m = normalizeModel({ id: "sensenova-6.8-flash-lite" });
  const cfgModel = toConfigModel(m);
  assert.deepEqual(Object.keys(cfgModel).sort(), [
    "attachment",
    "limit",
    "modalities",
    "name",
    "reasoning",
    "tool_call",
  ]);
  assert.equal(cfgModel.attachment, true, "Flash-Lite 支持图片输入");

  const provModel = toProviderModel(m, "sensenova");
  assert.equal(provModel.id, "sensenova-6.8-flash-lite");
  assert.equal(provModel.providerID, "sensenova");
  assert.equal(provModel.api.npm, "@ai-sdk/openai-compatible");
  assert.equal(provModel.api.url, "https://token.sensenova.cn/v1");
  assert.equal(provModel.capabilities.input.image, true);
  assert.equal(provModel.status, "active");
});

test("remaining 缺失时跳过窗口，而不是编造一个 0 已用", () => {
  const { windows } = toQuota([
    {
      pool_type: "default",
      // limit 有、remaining 没有：用量无从得知，不能当成 0
      window_5h: { limit: "60000" },
      window_7d: { remaining: "500000", limit: "600000" },
    },
  ]);
  assert.equal(windows.length, 1, "只有能算出用量的窗口才上报");
  assert.equal(windows[0].name, "通用积分池 · 本周 / General Pool · This week");
  assert.equal(windows[0].amount, 100000);
});

test("writeCredentials 不把 __ 开头的内部字段写进文件", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "snquota-")), "cfg.json");
  // index.mjs 交给 writeCredentials 的就是这个形状：内部标记和真实凭据混在一起。
  writeCredentials(
    {
      access_token: "at",
      refresh_token: "rt",
      username: "u",
      __writable: true,
      __file: undefined,
      __transient: true,
      __persist: true,
      __save_password: true,
      __path: "x",
    },
    file
  );
  const back = readCredentials(file);
  assert.deepEqual(Object.keys(back).sort(), ["access_token", "refresh_token", "saved_at", "username"]);
  assert.equal("__writable" in back, false, "内部标记泄漏会让 CLI 的文件多出无意义字段");
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
});

test("窗口名里的中英两半各自成句，不出现交叉拼接", () => {
  const { windows } = toQuota(POOLS);
  for (const w of windows) {
    const [zh, en] = w.name.split(" / ");
    assert.ok(zh.includes("积分池"), `${w.name} 的中文半截丢了池名`);
    assert.ok(en.includes("Pool"), `${w.name} 的英文半截丢了池名`);
  }
  // 回归：曾经把「通用积分池」与英文窗口名拼成「通用积分池 · 5h window」这种半中半英。
  assert.equal(windows[0].name.includes("5h window"), true, "英文半截应带英文窗口名");
});

test("accountNameOf 从 access_token.ext.username 取账号名", () => {
  const cfg = { access_token: jwt({ ext: { username: "Ada" } }) };
  assert.equal(accountNameOf(cfg), "Ada");
});

test("accountNameOf 退回 id_token 里那个嵌套的 username", () => {
  const cfg = { id_token: jwt({ id_token: { username: "Ada" } }) };
  assert.equal(accountNameOf(cfg), "Ada");
});

test("accountNameOf 优先用 access_token 里的，并去空白", () => {
  const cfg = {
    access_token: jwt({ ext: { username: "  Ada  " } }),
    id_token: jwt({ id_token: { username: "Someone Else" } }),
  };
  assert.equal(accountNameOf(cfg), "Ada");
});

test("accountNameOf 取不到时返回 undefined，不编一个", () => {
  // 只填了 API Key 的账号就是这种情形：Magpie 会退回显示 API Key 后缀。
  assert.equal(accountNameOf({}), undefined);
  assert.equal(accountNameOf({ access_token: "opaque-token" }), undefined, "不透明 token 不该崩");
  assert.equal(accountNameOf({ access_token: jwt({ ext: {} }) }), undefined);
  assert.equal(accountNameOf({ access_token: jwt({ ext: { username: "   " } }) }), undefined);
  assert.equal(accountNameOf(undefined), undefined);
});

/* ------------------------------------------------- 一键登录：粘回调 / 粘 cookie */

test("consoleLoginUrl 指向控制台授权端点，回调是控制台自己", () => {
  const url = new URL(consoleLoginUrl({}));
  assert.equal(url.origin, "https://platform.sensenova.cn");
  assert.equal(url.pathname, "/oauth2/auth");
  assert.equal(url.searchParams.get("client_id"), "nova");
  assert.equal(url.searchParams.get("redirect_uri"), "https://platform.sensenova.cn");
  // 不带 PKCE：粘回来的地址里没有 verifier 可对上。
  assert.equal(url.searchParams.get("code_challenge"), null);
  assert.ok((url.searchParams.get("state") ?? "").length >= 8);
});

test("codeFromPaste 认整条回调地址、裸 code，认不出来时返回 null", () => {
  assert.equal(codeFromPaste("https://platform.sensenova.cn/?code=abc123&state=xyz"), "abc123");
  assert.equal(codeFromPaste("  abc123def456  "), "abc123def456");
  assert.equal(codeFromPaste("https://platform.sensenova.cn/?error=access_denied"), null);
  assert.equal(codeFromPaste(""), null);
  assert.equal(codeFromPaste(undefined), null);
});

test("loginWithCode 用粘来的 code 换令牌，不带 code_verifier", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url: String(url), body: String(init?.body ?? "") });
    return new Response(
      JSON.stringify({ access_token: "at-1", refresh_token: "rt-1", expires_in: 3600 }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };
  const cfg = {};
  await loginWithCode(cfg, "https://platform.sensenova.cn/?code=good-code", { fetchImpl });
  assert.equal(seen.length, 1);
  assert.match(seen[0].url, /\/oauth2\/token$/);
  assert.match(seen[0].body, /code=good-code/);
  assert.match(seen[0].body, /grant_type=authorization_code/);
  assert.doesNotMatch(seen[0].body, /code_verifier/);
  assert.equal(cfg.access_token, "at-1");
  assert.equal(cfg.refresh_token, "rt-1");
  assert.ok(cfg.expires_at > Math.floor(Date.now() / 1000));
});

test("loginWithCode 认不出 code 时不发请求", async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  await assert.rejects(() => loginWithCode({}, "???", { fetchImpl }), QuotaError);
  assert.equal(called, false);
});

