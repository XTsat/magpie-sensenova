/**
 * UI strings, in the two languages the platform serves — shown together.
 *
 * Magpie exposes no locale to a plugin and gives a plugin no way to add settings
 * UI, so the plugin cannot know which language the window is in. Rather than
 * guess, every string this file produces carries both languages, `zh / en`:
 * a wrong guess shows the user the wrong language, and a correct guess still
 * hides what the other one said.
 *
 * That is also why there is no `locale` option: it could only be changed from
 * the command line, and a plugin whose wording is half a language away from the
 * rest of the window is worse than one that answers in both. The labels are not
 * decoration: they land in Magpie's own account card and in `magpie quota`.
 *
 * Why the plugin has to translate at all: the console's quota endpoint returns
 * its pool names in Chinese no matter what `Accept-Language` says. Observed on a
 * real account — `zh-CN` and `en-US` both answer `["通用积分池","Flash-Lite积分池"]`.
 * The console's English site shows "General Pool" and "Flash-Lite Dedicated
 * Pool", so that translation happens in its frontend, not on the wire.
 *
 * @module magpie-sensenova/i18n
 */

/** The Chinese half of every label. */
export const ZH = {
  poolGeneral: "通用积分池",
  poolDedicated: "专属积分池",
  window5h: "5 小时窗口",
  windowWeekly: "本周",
  unit: "积分",
  planFallback: "Token Plan",

  noAccount: "没有可读额度的 SenseNova 账号：补填账号密码，或先运行 snquota login。",
  readFailed: "读取额度失败: {detail}",
  refreshFailed: "refresh_token 续期失败: {detail}",
  exchangeFailed: "用授权码换令牌失败: {detail}",
  cookieDead: "会话 cookie 已失效，请重新导出或用账号密码登录",
  noAuthCode: "授权端点没有返回授权码（HTTP {status}）",
  noChallenge: "授权端点没有返回 login_challenge（HTTP {status}）",
  challengeExpired: "login_challenge 已失效，请重试",
  noRedirect: "登录接口没有返回 redirect",
  chainStuck: "登录跳转链在 {where} 停住了",
  bouncedToLogin: "登录后又被踢回登录页，账号密码可能不对",
  chainTooLong: "登录跳转次数超出上限",
  loginRejected: "登录被拒绝（HTTP {status}）",
  quotaHttp: "读取额度失败 HTTP {status}",
  noRenewalPath: "access_token 已过期，且没有 refresh_token / 会话 cookie / 账号密码可续期。请运行 snquota login。",

  loginInvalidAccount: "账号或密码不正确",
  loginBadPassword: "密码不正确",
  loginNoAccount: "账号不存在",
  loginLocked: "账号被锁定",
  loginNoPermission: "该账号没有权限",
  loginTooFrequent: "操作过于频繁",

  methodLabel: "SenseNova API Key",
  promptKey: "SenseNova API Key（控制台 → API-Key 管理）",
  promptAccount: "可选：读额度用的 SenseNova 账号（留空 = 用 snquota 已存的凭据）",
  promptPassword: "可选：账号密码（明文存在本机 plugin-auth.json，只用于读额度）",
  placeholderAccount: "手机号 / 邮箱",
  placeholderPassword: "留空 = 不保存密码",
  keyRequired: "API Key 不能为空：没有它这个供应商无法发出任何请求。",
};

