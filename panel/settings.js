/**
 * The plugin's settings panel: the `locale` option, in the window's language.
 *
 * Magpie draws the card itself (its head, its frame, its error text) in the
 * window's language; the words here are the ones this plugin has to supply.
 * The frame is sandboxed with `allow-scripts` only and its policy says
 * `connect-src 'none'`, so the select, the button and the bridge's
 * `magpie.options` are the whole surface: nothing is fetched, nothing is
 * inlined, and only this plugin's own options can be read or written.
 *
 * @module magpie-sensenova/panel
 */

/** The panel speaks Chinese when the window does, English otherwise. */
const panelLanguage = (lang) => (String(lang ?? "").toLowerCase().startsWith("zh") ? "zh" : "en");

const fill = (template, values) =>
  String(template).replace(/\{(\w+)\}/g, (whole, key) =>
    key in values ? String(values[key]) : whole
  );

const nodes = {
  locale: document.querySelector("#locale"),
  save: document.querySelector("#save"),
  status: document.querySelector("#status"),
};

let text = PANEL_TEXT.strings.en;
let options = {};
let chosen = "auto";

function draw() {
  for (const node of document.querySelectorAll("[data-text]")) {
    node.textContent = text[node.dataset.text] ?? node.dataset.text;
  }
  nodes.locale.replaceChildren(
    ...PANEL_TEXT.choices.map((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text.labels[value];
      option.selected = value === chosen;
      return option;
    })
  );
}

function say(message, failed) {
  nodes.status.textContent = message ?? "";
  nodes.status.toggleAttribute("data-error", Boolean(failed));
}

async function save() {
  nodes.save.disabled = true;
  say("");
  try {
    // Magpie answers with what it saved; merging keeps the options this panel
    // does not offer (baseURL, quotaTtlMs, …) instead of replacing them.
    options = (await magpie.options.set({ ...options, locale: chosen })) ?? options;
    say(text.saved);
  } catch (error) {
    say(fill(text.failed, { detail: error?.message ?? error }), true);
  } finally {
    nodes.save.disabled = false;
  }
}

async function start() {
  const theme = await magpie.ready;
  text = PANEL_TEXT.strings[panelLanguage(theme.lang)];
  // the window can switch language under the panel; the card's own words follow
  magpie.onTheme((next) => {
    text = PANEL_TEXT.strings[panelLanguage(next.lang)];
    draw();
  });

  options = (await magpie.options.get()) ?? {};
  chosen = PANEL_TEXT.choices.includes(options.locale) ? options.locale : "auto";
  draw();

  nodes.locale.addEventListener("change", () => {
    chosen = nodes.locale.value;
    say("");
  });
  nodes.save.addEventListener("click", save);
}

start().catch((error) => say(fill(text.failed, { detail: error?.message ?? error }), true));
