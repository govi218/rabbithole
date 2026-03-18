import { Agent } from "@atproto/api";

export interface ActorTrail {
  uri: string;
  cid: string;
  title: string;
  description: string;
  stops: { url: string; note: string }[];
}

export interface ActorCollection {
  uri: string;
  cid: string;
  name: string;
  urls: string[];
}

export async function resolveHandle(handle: string): Promise<string> {
  const agent = new Agent("https://public.api.bsky.app");
  const res = await agent.resolveHandle({ handle });
  if (!res.success) throw new Error("Could not resolve handle");
  return res.data.did;
}

async function listPublicRecords(
  did: string,
  collection: string,
): Promise<{ uri: string; cid: string; value: any }[]> {
  // Use bsky.social public endpoint for unauthenticated record listing
  const pdsUrl = await resolvePds(did);
  const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
  url.searchParams.set("repo", did);
  url.searchParams.set("collection", collection);
  url.searchParams.set("limit", "100");
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = await res.json();
  return data.records ?? [];
}

async function resolvePds(did: string): Promise<string> {
  try {
    const res = await fetch(`https://plc.directory/${did}`);
    if (res.ok) {
      const doc = await res.json();
      const svc = doc.service?.find(
        (s: any) => s.id === "#atproto_pds" || s.type === "AtprotoPersonalDataServer",
      );
      if (svc) return svc.serviceEndpoint;
    }
  } catch {}
  return "https://bsky.social";
}

export async function fetchActorTrails(did: string): Promise<ActorTrail[]> {
  const records = await listPublicRecords(did, "app.sidetrail.trail");
  return records.map((r) => {
    const v = r.value as any;
    const stops = (v.stops ?? []).map((s: any) => ({
      url: s.external?.uri ?? "",
      note: s.content ?? "",
    })).filter((s: any) => s.url);
    return { uri: r.uri, cid: r.cid, title: v.title ?? "Untitled", description: v.description ?? "", stops };
  });
}

export async function fetchActorCollections(did: string): Promise<ActorCollection[]> {
  const [collectionsRes, linksRes, cardsRes] = await Promise.all([
    listPublicRecords(did, "network.cosmik.collection"),
    listPublicRecords(did, "network.cosmik.collectionLink"),
    listPublicRecords(did, "network.cosmik.card"),
  ]);

  const cardMap = new Map<string, string>();
  for (const card of cardsRes) {
    const url = (card.value as any).url as string | undefined;
    if (url) cardMap.set(card.uri, url);
  }

  const collectionUrls = new Map<string, string[]>();
  for (const link of linksRes) {
    const collUri = (link.value as any).collection?.uri as string | undefined;
    const cardUri = (link.value as any).card?.uri as string | undefined;
    if (!collUri || !cardUri) continue;
    const url = cardMap.get(cardUri);
    if (!url) continue;
    if (!collectionUrls.has(collUri)) collectionUrls.set(collUri, []);
    collectionUrls.get(collUri)!.push(url);
  }

  return collectionsRes.map((r) => ({
    uri: r.uri,
    cid: r.cid,
    name: (r.value as any).name ?? "Untitled",
    urls: collectionUrls.get(r.uri) ?? [],
  }));
}
