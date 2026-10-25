import { test } from "node:test";
import assert from "node:assert/strict";

import { fill, pair, poolParts, EN, T, ZH } from "../i18n.mjs";

test("两份字符串表的关键字对称", () => {
  assert.deepEqual(Object.keys(ZH).sort(), Object.keys(EN).sort(), "漏翻一条会在这里露出来");
});

test("每一条文案都同时带中英两半", () => {
  for (const key of Object.keys(ZH)) {
    assert.equal(T[key], pair(ZH[key], EN[key]), `${key} 没按 zh / en 拼`);
  }
  assert.equal(T.unit, "积分 / credits");
  assert.equal(T.window5h, "5 小时窗口 / 5h window");
});

test("两半相同的文案只写一遍，不出现「Token Plan / Token Plan」", () => {
  assert.equal(T.planFallback, "Token Plan");
  assert.equal(pair("同", "同"), "同");
  assert.equal(pair("中", "en"), "中 / en");
});

test("表里不再有 locale 这一项：语言选项已经去掉了", () => {
  // 回归：只要还留着 locale，就说明还有人在按语言分表。
  assert.equal("locale" in T, false);
});

test("通用池的标签由插件决定，不套专属池的命名规则", () => {
  // 回归：接口返回的通用池名就是「通用积分池」，套上「积分池 → Dedicated Pool」
  // 的规则会得到「通用 Dedicated Pool」这种胡话。
  assert.deepEqual(poolParts("通用积分池", false), { zh: "通用积分池", en: "General Pool" });
});

test("专属池按控制台自己的叫法翻译", () => {
  assert.deepEqual(poolParts("Flash-Lite积分池", true), {
    zh: "Flash-Lite积分池",
    en: "Flash-Lite Dedicated Pool",
  });
});

test("带「专属」的池名也翻干净，不留双空格", () => {
  // 接口在不同响应里给过 "Flash-Lite积分池" 和 "Flash-Lite 专属积分池" 两种。
  assert.equal(poolParts("Flash-Lite 专属积分池", true).en, "Flash-Lite Dedicated Pool");
  assert.equal(poolParts("Flash-Lite积分池", true).en, "Flash-Lite Dedicated Pool");
});

test("对不上的池名原样透传，不硬改", () => {
  assert.deepEqual(poolParts("Something Else", true), { zh: "Something Else", en: "Something Else" });
});

test("池名缺失时退回通用叫法", () => {
  assert.deepEqual(poolParts(undefined, true), { zh: "专属积分池", en: "Dedicated Pool" });
  assert.deepEqual(poolParts("", true), { zh: "专属积分池", en: "Dedicated Pool" });
  assert.deepEqual(poolParts(undefined, false), { zh: "通用积分池", en: "General Pool" });
  assert.deepEqual(poolParts("  ", true), { zh: "专属积分池", en: "Dedicated Pool" });
});

test("fill 替换已知占位符，未知的原样留着", () => {
  assert.equal(fill("HTTP {status}", { status: 404 }), "HTTP 404");
  assert.equal(fill("bad {nope}", { status: 404 }), "bad {nope}", "宁可露出占位符，也不要 undefined");
});
