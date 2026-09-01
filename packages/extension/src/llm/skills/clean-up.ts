import { z } from "zod";
import type { Skill, SkillContext, JSONSchema } from "../provider";

export interface TabInfo {
  title: string;
  url: string;
}

export interface RabbitholeGroup {
  topic: string;
  description: string;
  tabIndices: number[];
}

export interface CleanUpInput {
  tabs: TabInfo[];
}

export interface CleanUpOutput {
  rabbitholes: RabbitholeGroup[];
}

const schema: JSONSchema = {
  type: "object",
  properties: {
    rabbitholes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          description: { type: "string" },
          tabIndices: { type: "array", items: { type: "number" } },
        },
        required: ["topic", "description", "tabIndices"],
      },
    },
  },
  required: ["rabbitholes"],
};

const validator = z.object({
  rabbitholes: z.array(
    z.object({
      topic: z.string(),
      description: z.string(),
      tabIndices: z.array(z.number()),
    }),
  ),
});

export const cleanUpSkill: Skill<CleanUpInput, CleanUpOutput> = {
  name: "clean-up",

  buildContext(input: CleanUpInput): SkillContext<CleanUpOutput> {
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

    return {
      systemPrompt:
        "You are a helpful assistant that groups browser tabs into topic-based rabbitholes. Tabs about the same topic should be grouped together. A tab can only belong to one rabbithole.",
      userPrompt: `Here are my ${input.tabs.length} open tabs:\n\n${tabList}\n\nGroup these tabs into rabbitholes based on their topic. Each rabbithole should contain tabs that are related to each other. Return the tab indices (0-based) for each group.`,
      schema,
      validator,
      maxTokens: 2048,
    };
  },
};
