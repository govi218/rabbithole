import { runSkill } from "./provider";
import type { CloudProviderConfig } from "./cloud";
import { proposeSkill } from "./skills/propose";
import type { TabInfo, RabbitholeContext } from "../utils/types";
import type { Candidate } from "./skills/propose";
import { runJevAssignment } from "./jev";

export interface PipelineInput {
  tabs: TabInfo[];
  existingRabbitholes: RabbitholeContext[];
  // pre-seeded candidates (tab groups, user-added), exempt from dissolve
  fixedCandidates: Candidate[];
  cloudConfig?: CloudProviderConfig;
}

export interface PipelineOutput {
  candidates: Candidate[];
  assignments: Record<string, number[]>;
}

const maxProposed = 24;

export async function runCategorisePipeline(
  input: PipelineInput,
): Promise<PipelineOutput> {
  const { tabs, existingRabbitholes, fixedCandidates, cloudConfig } = input;
  const fixedKeys = new Set(fixedCandidates.map((c) => c.key));
  const existingIds = new Set(existingRabbitholes.map((rh) => rh.id));

  const proposed = await runSkill(
    proposeSkill,
    { tabs, existingRabbitholes },
    { cloudConfig },
  );
  const seenKeys = new Set<string>();
  const allCandidates: Candidate[] = [
    ...fixedCandidates,
    ...proposed.data.candidates.slice(0, maxProposed).map((c) => {
      const sanitized =
        c.existingId && !existingIds.has(c.existingId)
          ? { ...c, existingId: undefined }
          : c;
      let key = `r1-${sanitized.key}`;
      let suffix = 2;
      while (seenKeys.has(key)) {
        key = `r1-${sanitized.key}-${suffix}`;
        suffix += 1;
      }
      seenKeys.add(key);
      return { ...sanitized, key };
    }),
  ];

  const assignment = await runJevAssignment({
    tabs,
    candidates: allCandidates,
  });
  const assignments: Record<string, number[]> = {};
  for (const [key, indices] of assignment.assignments) {
    assignments[key] = indices;
  }

  const canonical: Candidate[] = [];
  const titleToKey = new Map<string, string>();
  for (const c of allCandidates) {
    const norm = c.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const existingKey = titleToKey.get(norm);
    if (existingKey === undefined) {
      titleToKey.set(norm, c.key);
      canonical.push(c);
    } else if (assignments[c.key]) {
      assignments[existingKey] = [
        ...(assignments[existingKey] ?? []),
        ...assignments[c.key],
      ];
      delete assignments[c.key];
    }
  }

  for (const c of canonical) {
    if (
      assignments[c.key]?.length === 1 &&
      !fixedKeys.has(c.key) &&
      !c.existingId
    ) {
      delete assignments[c.key];
    }
  }

  return {
    candidates: canonical.filter((c) => assignments[c.key]?.length),
    assignments,
  };
}