/** The English half of those same labels, key for key. */
export const EN = {
  poolGeneral: "General Pool",
  poolDedicated: "Dedicated Pool",
  window5h: "5h window",
  windowWeekly: "This week",
  unit: "credits",
  planFallback: "Token Plan",

  noAccount: "No SenseNova account to read the quota: fill one in, or run snquota login first.",
  readFailed: "Quota read failed: {detail}",
  refreshFailed: "refresh_token renewal failed: {detail}",
  exchangeFailed: "Exchanging the authorization code for a token failed: {detail}",
  cookieDead: "The session cookie has expired; export it again or sign in with the account password",
  noAuthCode: "The authorization endpoint returned no code (HTTP {status})",
  noChallenge: "The authorization endpoint returned no login_challenge (HTTP {status})",
  challengeExpired: "The login_challenge has expired; try again",
  noRedirect: "The sign-in endpoint returned no redirect",
  chainStuck: "The sign-in redirect chain stopped at {where}",
  bouncedToLogin: "Bounced back to the sign-in page after signing in; the account or password may be wrong",
  chainTooLong: "The sign-in redirect chain exceeded its hop limit",
  loginRejected: "Sign-in refused (HTTP {status})",
  quotaHttp: "Reading the quota failed with HTTP {status}",
  noRenewalPath: "The access_token expired and nothing can renew it (no refresh_token, session cookie, or account password). Run snquota login.",

  loginInvalidAccount: "Wrong account or password",
  loginBadPassword: "Wrong password",
  loginNoAccount: "No such account",
  loginLocked: "The account is locked",
  loginNoPermission: "This account has no permission",
  loginTooFrequent: "Too many attempts",

  methodLabel: "SenseNova API Key",
  promptKey: "SenseNova API key (console → API-Key management)",
  promptAccount: "Optional: the SenseNova account for the quota (blank = the credentials snquota already stored)",
  promptPassword: "Optional: the account password (plaintext in this machine's plugin-auth.json, quota only)",
  placeholderAccount: "phone / email",
  placeholderPassword: "blank = do not store a password",
  keyRequired: "The API key cannot be empty: without it this provider cannot send any request.",
};

/**
 * One label in both languages: `zh / en`.
 *
 * A string that is already the same in both (a product name, say) is written
 * once instead of twice — "Token Plan / Token Plan" reads like a typo.
 *
 * @param {string} zh
 * @param {string} en
 * @returns {string}
 */
export function pair(zh, en) {
  const a = String(zh ?? "");
  const b = String(en ?? "");
  return a === b ? a : `${a} / ${b}`;
}

/**
 * Fill `{name}` placeholders. Unknown names are left as they are, so a missing
 * string shows up in the UI instead of turning into "undefined".
 */
export function fill(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (whole, key) =>
    key in values ? String(values[key]) : whole
  );
}

/**
 * Every string the plugin shows a person, both languages at once.
 *
 * There is one table and no locale lookup: the host gives a plugin no locale to
 * resolve, and each entry already carries both languages. A caller that wants a
 * half language picks `ZH` or `EN` itself — nothing in the plugin does.
 */
export const T = Object.fromEntries(Object.keys(ZH).map((key) => [key, pair(ZH[key], EN[key])]));

/**
 * A pool name from the API, in each language.
 *
 * The endpoint answers in Chinese whatever `Accept-Language` says, so the
 * English half comes from the naming rule the console itself uses: a dedicated
 * pool is "<family>积分池", and the console renders that "<family> Dedicated
 * Pool" (`Flash-Lite积分池` → `Flash-Lite Dedicated Pool`, as its English site
 * shows).
 *
 * The shared pool is the exception, and it is why this branches on `dedicated`
 * rather than translating every name: its label is this plugin's own generic
 * one, not the API's string. Running the suffix rule over the API's
 * `通用积分池` would produce the nonsense "通用 Dedicated Pool".
 *
 * A dedicated name that does not match the rule is passed through untouched
 * rather than mangled, and a missing one falls back to the generic label.
 *
 * @param {string|undefined} name - `pool.name` from the endpoint.
 * @param {boolean} dedicated - whether the pool is model-scoped.
 * @returns {{zh: string, en: string}} the label in each language.
 */
export function poolParts(name, dedicated) {
  const raw = typeof name === "string" ? name.trim() : "";
  if (!dedicated) return { zh: ZH.poolGeneral, en: EN.poolGeneral };
  if (!raw) return { zh: ZH.poolDedicated, en: EN.poolDedicated };
  // The API has answered both "Flash-Lite积分池" and "Flash-Lite 专属积分池"
  // depending on the response, so accept the optional 专属 rather than leaving
  // it stranded inside an otherwise-English label. Collapsing the spaces keeps
  // the "Flash-Lite " prefix from doubling up with the replacement.
  if (/(?:专属)?积分池$/.test(raw)) {
    return {
      zh: raw,
      en: raw.replace(/(?:专属)?积分池$/, " Dedicated Pool").replace(/\s+/g, " ").trim(),
    };
  }
  return { zh: raw, en: raw.replace(/\s+/g, " ").trim() };
}
