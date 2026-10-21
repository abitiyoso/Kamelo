import test from "node:test";
import assert from "node:assert/strict";
import { privacyNext } from "../lib/privacy-rules.mjs";
test("privacy responses require review while withdrawal and reconsideration remain account-controlled", () => {
  assert.equal(
    privacyNext(true, "review", "SUBMITTED", "IN_REVIEW"),
    "IN_REVIEW",
  );
  assert.equal(privacyNext(false, "reply", "NEEDS_INFORMATION"), "IN_REVIEW");
  assert.equal(
    privacyNext(true, "review", "IN_REVIEW", "RESPONDED"),
    "RESPONDED",
  );
  assert.equal(privacyNext(false, "reopen", "RESPONDED"), "SUBMITTED");
  assert.equal(privacyNext(false, "cancel", "SUBMITTED"), "CANCELLED");
  for (const args of [
    [true, "review", "SUBMITTED", "RESPONDED"],
    [false, "review", "IN_REVIEW", "RESPONDED"],
    [true, "cancel", "SUBMITTED"],
    [true, "reopen", "DECLINED"],
    [false, "reply", "CANCELLED"],
  ])
    assert.throws(() => privacyNext(...args));
});
test("privacy review never accepts deletion/execution/account-closure claims as workflow states", () => {
  for (const desired of [
    "DELETED",
    "ERASED",
    "CLOSED",
    "EXECUTED",
    "ACCOUNT_DISABLED",
  ])
    assert.throws(() => privacyNext(true, "review", "IN_REVIEW", desired));
});
