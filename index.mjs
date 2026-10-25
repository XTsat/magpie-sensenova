/**
 * SenseNova (商量 / 日日新) provider plugin for Magpie.
 *
 * Two things in one package, because the platform splits them across two hosts:
 *
 *   - **The provider.** Token Plan speaks the OpenAI dialect at
 *     `https://token.sensenova.cn/v1`, so serving requests is the ordinary
 *     `@ai-sdk/openai-compatible` path and the `fetch` hook forwards untouched.
 *
 *   - **The quota.** The 积分额度 that the console shows lives on a different
 *     API entirely — `platform.sensenova.cn/lite/console/v1/tokenplan/pool-usage`
 *     — behind an OAuth bearer token, not an API key. No API-key-accessible
 *     quota endpoint exists on this platform, so the two credentials are
 *     genuinely separate and both are collected at sign-in.
 *
 * The quota is reported through `auth.usage`, which is the only channel Magpie
 * offers for quota windows: a plugin's own page or panel cannot feed the 用量概览
 * analytics page that Magpie draws itself. What `auth.usage` returns is rendered
 * on the provider's account row, in `magpie quota`, and at the gateway's
 * `GET /v1/magpie/quotas`.
 *
 * This file exports **exactly one function, and nothing else**, so the module
 * also loads under OpenCode, which refuses an entry exporting any non-function
 * value. Helpers live in `internal.mjs`, `quota.mjs` and `models.mjs`.
 *
 * @module magpie-sensenova
 */

import { PROVIDER, ICON, apiKeyOf, consoleAuthOf, fellBack, readAuth } from "./internal.mjs";
import { FALLBACK_MODELS, NPM, createCatalog, toConfigModel, toProviderModel } from "./models.mjs";
import {
  accountNameOf,
  consoleLoginUrl,
  loginWithCode,
  QuotaError,
  readCredentials,
  readQuota,
  writeCredentials,
} from "./quota.mjs";
import { fill, T } from "./i18n.mjs";

const DEFAULT_QUOTA_TTL_MS = 60_000;

/**
 * Build the plugin.
 *
 * @param {{client?: object}} input - the plugin input the host passes.
 * @param {object} [options] - the `options` field from `plugins.json`.
 * @returns {Promise<object>} the hooks the host calls.
 */
