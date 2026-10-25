import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SenseNovaPlugin } from "../index.mjs";
import { credentialSlotOf } from "../quota.mjs";

/**
 * Run one request through the plugin's `fetch` hook and report what the host's
 * `fetch` actually received. The hook re-reads the sign-in per request, so the
 * stub has to be in place before the call, not before the loader.
 */
async function through(key, input, init) {
  const plugin = await SenseNovaPlugin({}, {});
  const { fetch: wrapped } = await plugin.auth.loader(async () => ({ type: "api", key }));

  const real = globalThis.fetch;
  let seen = null;
  globalThis.fetch = async (a, b) => {
    const req = a instanceof Request ? a : null;
    const headers = req ? req.headers : new Headers(b?.headers);
    seen = {
      isRequest: req !== null,
      url: req ? req.url : a,
      method: req ? req.method : b?.method,
      authorization: headers.get("authorization"),
      trace: headers.get("x-trace"),
      body: req ? await req.text() : typeof b?.body === "string" ? b.body : undefined,
    };
    return new Response("{}", { status: 200 });
  };
  try {
    await wrapped(input, init);
  } finally {
    globalThis.fetch = real;
  }
  return seen;
}

const BODY = JSON.stringify({ messages: [{ role: "user", content: "hi" }] });
const URL_ = "https://token.sensenova.cn/v1/chat/completions";

test("(url, init) 调用：带上 authorization，body 原样透传", async () => {
  const seen = await through("sk-test", URL_, { method: "POST", body: BODY });
  assert.equal(seen.url, URL_);
  assert.equal(seen.method, "POST");
  assert.equal(seen.authorization, "Bearer sk-test");
  assert.equal(seen.body, BODY);
});

test("Request 调用：不能因为改头就把 body 丢掉", async () => {
  // 回归：早先的实现用 `request.url` 重新发起，{...init} 在没有 init 时是空对象，
  // 于是 POST 的 body 静默消失，只剩一个空请求。
  const seen = await through("sk-test", new Request(URL_, { method: "POST", body: BODY }));
  assert.equal(seen.url, URL_);
  assert.equal(seen.method, "POST", "method 必须保留");
  assert.equal(seen.authorization, "Bearer sk-test");
  assert.equal(seen.body, BODY, "body 必须保留");
});

test("Request 调用：保留原请求自己的头", async () => {
  // 断言的是发出去的头，不是转发形状——Request 和 (url, init) 两种形态都该成立。
  const seen = await through("sk-test", new Request(URL_, { method: "POST", body: BODY, headers: { "x-trace": "abc" } }));
  assert.equal(seen.trace, "abc");
  assert.equal(seen.authorization, "Bearer sk-test");
  assert.equal(seen.body, BODY);
});

test("没有 key 时删掉 authorization，而不是留着上一个账号的", async () => {
  const seen = await through(undefined, URL_, {
    method: "POST",
    body: BODY,
    headers: { authorization: "Bearer stale" },
  });
  assert.equal(seen.authorization, null);
  assert.equal(seen.body, BODY);
});

/** The pool-usage response, abbreviated to what the mapping reads. */
const POOL_USAGE = {
  plan: { name: "Free Plan" },
  pools: [
    {
      name: "通用积分池",
      pool_type: "default",
      window_5h: { remaining: "60000", limit: "60000", reset_at: 1791983400 },
      window_7d: { remaining: "591017.32584", limit: "600000", reset_at: 1792000200 },
      grant_balance: "1292155358",
    },
    {
      name: "Flash-Lite积分池",
      pool_type: "dedicated",
      model_ids: ["sensenova-6.8-flash-lite"],
      window_5h: { remaining: "40967.482", limit: "60000", reset_at: 1791983400 },
    },
  ],
};

/** A JWT whose payload decodes, just enough to carry a claim. */
const jwt = (payload) => `x.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.y`;

/**
 * Run the `usage` hook against a stubbed quota endpoint, with the credentials
 * file pointed at a temp path so the test never reads or writes the real one.
 */
