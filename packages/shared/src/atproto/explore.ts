import { Agent } from "@atproto/api";

const UFOS_API = "https://ufos-api.microcosm.blue";

export interface TrailStop {
  tid: string;
  title: string;
  note: string;
  url: string;        // empty string if no external URI
  buttonText: string;
}

export interface ActorTrail {
  uri: string;
  cid: string;
  title: string;
  description: string;
  stops: TrailStop[];
  accentColor?: string;
  backgroundColor?: string;
  authorHandle?: string;
  authorAvatar?: string;
  authorDid?: string;
  createdAt?: string;
}

export interface ActorCollectionCard {
  url: string;
  title?: string;
  image?: string;
  description?: string;
}

export interface ActorCollection {
  uri: string;
  cid: string;
  name: string;
  urls: string[];
  cards: ActorCollectionCard[];
}

export async function resolveHandle(handleOrDid: string): Promise<string> {
  if (handleOrDid.startsWith("did:")) return handleOrDid;
  const agent = new Agent("https://public.api.bsky.app");
  const handle = handleOrDid.startsWith("@") ? handleOrDid.slice(1) : handleOrDid;
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

export async function resolvePds(did: string): Promise<string> {
  try {
    const docUrl = did.startsWith("did:web:")
      ? `https://${did.slice("did:web:".length)}/.well-known/did.json`
      : `https://plc.directory/${did}`;
    const res = await fetch(docUrl);
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
    const stops = (v.stops ?? []).map((s: any, i: number) => ({
      tid: s.tid ?? `stop-${i}`,
      title: s.title ?? "",
      note: s.content ?? "",
      url: s.external?.uri ?? "",
      buttonText: s.buttonText ?? "Next",
    }));
    return { uri: r.uri, cid: r.cid, title: v.title ?? "Untitled", description: v.description ?? "", accentColor: v.accentColor, backgroundColor: v.backgroundColor, stops, createdAt: v.createdAt };
  });
}

export interface ActorCollectionWithAuthor extends ActorCollection {
  authorHandle?: string;
  authorAvatar?: string;
  authorDid?: string;
  createdAt?: string;
}

export async function fetchLatestCollections(): Promise<ActorCollectionWithAuthor[]> {
  const res = await fetch(`${UFOS_API}/records?collection=network.cosmik.collection`);
  if (!res.ok) throw new Error("Failed to fetch latest collections");
  const records: any[] = await res.json();

  const dids = [...new Set(records.map((r) => r.did))];
  const profileMap = new Map<string, { handle: string; avatar?: string }>();
  const agent = new Agent("https://public.api.bsky.app");
  const chunks = [];
  for (let i = 0; i < dids.length; i += 25) chunks.push(dids.slice(i, i + 25));
  await Promise.all(chunks.map(async (chunk) => {
    try {
      const res = await agent.getProfiles({ actors: chunk });
      for (const p of res.data.profiles) profileMap.set(p.did, { handle: p.handle, avatar: p.avatar });
    } catch {}
  }));

  return records.map((r) => {
    const profile = profileMap.get(r.did);
    return {
      uri: `at://${r.did}/${r.collection}/${r.rkey}`,
      cid: "",
      name: r.record.name ?? "Untitled",
      urls: [],
      cards: [],
      authorDid: r.did,
      authorHandle: profile?.handle,
      authorAvatar: profile?.avatar,
      createdAt: r.indexedAt ?? r.record.createdAt,
    };
  });
}

export async function fetchLatestTrails(): Promise<ActorTrail[]> {
  const res = await fetch(`${UFOS_API}/records?collection=app.sidetrail.trail`);
  if (!res.ok) throw new Error("Failed to fetch latest trails");
  const records: any[] = await res.json();

  // batch fetch profiles for all unique DIDs (bsky allows 25 per request)
  const dids = [...new Set(records.map((r) => r.did))];
  const profileMap = new Map<string, { handle: string; avatar?: string }>();
  const agent = new Agent("https://public.api.bsky.app");
  const chunks = [];
  for (let i = 0; i < dids.length; i += 25) chunks.push(dids.slice(i, i + 25));
  await Promise.all(chunks.map(async (chunk) => {
    try {
      const res = await agent.getProfiles({ actors: chunk });
      for (const p of res.data.profiles) {
        profileMap.set(p.did, { handle: p.handle, avatar: p.avatar });
      }
    } catch {}
  }));

  return records.map((r) => {
    const profile = profileMap.get(r.did);
    return {
      uri: `at://${r.did}/${r.collection}/${r.rkey}`,
      cid: "",
      title: r.record.title ?? "Untitled",
      description: r.record.description ?? "",
      stops: (r.record.stops ?? [])
        .map((s: any, i: number) => ({ tid: s.tid ?? `stop-${i}`, title: s.title ?? "", note: s.content ?? "", url: s.external?.uri ?? "", buttonText: s.buttonText ?? "Next" })),
      accentColor: r.record.accentColor,
      backgroundColor: r.record.backgroundColor,
      authorDid: r.did,
      authorHandle: profile?.handle,
      authorAvatar: profile?.avatar,
      createdAt: r.indexedAt ?? r.record.createdAt,
    };
  });
}

