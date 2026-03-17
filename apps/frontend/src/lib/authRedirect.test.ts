import assert from "node:assert/strict";
import test from "node:test";

import {
  configureUnauthorizedRedirect,
  handleUnauthorizedResponse,
  resetUnauthorizedRedirectForTests,
} from "./authRedirect";

test("redirects unauthorized users to the login page without a full reload", async () => {
  const queryCalls: Array<{ key: readonly string[]; value: unknown }> = [];
  const navigationCalls: Array<{ to: string; replace: boolean }> = [];

  configureUnauthorizedRedirect({
    getCurrentPathname: () => "/dashboard",
    navigate: async ({ replace, to }) => {
      navigationCalls.push({ to, replace });
    },
    setQueryData: (key, value) => {
      queryCalls.push({ key, value });
    },
  });

  await handleUnauthorizedResponse({ status: 401 });

  assert.deepEqual(queryCalls, [{ key: ["me"], value: null }]);
  assert.deepEqual(navigationCalls, [{ to: "/auth/login", replace: true }]);

  resetUnauthorizedRedirectForTests();
});

test("does not navigate again when the user is already on the login page", async () => {
  const navigationCalls: Array<{ to: string; replace: boolean }> = [];

  configureUnauthorizedRedirect({
    getCurrentPathname: () => "/auth/login",
    navigate: async ({ replace, to }) => {
      navigationCalls.push({ to, replace });
    },
    setQueryData: () => undefined,
  });

  await handleUnauthorizedResponse({ status: 401 });

  assert.deepEqual(navigationCalls, []);

  resetUnauthorizedRedirectForTests();
});

test("clears auth state without redirecting when the request opts out", async () => {
  const queryCalls: Array<{ key: readonly string[]; value: unknown }> = [];
  const navigationCalls: Array<{ to: string; replace: boolean }> = [];

  configureUnauthorizedRedirect({
    getCurrentPathname: () => "/",
    navigate: async ({ replace, to }) => {
      navigationCalls.push({ to, replace });
    },
    setQueryData: (key, value) => {
      queryCalls.push({ key, value });
    },
  });

  await handleUnauthorizedResponse({
    status: 401,
    skipUnauthorizedRedirect: true,
  });

  assert.deepEqual(queryCalls, [{ key: ["me"], value: null }]);
  assert.deepEqual(navigationCalls, []);

  resetUnauthorizedRedirectForTests();
});

test("ignores non-401 errors", async () => {
  let redirected = false;

  configureUnauthorizedRedirect({
    getCurrentPathname: () => "/dashboard",
    navigate: async () => {
      redirected = true;
    },
    setQueryData: () => undefined,
  });

  await handleUnauthorizedResponse({ status: 500 });

  assert.equal(redirected, false);

  resetUnauthorizedRedirectForTests();
});
