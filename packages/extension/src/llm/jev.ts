// Jev decision model client (TypeSafe AI via OpenRouter)
// Used for stage-2 assignment in two-stage categorise pipeline

import type { Candidate } from "./skills/propose";

export interface JevAssignmentInput {
  tabs: { title: string; url: string }[];
  candidates: Candidate[];
}

export interface JevAnswer {
  choice?: string;
}

export interface JevAssignmentOutput {
  assignments: Map<string, number[]>; // candidate key → tab indices
  misc: number[];
}

export async function runJevAssignment(
  input: JevAssignmentInput,
): Promise<JevAssignmentOutput> {
  const saved = await chrome.storage.local.get(["cloudApiKey"]);
  const apiKey = saved.cloudApiKey ?? "";
  if (!apiKey) {
    throw new Error("No OpenRouter API key configured");
  }

  const { tabs, candidates } = input;

  const tabList = tabs
    .map((t, i) => {
      let host = t.url;
      try {
        const u = new URL(t.url);
        host = `${u.hostname}${u.pathname.slice(0, 60)}`;
      } catch {
        // keep raw url
      }
      return `${i}. ${host} - ${t.title}`;
    })
    .join("\n");

  // criteria descriptions live in state; keep questions lean (key → title only)
  const criteria: Record<string, string> = {};
  for (const c of candidates) {
    criteria[c.key] = c.title;
  }
  criteria["misc"] = "No partner tab";

  const state =
    "Open browser tabs to be sorted into rabbitholes:\n\n" +
    tabList +
    "\n\nCandidate rabbitholes:\n" +
    candidates
      .map((c) => `- ${c.key}: ${c.title} — ${c.description}`)
      .join("\n");

  const questions: Record<
    string,
    { type: string; instructions: string; criteria: Record<string, string> }
  > = {};
  for (let i = 0; i < tabs.length; i++) {
    questions[`tab_${i}`] = {
      type: "choice",
      instructions: `Tab ${i} "${tabs[i].title.slice(0, 80)}" — which rabbithole? Pick "misc" if no partner.`,
      criteria,
    };
  }

  const res = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "typesafe/jev-1.13",
      state,
      questions,
    }),
  });

  if (!res.ok) {
    throw new Error(`Jev API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const answers: Record<string, JevAnswer> = data.answers ?? {};

  const assignments = new Map<string, number[]>();
  const misc: number[] = [];

  for (const [key, answer] of Object.entries(answers)) {
    const i = Number(key.split("_")[1]);
    if (!Number.isInteger(i) || i < 0 || i >= tabs.length) {
      continue;
    }
    const choice = answer?.choice ?? "misc";
    if (choice === "misc" || !criteria[choice]) {
      misc.push(i);
    } else {
      if (!assignments.has(choice)) {
        assignments.set(choice, []);
      }
      assignments.get(choice)!.push(i);
    }
  }

  return { assignments, misc };
}
