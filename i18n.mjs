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

  noAccount: "这个账号还没有可读额度的控制台凭据：用「账号密码」或「浏览器登录」给它登录一次。",
  accountRequired: "账号名不能为空：Magpie 用它区分不同账号，留空会多出一条显示 API Key 的重复行",
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

  methodLabelAccount: "账号密码登录 / API key",
  methodLabelBrowser: "浏览器登录",
  promptAccount: "读额度用的 SenseNova 账号名（必填：Magpie 按它区分账号行，留空会多出一条重复行）",
  promptPassword: "可选：账号密码（明文存在本机 plugin-auth.json，只用于读额度）",
  placeholderAccount: "手机号 / 邮箱 / 控制台账号名",
  placeholderPassword: "留空 = 不保存密码",
  promptBrowserKey: "浏览器登录只管读额度：模型调用要的 API Key 先填在这（必填，输入时不回显）",
  placeholderApiKey: "API Key",
  browserInstructions: "浏览器已经打开控制台登录页：登录完会跳到 https://platform.sensenova.cn/?code=… 的地址——落地后页面很快会自己刷新、地址会被清掉，请立刻复制整条地址再粘到下面，没赶上的话点提示框下面的「重新打开」再来一遍就行",
  browserNoKey: "API Key 不能为空：浏览器登录只负责读额度，模型调用还得用它",
  pasteNoCode: "没认出授权码：请粘贴登录后落地的那条完整地址（…?code=…），或直接粘 code",
};

/** The English half of those same labels, key for key. */
export const EN = {
  poolGeneral: "General Pool",
  poolDedicated: "Dedicated Pool",
  window5h: "5h window",
  windowWeekly: "This week",
  unit: "credits",
  planFallback: "Token Plan",

  noAccount: "This account has no console credentials for the quota yet: sign it in with the account password or in a browser.",
  accountRequired: "The account name cannot be blank: Magpie uses it to keep accounts apart, and a blank one adds a duplicate row named after the API key",
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

  methodLabelAccount: "账号密码登录 / API key",
  methodLabelBrowser: "Sign in in a browser",
  promptAccount: "The SenseNova account name for the quota (required: Magpie names the account row by it, and a blank one adds a duplicate row)",
  promptPassword: "Optional: the account password (plaintext in this machine's plugin-auth.json, quota only)",
  placeholderAccount: "phone / email / console account name",
  placeholderPassword: "blank = do not store a password",
  promptBrowserKey: "The browser sign-in covers only the quota: type the API key the model calls need first (required, typing stays hidden)",
  placeholderApiKey: "API key",
  browserInstructions: "The console sign-in page is open in your browser: after signing in it lands on a https://platform.sensenova.cn/?code=… address — the page refreshes itself quickly and wipes the address, so copy the whole URL immediately and paste it below; if you miss it, just hit 'reopen' under the prompt and go again",
  browserNoKey: "The API key can't be empty: the browser sign-in only covers the quota, the model calls need one",
  pasteNoCode: "No authorization code found: paste the whole address you landed on (…?code=…), or the code itself",
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