async function usageWith(options, auth) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sensenova-"));
  const file = path.join(dir, "quota.json");
  // 令牌按账号分开存：槽位就是这行登录时填的账号名（没有名字时是 key 的指纹），
  // 与插件的取法一致，否则这一行会被当成「没有控制台凭据」。
  const meta = auth.metadata ?? {};
  const slot = credentialSlotOf({ name: meta.email ?? meta.username, key: "sk-test" });
  fs.writeFileSync(
    file,
    JSON.stringify({
      accounts: {
        [slot]: { base: "https://platform.sensenova.cn", access_token: auth.token, expires_at: 4102444800 },
      },
    })
  );

  const plugin = await SenseNovaPlugin({}, { ...options, credentialsFile: file });
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(POOL_USAGE), { status: 200 });
  try {
    return await plugin.auth.usage(async () => ({ type: "api", key: "sk-test", metadata: auth.metadata }));
  } finally {
    globalThis.fetch = real;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("窗口名、单位和余额都是中英同显，不再有语言切换", async () => {
  const usage = await usageWith({}, { token: "opaque" });
  assert.equal(usage.plan, "Free Plan");
  assert.equal(usage.balance, "1,292,155,358 积分 / credits");
  assert.deepEqual(
    usage.windows.map((w) => w.name),
    [
      "通用积分池 · 5 小时窗口 / General Pool · 5h window",
      "通用积分池 · 本周 / General Pool · This week",
      "Flash-Lite积分池 · 5 小时窗口 / Flash-Lite Dedicated Pool · 5h window",
    ]
  );
  assert.equal(usage.windows[0].unit, "积分 / credits");
});

test("账号行优先用 token 里的账号名，而不是登录时填的账号", async () => {
  // 只填 API Key 时用户拿不到名字；token 里带着它，所以账号行不必显示 API Key。
  const usage = await usageWith({}, {
    token: jwt({ ext: { username: "Ada" } }),
    metadata: { username: "13800000000" },
  });
  assert.equal(usage.user, "Ada");
});

test("token 里没有名字时退回登录时填的账号", async () => {
  const usage = await usageWith({}, {
    token: "opaque",
    metadata: { username: "13800000000" },
  });
  assert.equal(usage.user, "13800000000");
});

test("两者都没有时不设 user，交给 Magpie 退回显示 API Key", async () => {
  const usage = await usageWith({}, { token: "opaque" });
  assert.equal("user" in usage, false);
});

test("账号提问的 key 必须是 email，否则账号行只显示 API Key", async () => {
  // Magpie 依次用 accountId、metadata.email、email 给账号命名，而提示的 key
  // 决定答案落进 metadata 的哪个字段。实测：api 类型下 authorize 返回的
  // accountId 与 metadata 都不起作用（前者被忽略，后者被提示答案覆盖），
  // 只有把提示字段命名为 email 才真的改到账号行；改回去就退化成「API key …尾4位」。
  const plugin = await SenseNovaPlugin({}, {});
  assert.deepEqual(
    plugin.auth.methods[0].prompts.map((p) => p.key),
    ["email", "password"]
  );
});

test("不自己问 API Key：宿主会另开一个遮蔽输入框再问一遍", async () => {
  // 实测（Magpie 0.1.1489 网页版）：api 类型的方法走完自己的提示后，宿主总会
  // 再要一次 API Key 并把它存成凭据；提示里再放一条 key 提问就是问两遍，而且
  // 第二遍填的内容会被 authorize 的返回值盖掉（用户以为改掉的其实是第一次的）。
  const plugin = await SenseNovaPlugin({}, {});
  const keys = plugin.auth.methods[0].prompts.map((p) => p.key);
  assert.equal(keys.includes("key"), false);
});

test("密码提问标成 password：宿主按这个类型遮蔽输入", async () => {
  const plugin = await SenseNovaPlugin({}, {});
  const password = plugin.auth.methods[0].prompts.find((p) => p.key === "password");
  assert.equal(password.type, "password");
});

test("两条提示的文案都是中英同显", async () => {
  const plugin = await SenseNovaPlugin({}, {});
  for (const p of plugin.auth.methods[0].prompts) {
    assert.ok(typeof p.message === "string" && p.message.length > 0, `${p.key} 缺 message`);
    assert.match(p.message, / \/ /, `${p.key} 的文案应同时带中英两半`);
  }
  // 同一句里中文在前、英文在后：宿主没有语言通道，两种读者都要能看懂。
  assert.match(plugin.auth.methods[0].prompts[0].message, /必填/);
  assert.match(plugin.auth.methods[0].prompts[0].message, /required/);
});

test("authorize 只回 success：凭据是宿主收下的那把 key", async () => {
  // 实测：宿主不会把用户填进 key 框的值放进 inputs；authorize 若返回 key，
  // 那个值反而会盖掉用户填的。什么都不返回才是「用宿主收下的那把」。
  const plugin = await SenseNovaPlugin({}, {});
  const out = await plugin.auth.methods[0].authorize({ email: "13800000000" });
  assert.deepEqual(out, { type: "success" });
});

test("consoleAuthOf 认 email，也兼容旧的 username / account", async () => {
  const { consoleAuthOf } = await import("../internal.mjs");
  assert.equal(consoleAuthOf({ metadata: { email: "ada@example.com" } }).username, "ada@example.com");
  // 改名前登录的账号存在 username 下，不能因为改名就丢掉那套控制台凭据。
  assert.equal(consoleAuthOf({ metadata: { username: "旧账号" } }).username, "旧账号");
  assert.equal(consoleAuthOf({ metadata: { account: "别名" } }).username, "别名");
  // email 优先，且去空白
  assert.equal(
    consoleAuthOf({ metadata: { email: "  new@x.com  ", username: "old" } }).username,
    "new@x.com"
  );
  assert.equal(consoleAuthOf({ metadata: { email: "   " } }).username, undefined);
  assert.equal(consoleAuthOf(undefined).username, undefined);
});

test("包清单不再声明自带页面：Magpie 的设置卡片已移除", async () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.magpie.panels, undefined, "不再向宿主注册面板");
  assert.equal(pkg.files.includes("panel/"), false, "发布白名单不该再带 panel/");
});

