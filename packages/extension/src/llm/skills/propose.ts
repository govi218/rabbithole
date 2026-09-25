import { z } from "zod";
import type { Skill, SkillContext, JSONSchema } from "../provider";
import type { TabInfo, ExistingRabbithole } from "./categorise";

export interface ProposeInput {
  tabs: TabInfo[];
  existingRabbitholes: ExistingRabbithole[];
}

export interface Candidate {
  key: string;
  title: string;
  description: string;
  existingId?: string | null;
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
    const tabList = input.tabs
      .map((t, i) => {
        let host = t.url;
        try {
          const u = new URL(t.url);
          host = `${u.hostname}${u.pathname}`;
        } catch {
          // keep raw url if not parseable
        }
        return `${i}. ${host} - ${t.title}`;
      })
      .join("\n");

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
