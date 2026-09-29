import type { Candidate } from "./skills/propose";

export interface JevAssignmentInput {
  tabs: {
    title: string;
    url: string;
    windowId?: number;
    ogDescription?: string;
  }[];
  candidates: Candidate[];
  /** if omitted, falls back to the chrome.storage key */
  apiKey?: string;
}

export interface JevAnswer {
  choice?: string;
}

export interface JevAssignmentOutput {
  assignments: Map<string, number[]>; // candidate key → tab indices
}

export async function runJevAssignment(
  input: JevAssignmentInput,
): Promise<JevAssignmentOutput> {
  const apiKey =
    input.apiKey ??
    (await chrome.storage.local.get(["cloudApiKey"])).cloudApiKey ??
    "";
  if (!apiKey) {
    throw new Error("No OpenRouter API key configured");
  }

  const { tabs, candidates } = input;

  const hasWindows = tabs.some((t) => t.windowId !== undefined);
  const windowTags = new Map<number, string>();
  if (hasWindows) {
    let nextWindow = 1;
    for (const t of tabs) {
      if (t.windowId !== undefined && !windowTags.has(t.windowId)) {
        windowTags.set(t.windowId, `w${nextWindow}`);
        nextWindow++;
      }
    }
  }

  const tabList = tabs
    .map((t, i) => {
      let host = t.url;
      try {
        const u = new URL(t.url);
        host = `${u.hostname}${u.pathname.slice(0, 60)}`;
      } catch {}
      const tag =
        hasWindows && t.windowId !== undefined
          ? ` [${windowTags.get(t.windowId)}]`
          : "";
      return `${i}. ${host} - ${t.title}${tag}`;
    })
    .join("\n");

  const criteria: Record<string, string> = {};
  for (const c of candidates) {
    criteria[c.key] = c.title;
  }

  const state =
    "Open browser tabs to be sorted into rabbitholes:\n\n" +
    tabList +
    (hasWindows
      ? "\n\nTabs with the same [wN] tag were open in the same browser window and often belong to the same activity — treat that as a hint, not a rule."
      : "") +
    "\n\nCandidate rabbitholes:\n" +
    candidates
      .map((c) => `- ${c.key}: ${c.title} — ${c.description}`)
      .join("\n");

  const questions: Record<
    string,
    { type: string; instructions: string; criteria: Record<string, string> }
  > = {};
  for (let i = 0; i < tabs.length; i++) {
    const tag =
      hasWindows && tabs[i].windowId !== undefined
        ? ` [${windowTags.get(tabs[i].windowId!)}]`
        : "";
    questions[`tab_${i}`] = {
      type: "choice",
      instructions: `Tab ${i}${tag} "${tabs[i].title.slice(0, 80)}"${tabs[i].ogDescription ? ` — ${tabs[i].ogDescription.slice(0, 150)}` : ""} — which rabbithole?`,
      criteria,
    };
  }

  // Jev's 32k context can't hold criteria (duplicated per question) for a
  // large tab set in one request — batch the questions and merge answers.
  const batchSize = 50;
  const indices = Object.keys(questions);
  const answers: Record<string, JevAnswer> = {};
  for (let b = 0; b < indices.length; b += batchSize) {
    const batchQuestions: typeof questions = {};
    for (const key of indices.slice(b, b + batchSize)) {
      batchQuestions[key] = questions[key];
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
        questions: batchQuestions,
      }),
    });

    if (!res.ok) {
      throw new Error(`Jev API error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    Object.assign(answers, data.answers ?? {});
  }

  const assignments = new Map<string, number[]>();

  for (const [key, answer] of Object.entries(answers)) {
    const i = Number(key.split("_")[1]);
    if (!Number.isInteger(i) || i < 0 || i >= tabs.length) {
      continue;
    }
    const choice = answer?.choice;
    if (choice && criteria[choice]) {
      if (!assignments.has(choice)) {
        assignments.set(choice, []);
      }
      assignments.get(choice)!.push(i);
    }
  }

  // dissolve singleton assignments; user-added candidates are exempt
  const userAddedKeys = new Set(
    candidates.filter((c) => c.userAdded).map((c) => c.key),
  );
  for (const [key, indices] of assignments) {
    if (indices.length < 2 && !userAddedKeys.has(key)) {
      assignments.delete(key);
    }
  }

  return { assignments };
}
