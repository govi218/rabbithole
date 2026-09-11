import { z } from "zod";
import type { Skill, SkillContext, JSONSchema } from "../provider";

export interface TabInfo {
  title: string;
  url: string;
  tabId?: number;
}

export interface ExistingRabbithole {
  id: string;
  title: string;
  content: string;
}

export interface RabbitholeAssignment {
  rabbitholeId: string;
  rabbitholeTitle: string;
  tabIndices: number[];
}

export interface NewRabbithole {
  topic: string;
  description: string;
  tabIndices: number[];
}

export interface CategoriseInput {
  tabs: TabInfo[];
  existingRabbitholes: ExistingRabbithole[];
}

export interface CategoriseOutput {
  assignments: RabbitholeAssignment[];
  newRabbitholes: NewRabbithole[];
  misc: number[];
}

const schema: JSONSchema = {
  type: "object",
  properties: {
    assignments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rabbitholeId: { type: "string" },
          rabbitholeTitle: { type: "string" },
          tabIndices: { type: "array", items: { type: "number" } },
        },
        required: ["rabbitholeId", "rabbitholeTitle", "tabIndices"],
      },
    },
    newRabbitholes: {
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
    misc: {
      type: "array",
      items: { type: "number" },
    },
  },
  required: ["assignments", "newRabbitholes", "misc"],
};

const validator = z.object({
  assignments: z.array(
    z.object({
      rabbitholeId: z.string(),
      rabbitholeTitle: z.string(),
      tabIndices: z.array(z.number()),
    }),
  ),
  newRabbitholes: z.array(
    z.object({
      topic: z.string(),
      description: z.string(),
      tabIndices: z.array(z.number()),
    }),
  ),
  misc: z.array(z.number()),
});

export const categoriseSkill: Skill<CategoriseInput, CategoriseOutput> = {
  name: "categorise",

  buildContext(input: CategoriseInput): SkillContext<CategoriseOutput> {
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
      "You are a helpful assistant that groups browser tabs into topic-based rabbitholes. " +
      "Tabs about the same topic should be grouped together. A tab can only belong to one rabbithole. " +
      "First, check if a tab fits into an existing rabbithole by comparing its title and URL to the rabbithole's title and content. " +
      "If it fits, assign it to that rabbithole by its ID. " +
      "If it doesn't fit any existing rabbithole but is related to other unmatched tabs, create a new rabbithole for them. " +
      "Only put a tab in misc if it is truly unrelated to all other tabs. " +
      "When in doubt, prefer creating a new rabbithole over putting tabs in misc — if 2+ tabs share a theme (same website, same topic, same domain), group them. " +
      "Tabs from the same domain or website should almost always be grouped together. Tabs about the same product, organization, or project should be grouped together. " +
      "Never leave 3+ tabs in misc if they share any common theme or keywords — always create a rabbithole for them. " +
      "Don't shoehorn websites into existing rabbitholes, there should be good evidence that the website belongs there. And for creating new ones, try to see if there is a common keyword/pattern/theme in a bunch of tabs that is not captured by anything existing. If the same keyword appears a bunch of times across tabs, they likely belong together. " +
      'When creating new rabbitholes, the topic should be a short, descriptive, HUMAN READABLE name of the theme (e.g. "Go Concurrency", "React Performance", "Olympic Results"). Do NOT prefix the topic with "Rabbithole" or include the word "rabbithole" in the topic name. Do NOT use generic placeholder names like "rabbithole_1" or "Group A".';

    const userPrompt =
      `Here are my ${input.tabs.length} open tabs:\n\n${tabList}\n` +
      existingSection +
      "\n\nGroup these tabs. For each tab:\n" +
      "1. If it matches an existing rabbithole, add its index to that rabbithole's assignment (use the rabbithole ID and include the rabbithole's title).\n" +
      "2. If it doesn't match any existing rabbithole but is related to other unmatched tabs, create a new rabbithole with a topic and description.\n" +
      "3. If it doesn't fit anywhere, add its index to the misc array.\n" +
      "Every tab index must appear exactly once across assignments, newRabbitholes, and misc.";

    return {
      systemPrompt,
      userPrompt,
      schema,
      validator,
      maxTokens: 2048,
    };
  },
};
