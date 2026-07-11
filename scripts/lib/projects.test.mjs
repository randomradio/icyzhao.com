import test from "node:test";
import assert from "node:assert/strict";
import { githubRepoFromUrl } from "./projects.mjs";

test("parses GitHub repo URLs", () => {
  assert.deepEqual(githubRepoFromUrl("https://github.com/randomradio/sheng-trading-journal"), {
    owner: "randomradio",
    name: "sheng-trading-journal",
    full_name: "randomradio/sheng-trading-journal",
  });
});

test("parses GitHub shorthand and SSH URLs", () => {
  assert.deepEqual(githubRepoFromUrl("randomradio/sheng-trading-journal"), {
    owner: "randomradio",
    name: "sheng-trading-journal",
    full_name: "randomradio/sheng-trading-journal",
  });
  assert.deepEqual(githubRepoFromUrl("git@github.com:randomradio/sheng-trading-journal.git"), {
    owner: "randomradio",
    name: "sheng-trading-journal",
    full_name: "randomradio/sheng-trading-journal",
  });
});

test("ignores non-GitHub repo URLs", () => {
  assert.equal(githubRepoFromUrl("https://gitlab.com/randomradio/example"), null);
  assert.equal(githubRepoFromUrl("not a url"), null);
});