export async function fetchTrailByUri(uri: string): Promise<ActorTrail | null> {
  const match = uri.match(/^at:\/\/(did:[^/]+)\/[^/]+\/([^/]+)$/);
  if (!match) return null;
  const [, did, rkey] = match;
  const pdsUrl = await resolvePds(did);
  const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.getRecord`);
  url.searchParams.set("repo", did);
  url.searchParams.set("collection", "app.sidetrail.trail");
  url.searchParams.set("rkey", rkey);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const r = await res.json();
  const v = r.value as any;
  const agent = new Agent("https://public.api.bsky.app");
  let authorHandle: string | undefined;
  let authorAvatar: string | undefined;
  try {
    const profileRes = await agent.getProfile({ actor: did });
    if (profileRes.success) { authorHandle = profileRes.data.handle; authorAvatar = profileRes.data.avatar; }
  } catch {}
  return {
    uri,
    cid: r.cid ?? "",
    title: v.title ?? "Untitled",
    description: v.description ?? "",
    stops: (v.stops ?? [])
      .map((s: any, i: number) => ({ tid: s.tid ?? `stop-${i}`, title: s.title ?? "", note: s.content ?? "", url: s.external?.uri ?? "", buttonText: s.buttonText ?? "Next" })),
    accentColor: v.accentColor,
    backgroundColor: v.backgroundColor,
    authorDid: did,
    authorHandle,
    authorAvatar,
    createdAt: v.createdAt,
  };
}

export async function fetchCollectionByUri(uri: string): Promise<ActorCollection | null> {
  const match = uri.match(/^at:\/\/(did:[^/]+)\/[^/]+\/([^/]+)$/);
  if (!match) return null;
  const [, did, rkey] = match;
  const pdsUrl = await resolvePds(did);

  const collUrl = new URL(`${pdsUrl}/xrpc/com.atproto.repo.getRecord`);
  collUrl.searchParams.set("repo", did);
  collUrl.searchParams.set("collection", "network.cosmik.collection");
  collUrl.searchParams.set("rkey", rkey);
  const collRes = await fetch(collUrl.toString());
  if (!collRes.ok) return null;
  const collData = await collRes.json();

  const [linksRes, cardsRes] = await Promise.all([
    listPublicRecords(did, "network.cosmik.collectionLink"),
    listPublicRecords(did, "network.cosmik.card"),
  ]);

  const cardMap = new Map<string, ActorCollectionCard>();
  for (const card of cardsRes) {
    const content = (card.value as any).content;
    const url = content?.url as string | undefined;
    if (url) cardMap.set(card.uri, {
      url,
      title: content?.metadata?.title ?? undefined,
      image: content?.metadata?.imageUrl ?? undefined,
      description: content?.metadata?.description ?? undefined,
    });
  }

  const cards: ActorCollectionCard[] = [];
  for (const link of linksRes) {
    if ((link.value as any).collection?.uri !== uri) continue;
    const cardUri = (link.value as any).card?.uri as string | undefined;
    if (!cardUri) continue;
    const card = cardMap.get(cardUri);
    if (card) cards.push(card);
  }

  return { uri, cid: collData.cid ?? "", name: collData.value?.name ?? "Untitled", urls: cards.map(c => c.url), cards };
}

export async function fetchActorCollections(did: string): Promise<ActorCollection[]> {
  const [collectionsRes, linksRes, cardsRes] = await Promise.all([
    listPublicRecords(did, "network.cosmik.collection"),
    listPublicRecords(did, "network.cosmik.collectionLink"),
    listPublicRecords(did, "network.cosmik.card"),
  ]);

  const cardMap = new Map<string, ActorCollectionCard>();
  for (const card of cardsRes) {
    const content = (card.value as any).content;
    const url = content?.url as string | undefined;
    if (url) cardMap.set(card.uri, {
      url,
      title: content?.metadata?.title ?? undefined,
      image: content?.metadata?.imageUrl ?? undefined,
      description: content?.metadata?.description ?? undefined,
    });
  }

  const collectionCards = new Map<string, ActorCollectionCard[]>();
  for (const link of linksRes) {
    const collUri = (link.value as any).collection?.uri as string | undefined;
    const cardUri = (link.value as any).card?.uri as string | undefined;
    if (!collUri || !cardUri) continue;
    const card = cardMap.get(cardUri);
    if (!card) continue;
    if (!collectionCards.has(collUri)) collectionCards.set(collUri, []);
    collectionCards.get(collUri)!.push(card);
  }

  return collectionsRes.map((r) => {
    const cards = collectionCards.get(r.uri) ?? [];
    return { uri: r.uri, cid: r.cid, name: (r.value as any).name ?? "Untitled", urls: cards.map(c => c.url), cards };
  });
}