export async function SenseNovaPlugin({ client } = {}, options = {}) {
  // Every label carries both languages: the host hands a plugin no locale, and
  // this one has no settings UI left to ask in (see `i18n.mjs`).
  const opts = {
    baseURL: options.baseURL ?? undefined,
    quotaTtlMs: Number(options.quotaTtlMs) > 0 ? Number(options.quotaTtlMs) : DEFAULT_QUOTA_TTL_MS,
    scopeModel: typeof options.scopeModel === "string" ? options.scopeModel : "flash-lite",
    credentialsFile: options.credentialsFile ?? undefined,
  };
  const catalog = createCatalog({ baseURL: opts.baseURL });

  const log = (level, message) => {
    try {
      client?.app?.log?.({ body: { service: "sensenova", level, message } });
    } catch {
      /* the host's logger is best-effort */
    }
  };

  const seedModels = () => catalog.peek() ?? FALLBACK_MODELS;
  const modelsAsConfig = (models) =>
    Object.fromEntries(models.map((m) => [m.id, toConfigModel(m)]));

  /**
   * The credential pair for one account.
   *
   * The console credentials come from the sign-in prompts when the user
   * supplied them, and otherwise from the file the `snquota` CLI writes. The
   * fallback matters because the console login is a multi-step OAuth flow that
   * the CLI already drives, including keeping the token fresh; asking for the
   * same account twice would be worse than reusing that file.
   */
  const credentialsFor = (auth) => {
    const fromAuth = consoleAuthOf(auth);
    const fromFile = readCredentials(opts.credentialsFile) ?? {};
    return {
      base: fromFile.base,
      client_id: fromFile.client_id,
      redirect_uri: fromFile.redirect_uri,
      access_token: fromFile.access_token,
      refresh_token: fromFile.refresh_token,
      expires_at: fromFile.expires_at,
      cookie: fromAuth.cookie ?? fromFile.cookie,
      username: fromAuth.username ?? fromFile.username,
      password: fromAuth.password ?? fromFile.password,
      iam_base: fromAuth.iamBase ?? fromFile.iam_base,
      // Only the file is written back: a token minted here would otherwise
      // silently replace the CLI's copy on the next read.
      __writable: !fromAuth.username && !fromAuth.cookie,
      __file: opts.credentialsFile,
    };
  };

  /**
   * A fresh console credential record, seeded from the file.
   *
   * Signing in replaces only the token fields, so whatever else the `snquota`
   * CLI or an earlier sign-in left in there (the IAM host, a session cookie) is
   * carried forward instead of being dropped on the next read.
   */
  const consoleCfg = () => {
    const file = readCredentials(opts.credentialsFile) ?? {};
    return {
      base: file.base,
      client_id: file.client_id,
      redirect_uri: file.redirect_uri,
      access_token: file.access_token,
      refresh_token: file.refresh_token,
      expires_at: file.expires_at,
      cookie: file.cookie,
      username: file.username,
      password: file.password,
      iam_base: file.iam_base,
    };
  };

  /**
   * Where a console sign-in is kept.
   *
   * The tokens have nowhere else to live: Magpie stores one credential per
   * account and that slot holds the API key, which is what signs the model
   * calls. So the console side goes to the file the quota reader already reads,
   * and the next `usage` call picks it up without a restart.
   */
  const saveConsole = (cfg) => {
    writeCredentials(cfg, opts.credentialsFile);
    quotaCache.clear();
  };

  /** Cache quota per account so a polled hook costs one request a minute. */
  const quotaCache = new Map();

  /**
   * What Magpie puts on the account row.
   *
   * Magpie shows `user` when the hook supplies it and falls back to labelling the
   * account by its API key when it does not. The console tokens carry the
   * account's own display name, which is the name the console's header shows and
   * therefore the one a user recognises; the account typed at sign-in is a phone
   * number or an email, which is what the user logged in with rather than who
   * they are. So the token's name wins, the typed account is the fallback, and
   * only when neither exists does Magpie fall back to the API key.
   */
  const accountLabel = (cfg) => accountNameOf(cfg) ?? cfg.username;

  const quotaFor = async (getAuth) => {
    const auth = await readAuth(getAuth);
    const cacheKey = apiKeyOf(auth) ?? consoleAuthOf(auth).username ?? "sensenova";
    const hit = quotaCache.get(cacheKey);
    if (hit && Date.now() - hit.at < opts.quotaTtlMs) return hit.value;

    const cfg = credentialsFor(auth);
    if (!cfg.access_token && !cfg.refresh_token && !cfg.cookie && !cfg.password) {
      const value = { error: T.noAccount };
      quotaCache.set(cacheKey, { at: Date.now(), value });
      return value;
    }

    try {
      const { quota, changed } = await readQuota(cfg, { scopeModel: opts.scopeModel });
      if (changed && cfg.__writable) writeCredentials(cfg, cfg.__file);
      // 套餐名用接口给的（实际是 "Free Plan"），拿不到才退回通用叫法。
      const { plan, ...rest } = quota;
      const user = accountLabel(cfg);
      const value = {
        plan: plan ?? T.planFallback,
        ...(user ? { user } : {}),
        ...rest,
      };
      quotaCache.set(cacheKey, { at: Date.now(), value });
      return value;
    } catch (error) {
      // A failed read must not be cached for the full TTL: the next poll is
      // exactly when a token that just expired should be retried.
      const user = accountLabel(cfg);
      const value = {
        plan: T.planFallback,
        ...(user ? { user } : {}),
        error: error instanceof QuotaError ? error.message : fill(T.readFailed, { detail: error.message }),
      };
      quotaCache.set(cacheKey, { at: Date.now() - opts.quotaTtlMs + 15_000, value });
      log("warn", `sensenova: quota read failed: ${error.message}`);
      return value;
    }
  };

  return {
    /** Declare the provider and its models. */
    config: async (cfg) => {
      cfg.provider ??= {};
      const was = cfg.provider[PROVIDER] ?? {};
      cfg.provider[PROVIDER] = {
        name: "SenseNova",
        npm: NPM,
        api: opts.baseURL ?? "https://token.sensenova.cn/v1",
        ...was,
        models: { ...modelsAsConfig(seedModels()), ...(was.models ?? {}) },
      };
    },

    provider: {
      id: PROVIDER,
      /**
       * The models this account can actually use.
       *
       * Returning the declared list unchanged on failure keeps the provider
       * usable: Magpie marks it as fallen back rather than letting it vanish.
       */
      async models(provider, { auth } = {}) {
        const id = provider?.id ?? PROVIDER;
        const declared = provider?.models ?? modelsAsConfig(seedModels());
        const key = apiKeyOf(auth);
        if (!key) return fellBack(declared);
        try {
          const live = await catalog.load(key);
          if (!live.length) return fellBack(declared);
          return Object.fromEntries(
            live.map((m) => [
              m.id,
              toProviderModel(m, id, { baseURL: opts.baseURL ?? catalog.baseURL }),
            ])
          );
        } catch (error) {
          log("warn", `sensenova: keeping the known model list: ${error.message}`);
          return fellBack(declared);
        }
      },
    },

    auth: {
      provider: PROVIDER,
      ...(ICON === undefined ? {} : { icon: ICON }),

      /**
       * The account, resolved into request routing.
       *
       * There is no body repair here — unlike a gateway that rejects an empty
       * `tools` array, Token Plan accepts the OpenAI shapes as sent.
       */
      async loader(getAuth) {
        const key = apiKeyOf(await readAuth(getAuth));
        return {
          baseURL: opts.baseURL ?? "https://token.sensenova.cn/v1",
          apiKey: key,
          async fetch(input, init) {
            // Re-read per request so a sign-in that changes mid-session is
            // picked up without waiting for the loader to re-run.
            const current = apiKeyOf(await readAuth(getAuth));
            const source = input instanceof Request ? input : null;
            const headers = new Headers(init?.headers ?? source?.headers);
            if (current === undefined) headers.delete("authorization");
            else headers.set("authorization", `Bearer ${current}`);
            // A Request carries its own body, and re-issuing one by URL alone
            // silently drops it — so clone it instead of rebuilding the call.
            if (source) return fetch(new Request(source, { ...init, headers }));
            return fetch(input, { ...init, headers });
          },
        };
      },

      /**
       * The 积分额度, as the provider card shows it.
       *
       * SenseNova's pools map onto Magpie's window model directly: the 5-hour
       * window is 18000 seconds, the weekly one 604800, and the Flash-Lite pool
       * is scoped to its own model family. The 活动固定积分 balance has no
       * window, so it is reported as `balance`.
       */
      async usage(getAuth) {
        return quotaFor(getAuth);
      },

      /**
       * Three ways to hand over the console account, one API key field each.
       *
       * The key is never asked here. Magpie asks an `api` method for the key
       * itself, in a masked field it draws after these prompts, and keeps it —
       * measured. A `key` prompt on top of that asks for the key twice, and the
       * second answer is the one that gets thrown away (the key `authorize`
       * returns outranks the field the user just typed into).
       *
       * What differs is only how the console side is obtained. All three end in
       * the same place: the tokens go to the credentials file, and the account
       * row is named from the console token when it can be.
       */
      methods: [
        {
          type: "api",
          label: T.methodLabelAccount,
          prompts: [
            {
              type: "text",
              // `email` rather than `username`: Magpie names an account from
              // `accountId`, then `metadata.email`, then `email`, and only
              // otherwise labels it by the credential. A prompt's key is what
              // lands in `metadata`, so naming the field `email` is what makes
              // the account row read as the account instead of "API key …HohJ".
              // Reading it back is `consoleAuthOf`'s job.
              key: "email",
              message: T.promptAccount,
              placeholder: T.placeholderAccount,
            },
            {
              // A password typed into a plain text field is on screen and in
              // the DOM; the host renders this one masked.
              type: "password",
              key: "password",
              message: T.promptPassword,
              placeholder: T.placeholderPassword,
            },
          ],
          /**
           * Nothing to return but success: the credential is the key the host
           * collected, and `inputs` does not carry it (measured — returning a
           * key here overrides what the user typed into that field).
           */
          async authorize() {
            return { type: "success" };
          },
        },
        {
          // An `oauth` method is the only kind the host opens a browser for
          // (measured 0.1.1489): it shows `url`, and `method: "code"` puts a
          // paste box under it for whatever the browser ends on. A loopback
          // return is impossible here — the console's client pre-registers
          // `https://platform.sensenova.cn` as its only redirect target (see
          // `consoleLoginUrl`) — so the box is the only way back.
          //
          // The API key is asked here rather than left to the host: the host
          // adds its own key field to `api` methods only, and the model calls
          // need a key that the quota token is not.
          type: "oauth",
          label: T.methodLabelBrowser,
          prompts: [
            {
              type: "password",
              key: "apiKey",
              message: T.promptBrowserKey,
              placeholder: T.placeholderApiKey,
            },
          ],
          authorize(inputs) {
            const key = typeof inputs?.apiKey === "string" ? inputs.apiKey.trim() : "";
            return {
              url: consoleLoginUrl(consoleCfg()),
              instructions: T.browserInstructions,
              method: "code",
              async callback(pasted) {
                if (!key) return { type: "failed", error: T.browserNoKey };
                const cfg = consoleCfg();
                try {
                  await loginWithCode(cfg, pasted);
                } catch (e) {
                  return { type: "failed", error: e?.message ?? String(e) };
                }
                saveConsole(cfg);
                // `metadata` is what names the row and what `consoleAuthOf`
                // reads back, and the host merges on `metadata.email`: returning
                // the console account's own name updates the row that account
                // already has instead of adding one per sign-in (measured — a
                // key-only success lands as a fresh "API key …HohJ" row). The
                // merge replaces `metadata` wholesale, so a password stored by
                // the other method is gone afterwards; the tokens written above
                // are what the quota reads from then on.
                const name = accountNameOf(cfg);
                return name
                  ? { type: "success", key, email: name, metadata: { email: name } }
                  : { type: "success", key };
              },
            };
          },
        },
      ],
    },
  };
}
