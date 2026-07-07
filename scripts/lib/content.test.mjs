import test from "node:test";
import assert from "node:assert/strict";
import { urlForContent, validateEntry } from "./content.mjs";

function entry(data) {
  return {
    relativePath: "content/ideas/example.md",
    data: {
      title: "Example",
      slug: "example",
      type: "note",
      language: "en",
      status: "ready",
      channels: ["site"],
      ...data,
    },
  };
}

test("validates a basic site-only note", () => {
  assert.deepEqual(validateEntry(entry({})), []);
});

test("requires explicit WeChat publish gate when the WeChat channel is requested", () => {
  assert.deepEqual(validateEntry(entry({ channels: ["site", "wechat_mp"] })), [
    "wechat_mp.publish must be true or false when channel includes wechat_mp",
  ]);
});

test("maps content types to stable URLs", () => {
  assert.equal(urlForContent({ type: "note", slug: "quick-note" }), "/notes/quick-note/");
  assert.equal(urlForContent({ type: "essay", slug: "long-essay" }), "/writing/long-essay/");
  assert.equal(urlForContent({ type: "project", slug: "tool" }), "/projects/tool/");
  assert.equal(urlForContent({ type: "now", slug: "ignored" }), "/now/");
});

