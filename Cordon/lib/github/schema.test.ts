import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { githubRepositoryUrlSchema } from "./schema";

describe("GitHub URL validation", () => {
  it("normalizes a public repository root URL", () => {
    assert.deepEqual(githubRepositoryUrlSchema.parse("https://github.com/openai/openai-node.git"), {
      owner: "openai",
      name: "openai-node",
      url: "https://github.com/openai/openai-node",
    });
  });

  it("rejects unsafe or unsupported URLs", () => {
    for (const value of [
      "http://github.com/openai/openai-node",
      "https://gitlab.com/openai/openai-node",
      "https://github.com/openai/openai-node/tree/main",
      "https://user:pass@github.com/openai/openai-node",
    ]) {
      assert.throws(() => githubRepositoryUrlSchema.parse(value));
    }
  });
});
