import { createRecord, deleteRecord, listRecords, putRecord } from "./client";
import type { Trail } from "../utils/types";

export interface SidetrailRef {
  uri: string;
  cid: string;
}

/**
 * Publish or update a Trail as an app.sidetrail.trail record.
 */
export async function publishTrail(
  did: string,
  trail: Trail,
  existingRkey?: string,
  existingCid?: string,
): Promise<SidetrailRef> {
  const stops = trail.stops.map((stop) => ({
    tid: stop.tid,
    title: stop.title,
    content: stop.note || "",
    buttonText: stop.buttonText || "Next",
    external: {
      uri: stop.websiteUrl,
    },
  }));

  const record = {
    $type: "app.sidetrail.trail",
    title: trail.name,
    description: trail.description || trail.startNote || "",
    stops,
  };

  if (existingRkey && existingCid) {
    return await putRecord(
      did,
      "app.sidetrail.trail",
      existingRkey,
      record,
      existingCid,
    );
  }

  return await createRecord(did, "app.sidetrail.trail", record);
}

/**
 * Start a walk on a trail — creates an app.sidetrail.walk record.
 */
export async function startSidetrailWalk(
  did: string,
  trailUri: string,
  trailCid: string,
  firstStopTid: string,
): Promise<SidetrailRef> {
  const record = {
    $type: "app.sidetrail.walk",
    trail: {
      uri: trailUri,
      cid: trailCid,
    },
    visitedStops: [firstStopTid],
  };

  return await createRecord(did, "app.sidetrail.walk", record);
}

/**
 * Advance a walk — updates the walk record with the next stop TID appended.
 */
export async function advanceSidetrailWalk(
  did: string,
  walkRkey: string,
  walkCid: string | undefined,
  trailUri: string,
  trailCid: string,
  visitedStops: string[],
): Promise<SidetrailRef> {
  const record = {
    $type: "app.sidetrail.walk",
    trail: {
      uri: trailUri,
      cid: trailCid,
    },
    visitedStops,
  };

  return await putRecord(
    did,
    "app.sidetrail.walk",
    walkRkey,
    record,
    walkCid,
  );
}

/**
 * Complete a walk — deletes the walk record and creates a completion record.
 */
export async function completeSidetrailWalk(
  did: string,
  walkRkey: string,
  trailUri: string,
  trailCid: string,
): Promise<SidetrailRef> {
  await deleteRecord(did, "app.sidetrail.walk", walkRkey);

  const record = {
    $type: "app.sidetrail.completion",
    trail: {
      uri: trailUri,
      cid: trailCid,
    },
  };

  return await createRecord(did, "app.sidetrail.completion", record);
}

/**
 * Abandon a walk — just deletes the walk record.
 */
export async function abandonSidetrailWalk(
  did: string,
  walkRkey: string,
): Promise<void> {
  await deleteRecord(did, "app.sidetrail.walk", walkRkey);
}

/**
 * Find an existing sidetrail walk record for a given trail URI.
 * Returns the walk record (uri, cid, value) or null if not found.
 */
export async function getExistingSidetrailWalk(
  did: string,
  trailUri: string,
): Promise<{ uri: string; cid: string; value: any } | null> {
  const res = await listRecords(did, "app.sidetrail.walk");
  const match = res.records.find((r: any) => r.value.trail?.uri === trailUri);
  return match ?? null;
}

/**
 * Find an existing published sidetrail trail record by matching title.
 * Returns the record or null.
 */
export async function getExistingSidetrailTrail(
  did: string,
  trailName: string,
): Promise<{ uri: string; cid: string; value: any } | null> {
  const res = await listRecords(did, "app.sidetrail.trail");
  const match = res.records.find((r: any) => r.value.title === trailName);
  return match ?? null;
}
