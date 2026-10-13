import { test } from "node:test";
import assert from "node:assert/strict";

import { SenseNovaPlugin } from "../index.mjs";

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