test("包清单只声明图标，不再用示例值暗示插件选项", async () => {
  // 宿主的「选项」编辑器只对中间件/网关插件开放，示例值虽有也不会被渲染出来；
  // 而配置项本身写在 README 的 Configuration 表里，不需要第二处声明。
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(pkg.magpie), ["icon"]);
});

test("两条登录方式：账号密码（api）/ 浏览器登录（oauth），都只问宿主收不到的东西", async () => {
  const plugin = await SenseNovaPlugin({}, {});
  const methods = plugin.auth.methods;
  assert.equal(methods.length, 2);
  assert.deepEqual(
    methods.map((m) => m.type),
    ["api", "oauth"]
  );
  assert.deepEqual(
    methods.map((m) => m.prompts.map((p) => p.key)),
    [["email", "password"], ["apiKey"]]
  );
  // api 方法不能再问一遍宿主的 key 框；oauth 方法宿主根本不画那个框，才由插件问。
  assert.equal(methods[0].prompts.some((p) => p.key === "key"), false);
});

test("浏览器登录是 oauth + code：宿主自己打开授权地址，落地地址粘回来", async () => {
  const plugin = await SenseNovaPlugin({}, {});
  const method = plugin.auth.methods[1];
  const flow = method.authorize({ apiKey: "sk-test" });
  // `method: "code"` 是宿主画粘贴框的依据；`auto` 会等一个本机回环，
  // 而控制台只认自己那一个 redirect_uri，拿不到回环。
  assert.equal(flow.method, "code");
  assert.match(flow.url, /^https:\/\/platform\.sensenova\.cn\/oauth2\/auth\?/);
  assert.match(flow.url, /redirect_uri=https%3A%2F%2Fplatform\.sensenova\.cn/);
  assert.equal(typeof flow.callback, "function");
  // 宿主会把它当说明文字显示，所以必须中英同显。
  assert.match(flow.instructions, / \/ /);
});

