import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import { resolveLocale } from "../i18n.mjs";

const root = new URL("../", import.meta.url);
const read = (relative) => readFileSync(new URL(relative, root), "utf8");
const there = (relative) => existsSync(new URL(relative, root));

const manifest = JSON.parse(read("package.json"));
const panels = manifest.magpie?.panels ?? [];
const html = read("panel/settings.html");
const script = read("panel/settings.js");

// 面板的文案表是普通脚本（沙箱 iframe 取不到 ES module），所以按浏览器的方式
// 只给它一个空对象求值，再把表取回来。
const text = runInContext(`${read("panel/text.js")}\n;PANEL_TEXT`, createContext({}));

/** Magpie 文档里写明的槽位；写错一个只在运行时静默不显示。 */
const SLOTS = ["agents", "usage", "settings", "provider"];

/** 桥接面上有文档的成员；多用一个就是踩未公开的接口。 */
const BRIDGE = ["ready", "theme", "onTheme", "options", "read", "context", "onAction"];

test("面板挂在文档写明的槽位上，文件真实存在", () => {
  assert.equal(panels.length, 1, "一个面板：语言设置");
  // 文档：一个插件最多 8 个面板。
  assert.ok(panels.length <= 8);
  const [panel] = panels;
  assert.ok(SLOTS.includes(panel.slot), `未知槽位 ${panel.slot}`);
  assert.equal(panel.slot, "settings", "语言是插件选项，归「设置 → 插件」");
  assert.ok(there(panel.file), `${panel.file} 不存在，面板会是空白`);
});

test("面板标题两种语言都有，英文是兜底", () => {
  const [panel] = panels;
  // 文档：其余语言用 title，title 缺失会回落成文件名（serve 的日志里会抱怨）。
  assert.equal(typeof panel.title, "string");
  assert.equal(panel.title, "SenseNova language", "title 是英文兜底");
  assert.equal(panel.titles.zh, "SenseNova 语言");
  for (const lang of Object.keys(panel.titles)) {
    assert.match(lang, /^(zh|zh-TW|ja|de)$/, "文档只给这几种语言的代码");
  }
});

test("面板不申请权限：它只读自己的选项", () => {
  // magpie.read 要 magpie.permissions 才放行；这个面板一次都不读，就不该要。
  const [panel] = panels;
  assert.equal(panel.permissions, undefined);
  assert.equal(manifest.magpie.permissions, undefined);
  assert.ok(!/magpie\.read\b/.test(script), "没有 magpie.permissions 就不该调 magpie.read");
});

test("panel/ 进了发布白名单", () => {
  // 按仓库安装读的是仓库里的文件，但 npm 分发包只看 files 白名单。
  assert.ok(manifest.files.includes("panel/"), "漏了白名单，npm 包里的面板文件不会存在");
});

test("面板 HTML 不内联脚本，且只引自己的文件", () => {
  // 沙箱 CSP：脚本必须是文件，内联脚本不执行；面板也没有网络。
  const tags = html.match(/<script\b[^>]*>/g) ?? [];
  assert.ok(tags.length >= 2);
  for (const tag of tags) assert.match(tag, /\ssrc="[^"]+"/, `内联脚本不会执行：${tag}`);
  assert.ok(html.includes('src="_magpie/bridge.js"'), "没有桥接，面板拿不到 magpie 对象");

  for (const [, reference] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (reference.startsWith("_magpie/")) continue; // 宿主提供
    assert.ok(there(`panel/${reference}`), `panel/${reference} 不存在，面板会缺资源`);
  }
  // 顺序：桥接先于用它的脚本（都是 defer，按文档顺序执行）。
  const order = ["_magpie/bridge.js", "text.js", "settings.js"].map((name) =>
    html.indexOf(`src="${name}"`)
  );
  assert.deepEqual([...order].sort((a, b) => a - b), order, "脚本顺序：桥接 → 文案 → 逻辑");
});

