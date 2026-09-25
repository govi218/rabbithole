// Regression tests for the two-stage categorise pipeline (Rerun path).
// Stubs chrome.storage and fetch — no network.
import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchCalls: any[] = [];

// @ts-ignore
globalThis.chrome = {
  storage: {
    local: {
      get: async () => ({ cloudApiKey: "test-key" }),
    },
  },
} as any;

// @ts-ignore
globalThis.fetch = vi.fn(async (_url: string, opts: any) => {
  const body = JSON.parse(opts.body);
  fetchCalls.push(body);
  const answers: Record<string, any> = {};
  for (const q of Object.keys(body.questions)) {
    answers[q] = {
      choice: q === "tab_0" || q === "tab_1" ? "user-added-rhole" : "misc",
    };
  }
  return { ok: true, json: async () => ({ answers }) } as any;
});

import { runJevAssignment } from "../src/llm/jev";
import type { Candidate } from "../src/llm/skills/propose";

describe("jev assignment", () => {
  beforeEach(() => {
    fetchCalls.length = 0;
  });

  it("assigns tabs to a user-added candidate (no existingId, slug key)", async () => {
    const tabs = [
      { title: "Tab A", url: "https://a.com" },
      { title: "Tab B", url: "https://b.com" },
      { title: "Tab C", url: "https://c.com" },
    ];
    const candidates: Candidate[] = [
      {
        key: "atproto-oidc",
        title: "ATProto OIDC",
        description: "d",
        existingId: "r1",
      },
      { key: "user-added-rhole", title: "User Added Rhole", description: "d" },
    ];
    const result = await runJevAssignment({ tabs, candidates });

    // background mapping (same code as RUN_ASSIGNMENT handler)
    const assignments: any[] = [];
    const newRabbitholes: any[] = [];
    for (const [key, indices] of result.assignments) {
      const candidate = candidates.find((c) => c.key === key);
      if (!candidate) {
        continue;
      }
      if (candidate.existingId) {
        assignments.push({
          rabbitholeId: candidate.existingId,
          rabbitholeTitle: candidate.title,
          tabIndices: indices,
        });
      } else {
        newRabbitholes.push({
          topic: candidate.title,
          description: candidate.description,
          tabIndices: indices,
        });
      }
    }

    expect(newRabbitholes).toHaveLength(1);
    expect(newRabbitholes[0].topic).toBe("User Added Rhole");
    expect(newRabbitholes[0].tabIndices).toEqual([0, 1]);
    expect(result.misc).toEqual([2]);
  });

  it("sends unique criteria keys — collisions would silently collapse", async () => {
    const candidates: Candidate[] = [
      {
        key: "decentralized-ident",
        title: "Decentralized Identity and Mesh Networking",
        description: "d",
      },
      {
        key: "decentralized-ident-2",
        title: "Decentralized Identity for Apps",
        description: "d",
      },
    ];
    const tabs = [{ title: "T", url: "https://a.com" }];
    await runJevAssignment({ tabs, candidates });

    const criteriaKeys = Object.keys(fetchCalls[0].questions.tab_0.criteria);
    expect(criteriaKeys).toContain("decentralized-ident");
    expect(criteriaKeys).toContain("decentralized-ident-2");
    expect(criteriaKeys).toHaveLength(candidates.length + 1); // + misc
  });
});