test("浏览器登录没填 API Key：回调用中文说明失败，一个请求都不发", async () => {
  const plugin = await SenseNovaPlugin({}, {});
  const flow = plugin.auth.methods[1].authorize({ apiKey: "  " });
  const real = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  try {
    const out = await flow.callback("https://platform.sensenova.cn/?code=abc12345");
    assert.equal(out.type, "failed");
    assert.match(out.error, /API Key/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = real;
  }
});

test("浏览器登录成功：控制台令牌落盘，API Key 作为凭据返回，账号行按控制台账号命名", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sensenova-"));
  const file = path.join(dir, "quota.json");
  const access = jwt({ ext: { username: "ada" } });
  const plugin = await SenseNovaPlugin({}, { credentialsFile: file });
  const flow = plugin.auth.methods[1].authorize({ apiKey: "sk-typed" });
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith("/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: access, refresh_token: "rt-1" }), { status: 200 });
    }
    throw new Error(`unexpected ${url}`);
  };
  try {
    const out = await flow.callback("https://platform.sensenova.cn/?code=good-code");
    assert.equal(out.type, "success");
    // 模型调用用的凭据由插件返回：oauth 方法没有宿主的 key 框。
    assert.equal(out.key, "sk-typed");
    // 账号行按控制台账号命名：metadata.email 既是行名来源，也是下次读额度的入口。
    assert.equal(out.email, "ada");
    assert.deepEqual(out.metadata, { email: "ada" });
    // 令牌落在刚登录的那个账号自己的槽位里（这里就是控制台账号名），
    // 顶层那份命令行写的记录不动。
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(saved.accounts.ada.access_token, access);
    assert.equal(saved.accounts.ada.refresh_token, "rt-1");
    assert.equal(saved.access_token, undefined);
  } finally {
    globalThis.fetch = real;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("两个账号各读自己的令牌：不会几行显示同一份额度", async () => {
  // 回归：凭据文件里只有一份令牌时，插件曾把它发给每一个账号行，于是只登录两个
  // 账号却看到四行一模一样的额度。令牌按登录时填的账号名分槽存放，各取各的。
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sensenova-"));
  const file = path.join(dir, "quota.json");
  const ada = jwt({ ext: { username: "ada" } });
  const bob = jwt({ ext: { username: "bob" } });
  fs.writeFileSync(
    file,
    JSON.stringify({
      accounts: {
        ada: { access_token: ada, expires_at: 4102444800 },
        bob: { access_token: bob, expires_at: 4102444800 },
      },
    })
  );
  const plugin = await SenseNovaPlugin({}, { credentialsFile: file });
  const real = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (input, init) => {
    const headers = input instanceof Request ? input.headers : new Headers(init?.headers);
    seen.push(String(headers.get("Authorization")));
    return new Response(JSON.stringify(POOL_USAGE), { status: 200 });
  };
  try {
    const asAda = await plugin.auth.usage(async () => ({ type: "api", key: "sk-a", metadata: { email: "ada" } }));
    const asBob = await plugin.auth.usage(async () => ({ type: "api", key: "sk-b", metadata: { email: "bob" } }));
    assert.equal(asAda.user, "ada");
    assert.equal(asBob.user, "bob");
    assert.equal(seen.length, 2);
    assert.equal(seen[0].includes(ada), true, "ada 那行应该拿 ada 的令牌");
    assert.equal(seen[1].includes(bob), true, "bob 那行应该拿 bob 的令牌");
  } finally {
    globalThis.fetch = real;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("没有控制台凭据的账号不回退用别人的令牌，只报「还没有凭据」", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sensenova-"));
  const file = path.join(dir, "quota.json");
  fs.writeFileSync(
    file,
    JSON.stringify({ accounts: { ada: { access_token: jwt({ ext: { username: "ada" } }), expires_at: 4102444800 } } })
  );
  const plugin = await SenseNovaPlugin({}, { credentialsFile: file });
  const real = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response(JSON.stringify(POOL_USAGE), { status: 200 });
  };
  try {
    const usage = await plugin.auth.usage(async () => ({ type: "api", key: "sk-b", metadata: { email: "bob" } }));
    assert.equal(called, false, "别的账号的令牌不能拿来用");
    assert.match(usage.error, /控制台凭据/);
  } finally {
    globalThis.fetch = real;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("账号密码登录不填账号名直接失败：留空会多出一条重复的账号行", async () => {
  // 实测：宿主按 metadata.email 合并账号行，空名字的登录不合并，每登一次多一行
  // 「API key …尾4位」——那几行随后又共用同一份令牌，界面上就是重复的额度。
  const plugin = await SenseNovaPlugin({}, {});
  const out = await plugin.auth.methods[0].authorize({ email: "   ", password: "pw" });
  assert.equal(out.type, "failed");
  assert.match(out.error, /账号名不能为空/);
  const ok = await plugin.auth.methods[0].authorize({ email: "ada", password: "pw" });
  assert.equal(ok.type, "success");
});