test("面板每一句文案都有中英两份", () => {
  const { strings } = text;
  assert.deepEqual(
    Object.keys(strings.zh).sort(),
    Object.keys(strings.en).sort(),
    "漏翻的键会在这里露出来"
  );
  for (const lang of ["zh", "en"]) {
    assert.deepEqual(
      Object.keys(strings[lang].labels).sort(),
      [...text.choices].sort(),
      "每个选项值都要有标签"
    );
  }

  const keys = [...html.matchAll(/data-text="([^"]+)"/g)].map(([, key]) => key);
  assert.ok(keys.length >= 3, "HTML 里的静态文案都靠 data-text 填");
  for (const key of keys) {
    for (const lang of ["zh", "en"]) {
      assert.ok(strings[lang][key], `${lang} 缺 ${key}`);
    }
  }
});

test("面板只提供插件认得的 locale 值，默认是 auto", () => {
  assert.deepEqual([...text.choices], ["auto", "zh", "en"]);
  for (const choice of text.choices) {
    // 面板写下的值必须原样被 resolveLocale 认出来，否则保存后语言会跳到兜底。
    if (choice === "auto") continue; // auto 本来就是「解析成本机语言」，不是结果
    assert.equal(resolveLocale(choice, {}, "en-US"), choice);
  }
  // auto 仍然是默认值（README 的选项表）：面板不能把它漏掉。
  assert.ok(["zh", "en"].includes(resolveLocale("auto", {}, "")));
});

test("保存时合并而不是覆盖其它选项", () => {
  // options.set 写回整个选项对象；不带上下文就会把 baseURL、quotaTtlMs 抹掉。
  assert.match(script, /magpie\.options\.set\(\{\s*\.\.\.options/);
  assert.match(script, /magpie\.options\.get\(\)/);
});

test("面板只碰有文档的桥接成员", () => {
  for (const [, member] of script.matchAll(/\bmagpie\.(\w+)/g)) {
    assert.ok(BRIDGE.includes(member), `用了未公开的 magpie.${member}`);
  }
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest/.test(script), "面板没有网络，也没有必要");
  assert.ok(!/console\.\w+/.test(script), "面板不往宿主控制台写日志");
});

test("面板跟随窗口语言切换", () => {
  // 窗口换语言时 Magpie 广播主题；文案表要跟着换，否则卡片会半中半英。
  assert.match(script, /magpie\.onTheme\(/);
  assert.match(script, /theme\.lang/);
});

/**
 * 一个够用的 DOM 替身：面板只用到 querySelector(All)、createElement、事件和文本。
 * 元素从真实 HTML 里按 id / data-text 生成，所以加一句文案不改 HTML 就会露出来。
 */
function browser(markup) {
  const nodes = new Map();
  const marked = [];
  const element = (tag) => {
    const node = {
      tag,
      textContent: "",
      value: "",
      disabled: false,
      selected: false,
      dataset: {},
      attributes: new Map(),
      children: [],
      handlers: {},
      replaceChildren(...kids) {
        node.children = kids;
      },
      toggleAttribute(name, on) {
        // 和 DOM 一样：false 是「去掉这个属性」，不是「设成 false」。
        if (on) node.attributes.set(name, true);
        else node.attributes.delete(name);
      },
      addEventListener(type, fn) {
        node.handlers[type] = fn;
      },
    };
    return node;
  };
  for (const [, tag, attrs] of markup.matchAll(/<(\w+)([^>]*)>/g)) {
    const node = element(tag.toLowerCase());
    const id = /\bid="([^"]+)"/.exec(attrs)?.[1];
    const key = /\bdata-text="([^"]+)"/.exec(attrs)?.[1];
    if (id) nodes.set(`#${id}`, node);
    if (key) {
      node.dataset.text = key;
      marked.push(node);
    }
  }
  return {
    nodes,
    document: {
      querySelector: (selector) => nodes.get(selector) ?? null,
      querySelectorAll: (selector) => (selector === "[data-text]" ? marked : []),
      createElement: element,
    },
  };
}

