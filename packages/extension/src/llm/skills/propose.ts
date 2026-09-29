import { z } from "zod";
import type { Skill, SkillContext, JSONSchema } from "../provider";
import type { TabInfo, RabbitholeContext } from "../../utils/types";

export interface ProposeInput {
  tabs: TabInfo[];
  existingRabbitholes: RabbitholeContext[];
}

export interface Candidate {
  key: string;
  title: string;
  description: string;
  existingId?: string | null;
  userAdded?: boolean;
}

export interface ProposeOutput {
  candidates: Candidate[];
}

const schema: JSONSchema = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          existingId: { type: "string" },
        },
        required: ["key", "title", "description"],
      },
    },
  },
  required: ["candidates"],
};

const validator = z.object({
  candidates: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      description: z.string(),
      existingId: z.string().nullish(),
    }),
  ),
});

export const proposeSkill: Skill<ProposeInput, ProposeOutput> = {
  name: "propose",

  buildContext(input: ProposeInput): SkillContext<ProposeOutput> {
    const windowNumbers = new Map<number, number>();
    let nextWindow = 1;
    const hasWindows = input.tabs.some((t) => t.windowId !== undefined);

    const line = (t: TabInfo, i: number) => {
      let host = t.url;
      try {
        const u = new URL(t.url);
        host = `${u.hostname}${u.pathname}`;
      } catch {}
      let tag = "";
      if (hasWindows && t.windowId !== undefined) {
        if (!windowNumbers.has(t.windowId)) {
          windowNumbers.set(t.windowId, nextWindow);
          nextWindow++;
        }
        tag = ` [w${windowNumbers.get(t.windowId)}]`;
      }
      return `${i}. ${host} - ${t.title}${tag}`;
    };

    const tabList = input.tabs.map((t, i) => line(t, i)).join("\n");

    let existingSection = "";
    if (input.existingRabbitholes.length > 0) {
      existingSection = input.existingRabbitholes
        .map((rh) => {
          return `## ${rh.id}\nTitle: ${rh.title}\n${rh.content}`;
        })
        .join("\n\n");
      existingSection = `\n\nExisting rabbitholes:\n\n${existingSection}\n`;
    }

    const systemPrompt =
      "You propose topic groups for browser tabs. Output ONLY a JSON object: " +
      '{ "candidates": [{ "key": "short-kebab-key", "title": "Human Readable Title", "description": "one sentence" }] }. ' +
      "Find EVERY distinct project, activity, or research thread that has at least 2 related tabs. " +
      "Aim for roughly one candidate per 5-8 tabs — for a 150-tab list that means ~20-30 candidates. " +
      "Split by the actual project/topic (one per repo, event, or research thread), NOT by medium or site — " +
      "a GitHub repo's issues, a forum thread, and a blog post about one project are the SAME candidate. " +
      "NEVER propose a candidate for a lone tab with no partners — those go to misc. " +
      "Before finalizing, re-scan the tab list for clusters you missed — " +
      "recurring domains (e.g. many tabs from the same site), a shared subject across different sites, " +
      "or tabs about the same event/place are all candidates. " +
      "A typical 150+ tab list has 25+ distinct themes; if you found fewer than 20, you missed some. " +
      "Do not stop at the first few obvious themes — comb through EVERY tab and propose " +
      "as many candidates as the list supports; a large list should yield many candidates, not a handful. " +
      "Tabs tagged [wN] were open in the same browser window and often belong to the same " +
      "activity — use that as a hint, not a rule; the same theme can span multiple windows. " +
      "If a candidate matches an existing rabbithole, include its ID as `existingId`. " +
      "Do NOT assign tabs — just name the themes. Keys must be short and stable. No markdown, no commentary.";

    const userPrompt =
      `Here are ${input.tabs.length} open tabs:\n\n${tabList}` +
      existingSection +
      "\n\nPropose candidate rabbitholes for these tabs. " +
      "Each candidate should represent a distinct theme with 2+ related tabs. " +
      "If a theme matches an existing rabbithole, include its ID. " +
      "Do NOT include singleton themes — those will be handled separately.";

    return {
      systemPrompt,
      userPrompt,
      schema,
      validator,
      maxTokens: 4096,
    };
  },
};
