# magpie-sensenova

**English** | [中文](https://github.com/XTsat/magpie-sensenova/blob/main/README.md)

A [Magpie](https://usemagpie.ai) provider plugin for **SenseNova** (商量 / 日日新, SenseTime). Install it and SenseNova's Token Plan models become available inside Magpie, while the console's credit quota shows up in the account row and in `magpie quota` — no dashboard tab needed. To get started, run `magpie plugin login sensenova` (an API key is required; account and password are optional and only needed for the quota display).

The quota appears in three places: the account row, `magpie quota`, and the gateway's `GET /v1/magpie/quotas` (window names and the unit carry both languages, as below). For what this plugin stores on your machine, which hosts it contacts and the known risks, see the ⚠️ privacy and security notice below.

```
$ magpie quota
sensenova  通用积分池 · 5 小时窗口 / General Pool · 5h window   0% used ↻ 2h  ·  Flash-Lite积分池 · 本周 / Flash-Lite Dedicated Pool · This week  22.8% used ↻ 2h
```

*Pool names come from the console; the English half follows the console's own English naming: **General Pool**, **Flash-Lite Dedicated Pool**, **credits**.*

---

## Where the quota is reported

The quota appears in exactly three places: the provider's **account row**, `magpie quota`, and the gateway's `GET /v1/magpie/quotas`. It does not reach Magpie's usage overview — that page is driven by Magpie's own request metering, and a plugin cannot write to it.

The percentages, used amounts and allowances in the windows come from the same console data, so the card's "used / limit" matches what the console shows; a window whose usage cannot be read is skipped rather than shown as `0 / limit`.

## Install

```bash
magpie plugin add github:XTsat/magpie-sensenova
magpie plugin login sensenova
```

You can also hand the repository path straight to `magpie plugin add <path to this repository>`.

Sign-in first asks how to hand over the console account (needed for the quota); both routes lead to the same place:

1. **Account and password** — a filled-in account is what the account row shows; the password is not echoed as you type and is stored in plaintext in this machine's credential file (see the privacy notice). Both fields may be left blank.
2. **Sign in in a browser** — no password changes hands: the web UI opens the console's sign-in page for you, and when you are done the browser lands on a `https://platform.sensenova.cn/?code=…` address that won't load — paste that whole address back into the prompt. On the command line there is no browser to open, so the plugin prints the address for you to open and then waits for a `Code:`.

Both routes ask for the **API key** (required, not echoed) — create one in the console → API-Key management. Without it the provider cannot make any request; route 2 asks for the key first, then opens the browser.

Leaving route 1's fields blank is fine: the plugin falls back to `~/.sensenova-quota.json`, written on this machine by the `snquota` CLI. Console tokens obtained through route 2 go into that same file, so the next quota read picks them up.

A successful browser sign-in updates the row that console account already had: it takes the API key you typed plus the console tokens, and the row is labelled with the console account's own name. A password stored there earlier by route 1 does **not** survive — re-run route 1 if you want it back as a renewal fallback.

Why route 2 needs a paste: the console's sign-in client has only `https://platform.sensenova.cn` registered as a redirect target, and `http://127.0.0.1:<port>` is refused (measured), so the plugin cannot catch the browser redirect itself.

### If the prompts fail on Windows

Magpie's prompt reader wants a real Windows console. Started from a shell that does not give it one — Git Bash / mintty is the usual case — the first prompt dies with:

```
magpie: read /dev/stdin: The handle is invalid.
```

That is Magpie's own host code reading its standard input, not this plugin: every package using a text prompt behaves the same way. Two ways round it:

**Answer on the command line instead.** Piped input works, and the answers are read in prompt order — first a route number (`1` account and password / `2` browser), then whatever that route asks, then the API key (route 2 asks for the key before the `?code=…` address). Below is the usual first route (number, account, password, API key); the trailing `.` line matters, because the reader has to finish its input before the last prompt or it reports EOF first.

```bash
printf '1\n%s\n%s\n%s\n.\n' "$ACCOUNT" "$PASSWORD" "$SENSENOVA_API_KEY" | magpie plugin login sensenova
```

Route 2 takes the key and one pasted address: `printf '2\n%s\n%s\n.\n' "$SENSENOVA_API_KEY" "$REDIRECT_URL"`.

**Or use the Magpie app's own sign-in**, which does not go through the CLI reader at all.

## Configuration

The `options` for this entry in `plugins.json`:

```json
{
  "baseURL": "https://token.sensenova.cn/v1",
  "quotaTtlMs": 60000,
  "scopeModel": "flash-lite",
  "credentialsFile": "~/.sensenova-quota.json"
}
```

| Option | Default | Meaning |
| --- | --- | --- |
| `baseURL` | `https://token.sensenova.cn/v1` | Token Plan address |
| `quotaTtlMs` | `60000` | How long a quota read is cached (ms). The quota gets polled; the cache keeps the console endpoint from being hammered |
| `scopeModel` | `flash-lite` | Keyword used to match the dedicated pool's models when it reports no model list |
| `credentialsFile` | `~/.sensenova-quota.json` | Where the console credentials live (changes the write target only; it cannot turn writing back off — see section 1 of the security notice) |

## Models

The built-in snapshot has four models, taken from the platform's own usage report:

- `sensenova-6.8-flash-lite` (multimodal)
- `deepseek-flash`
- `glm-5.2`
- `kimi-k3`

After sign-in the plugin fetches the currently available model list from the platform once: if that succeeds the list is used, otherwise the snapshot above is used. Magpie also merges its own models.dev entry for `sensenova`, which in practice adds `deepseek-v4-pro` and `deepseek-v4-flash`, two 1M-context models.

Context length and output ceiling are not published by the platform, so the built-in snapshot uses conservative placeholders; a live list that carries metadata overrides them.

## Quota is account-level

**The credit quota is not split per API key: every key on the same account shares one pool.** The console itself says 「同账户所有 Key 共享」 ("shared by all keys on the account"), and the quota data has no key dimension at all; the per-key breakdown lives in the console's **usage records** page, where each call record carries its own key and can be filtered by key and exported as CSV or Excel.

What that means for Magpie:

- Add two keys from the same account and both rows show **exactly the same numbers**.
- Magpie's "when one runs out, switch to the next" behaviour fails here — it assumes each key has its own allowance, while they share one pool. **Adding keys does not add quota.**
- More quota means **a different SenseNova account**.

## Known limits

- **The quota appears in exactly three places** — the account row, `magpie quota`, and `/v1/magpie/quotas` — and cannot be put into the usage overview. That is Magpie's design, not something this plugin failed to do.
- If the console token expires and all three renewal paths fail (refresh token revoked, cookie expired, wrong password), the account row shows an `error` asking you to sign in again.
- The quota is read from a console-internal API rather than a public one, so a platform redesign may break it (model calls are unaffected).
- Without an available model list, the model capability fields (context length and so on) are placeholders.
- Window names and error lines carry both languages, so they are about twice as long as a single language and there is no way to show only one.

## ⚠️ Privacy and security notice

**This plugin is a local third-party client. It is not affiliated with SenseTime.** The nine sections below cover what it stores on your machine, which hosts it contacts and who can see what; anything marked **observed** is a measurement of the real environment.

### 1. What is stored, and where

| Credential | Stored in | What it can do |
| --- | --- | --- |
| API key | `~/.config/magpie/plugin-auth.json`, field `key` | Call the Token Plan models |
| Account + password (only if you supply them) | same file, `metadata.username` / `metadata.password` | **The whole account** |
| Console tokens | same file's `metadata`, or `~/.sensenova-quota.json` | Read quota, renew tokens |
| Session cookie (when that file already carries one) | as above | Trade for console tokens without a password |
| Console tokens obtained through "sign in in a browser" | `~/.sensenova-quota.json` | Read quota, renew tokens |

**The account password does far more than read quota.** It can sign in to the SenseNova console, create and delete API keys, and do anything else that account can do. Handing it to the plugin means handing the whole account to Magpie's credential file — the heaviest permission this plugin asks for. **Leaving it blank works fine** (see 5).

The account and password have only two possible origins, both consented to: what you typed into the sign-in prompt, or what you previously saved to `~/.sensenova-quota.json` with `snquota login --save-password`. **The plugin does not scrape credentials from a browser, the system keychain or another provider's sign-in**, and does not write to any credential setting on SenseNova's servers.

Two local writes both land in the same `~/.sensenova-quota.json`: first, when you sign in through a browser, the tokens it trades for are **written to that file straight away** — Magpie keeps one credential per account and that slot holds the API key, so console tokens have nowhere else to live; second, when the credentials already came from that file (that is, you left the account fields blank), then after renewing a token the plugin **writes the new token back to that file** so the CLI's copy does not go stale. The second one's condition is "neither an account nor a cookie was supplied at sign-in" — supply either one and nothing is written back.

### 2. The password is stored in plaintext

**The content is not encrypted; it is plain JSON.** And do not rely on file permissions to save you: on Linux and macOS Magpie creates the file as 600 (readable only by you), but on Windows that protection does not actually land — measured on this machine, both files have an effective mode of `666`, and the `-rw-r--r--` that `ls -l` prints is a Git Bash fabrication; the real ACL gives the local group modify rights.

In other words, **the password's security boundary is "every local process on this machine", not "only you"**. The practical advice: keep both paths out of cloud-sync folders, backup jobs and dotfiles repositories — once the password rides along in a backup, it travels in plaintext.

### 3. The password travels in plaintext

When you sign in through a browser, the console frontend encrypts the password with the server's public key first (`is_encrypt: true`, RSA-OAEP). **This plugin sends plaintext** (`is_encrypt: false`) — **observed**: the server accepts it and does not require encryption.

Both end up as plaintext on the server, which is what checking the password requires. The difference is which parts of the path are exposed: HTTPS still protects the transport, but anything that can see TLS plaintext — a corporate proxy, a packet capture, request-body logging — can see the password. If you are behind one of those, do not fill in the password.

### 4. The password is almost never used

The renewal order is `refresh_token` → session cookie → account password, and **the first step that succeeds stops the chain**. As long as the refresh token is alive, the password is never sent; it is only the last resort.

### 5. If you would rather not store a password, leave it blank

Both the account and password fields at sign-in can be left empty. Three ways to run this, and what each costs:

| Approach | What lands where | For whom |
| --- | --- | --- |
| **API key only** | Just `key` | You want model calls and do not care about the quota display |
| **Leave account and password blank** | The plugin reads `~/.sensenova-quota.json`, written by `snquota` (usually holds a refresh token) | You want the quota shown but will not hand the account password to Magpie |
| **Fill in the account** | Plaintext into `plugin-auth.json` | You have no other token source and accept the risks in 1 and 7 |

If you leave both blank and that config file does not exist either, the quota reports an error asking you to sign in again — **model calls are unaffected either way.**

### 6. Which hosts it talks to

On the default deployment (`platform.sensenova.cn`) there are three:

| Host | Purpose | What is sent |
| --- | --- | --- |
| `token.sensenova.cn` | Model requests, model listing | API key |
| `platform.sensenova.cn` | Reading quota; the icon URL also lives here | Console token |
| `iam.sensecoreapi.cn` | Renewing the console token | Account and password (only in the fallback case in 4) |

There is a fourth in the source, `iam.sensecoreapi.tech`: it belongs to a **separate deployment**, `nova.sensecore.tech`, and is only reached when the account belongs to it. On `platform.sensenova.cn` it never appears.

Nothing else is sent anywhere — no telemetry, no reporting, no third-party SDK. It **does not read other providers' credentials** (it technically could read the same `plugin-auth.json`, see 7; the point is that the code does not), does not touch configuration outside Magpie, and does not create or delete API keys.

### 7. What Magpie — and other plugins — can see

Magpie's own documentation FAQ says a plugin can see everything in the requests it makes: the conversation, the tools and their results. **This is a provider plugin, so it sits in the request path**, and by capability it is positioned to see your entire conversation.

What the code actually does: it rewrites the single `authorization` header, swapping in the current API key; it does not read the request body, does not write the content anywhere, does not cache prompts or responses, and does not send anything to a host outside the list in 6. **But that is the code restraining itself, not isolation granted by the platform** — you can only confirm it by reading the code, and Magpie cannot guarantee it for you.

Three facts about Magpie's plugin mechanism decide how much that restraint is worth:

- **Plugins are not sandboxed.** A plugin is ordinary code running inside Magpie's process, and it can read files. Magpie's documentation recommends a separate HOME or a sandbox for exactly this reason.
- **Plugins are not reviewed.** For plugins installed from the GitHub topic, Magpie labels them as reviewed by nobody; this plugin is unvetted third-party code in the same way.
- **Every plugin's credentials live in one file.** `plugin-auth.json` holds the sign-in for every provider and every plugin. Since plugins are unsandboxed and can read files, **any other plugin you install can read the account password this one stored there** — the single most important consideration when deciding whether to fill in a password; if there are plugins of unknown provenance on the machine, leave it blank (see 5).

This plugin renders nothing in Magpie's pages; its only visible outputs are the quota windows and the error messages it returns, both inside Magpie's own UI. Magpie itself reads `plugin-auth.json` (to manage sign-ins), `plugins.json` (plugins and their options) and `plugin-providers.json` (the last listed providers and models); the plugin detail page shows this document, which is why it is this plugin's only disclosure surface.

### 8. Risk statement: the quota endpoint is a console-internal API

The quota figure is served by an endpoint on the console host that the console's own frontend uses to draw its credit panel. It is undocumented and can change or disappear at any time; the exact path is not published in this document.

That route exists because the platform **offers no API-key-accessible quota endpoint** — **observed**: a dozen candidate paths on the public host were probed one by one and all returned 404.

The risk is not limited to "it might break":

| Risk | What it means |
| --- | --- |
| **It may breach the terms of service** | The endpoint is the console frontend's own, not a promised API. Whether scripted access is permitted is the platform's call, and **you should confirm it yourself**; this plugin neither changes nor circumvents any term. |
| **It may stop working** | An undocumented endpoint makes no compatibility promise; a redesign, a signature requirement or rate limiting could turn it into a 404 or 403, at which point the quota display reports an error (model calls are unaffected). |
| **It may trip abuse controls** | Automatic sign-in plus periodic quota reads look like a non-standard client to the server. The plugin already caches quota reads for 60 seconds and demotes the password to a last resort, but **it cannot promise you will not be flagged.** |
| **It widens credential exposure** | Reaching this endpoint requires a console token (and optionally an account password); that part of the risk is covered by 1 through 7. |

Of these four, only the first needs your judgement — the plugin can carry the technical ones, not the compliance one. **If that bothers you, do not use the quota feature**: with only an API key filled in, the plugin degrades to a plain model provider and never touches the console API, and risks 2 through 4 go away with it.

### 9. What it does not do

- It does not request, rotate or revoke your API keys.
- It does not change your SenseNova account settings.
- It does not read, log or forward your model request content — it only rewrites the `authorization` header and passes the body through to `token.sensenova.cn`.
- It does not cache prompts or responses.
- It does not write to any credential setting on SenseNova's servers.
- It does not render any UI of its own inside Magpie, and has no language setting: every string it shows is fixed and bilingual.
- It does not write back to `~/.sensenova-quota.json`, **except** when the credentials came from that file and a token was renewed (see the end of 1).
