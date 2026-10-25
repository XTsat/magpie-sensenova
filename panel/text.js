/**
 * Everything the panel says, plus the option values it offers.
 *
 * A classic script and not an ES module: the frame is sandboxed without
 * `allow-same-origin`, where a module fetch is refused. Keeping the tables in
 * their own script is also what lets `test/panel.test.mjs` read them without a
 * browser, and what keeps the panel's words next to the plugin's own.
 *
 * The keys are the console's own wording where the console has one; the rest is
 * this plugin's phrasing. `labels` is keyed by the values `locale` accepts.
 */
const PANEL_TEXT = {
  choices: ["auto", "zh", "en"],
  strings: {
    en: {
      label: "Plugin language",
      save: "Save",
      saved: "Saved. Magpie reloads the plugin, so the next thing it writes is in the new language.",
      failed: "Could not save: {detail}",
      note: "Used for what this plugin writes: quota window labels, units, error messages, and the sign-in prompts. `Auto` follows this machine's locale, not the window's. Prompts already answered at sign-in keep the language they were asked in.",
      labels: {
        auto: "Auto (follow this machine)",
        zh: "中文",
        en: "English",
      },
    },
    zh: {
      label: "插件语言",
      save: "保存",
      saved: "已保存。Magpie 会重新加载插件，之后它写出的字就是新语言。",
      failed: "保存失败：{detail}",
      note: "决定插件自己写出来的字：额度窗口名字、单位、错误信息，以及登录时的提问。`自动` 跟随本机的区域设置，不跟随窗口语言。登录时已经回答过的提问保持当时的语言。",
      labels: {
        auto: "自动（跟随本机）",
        zh: "中文",
        en: "English",
      },
    },
  },
};