/** 把面板放进替身浏览器里跑起来，返回它碰过的东西。 */
async function openPanel({ lang = "zh", options, broken = false } = {}) {
  const dom = browser(html);
  const saved = [];
  const themes = [];
  let current = options;
  const magpie = {
    ready: Promise.resolve({ lang, dark: false, tokens: {} }),
    onTheme: (fn) => themes.push(fn),
    options: {
      get: async () => current,
      set: async (next) => {
        if (broken) throw new Error("boom");
        saved.push(next);
        current = next;
        return next;
      },
    },
  };
  // 两个文件在 HTML 里是一前一后加载的普通脚本，这里照同样的顺序求值。
  runInContext(`${read("panel/text.js")}\n${script}`, createContext({ document: dom.document, magpie }));
  await new Promise((resolve) => setImmediate(resolve)); // 等 start() 里的 await 走完
  return { dom, nodes: dom.nodes, saved, themes };
}

test("面板按窗口语言说话，并按已保存的选项预选", async () => {
  const { nodes } = await openPanel({ lang: "zh", options: { locale: "en" } });
  assert.equal(nodes.get("#save").textContent, "保存");
  assert.equal(nodes.get("#status").textContent, "");
  const select = nodes.get("#locale");
  // 三个选项值都用窗口语言标注：auto 说明跟随本机，另外两个语言名自称。
  assert.deepEqual(
    [...select.children].map((option) => [option.value, option.textContent]),
    [
      ["auto", "自动（跟随本机）"],
      ["zh", "中文"],
      ["en", "English"],
    ]
  );
  assert.deepEqual(
    [...select.children].filter((option) => option.selected).map((option) => option.value),
    ["en"],
    "已保存的值要被选中"
  );
});

test("窗口说英文时就整块说英文", async () => {
  const { nodes } = await openPanel({ lang: "en", options: { locale: "zh" } });
  assert.equal(nodes.get("#save").textContent, "Save");
  assert.equal(nodes.get("#note").textContent.startsWith("Used for"), true);
});

test("保存只改 locale，其余选项原样带回去", async () => {
  const existing = { baseURL: "https://example.test/v1", quotaTtlMs: 60000, locale: "en" };
  const { nodes, saved } = await openPanel({ lang: "zh", options: existing });
  nodes.get("#locale").value = "zh";
  nodes.get("#locale").handlers.change();
  await nodes.get("#save").handlers.click();

  assert.equal(saved.length, 1);
  // options.set 写的是整个选项对象：丢了 baseURL 就等于把用户配置抹掉。
  assert.deepEqual({ ...saved[0] }, { ...existing, locale: "zh" });
  assert.equal(nodes.get("#status").textContent.startsWith("已保存"), true);
  assert.equal(nodes.get("#status").attributes.has("data-error"), false);
});

test("保存失败要说出来，而且用当前语言", async () => {
  const { nodes } = await openPanel({ lang: "en", options: { locale: "en" }, broken: true });
  await nodes.get("#save").handlers.click();
  assert.equal(nodes.get("#status").textContent, "Could not save: boom");
  assert.equal(nodes.get("#status").attributes.get("data-error"), true);
  assert.equal(nodes.get("#save").disabled, false, "失败后按钮要能再按");
});

test("窗口换语言时面板跟着换", async () => {
  const { nodes, themes } = await openPanel({ lang: "en", options: { locale: "auto" } });
  assert.equal(themes.length, 1, "要订阅主题变化");
  themes[0]({ lang: "zh-CN", dark: true, tokens: {} });
  assert.equal(nodes.get("#save").textContent, "保存");
  assert.deepEqual(
    [...nodes.get("#locale").children].map((option) => option.textContent),
    ["自动（跟随本机）", "中文", "English"]
  );
});
