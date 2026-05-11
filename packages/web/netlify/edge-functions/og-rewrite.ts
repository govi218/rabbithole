import type { Context } from "https://edge.netlify.com/";

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Match /trail/@handle/rkey or /burrow/@handle/rkey (optional trailing slash)
  const trailMatch = path.match(/^\/trail\/@([^/]+)\/([^/]+)\/?$/);
  const burrowMatch = path.match(/^\/burrow\/@([^/]+)\/([^/]+)\/?$/);
  const match = trailMatch || burrowMatch;
  if (!match) return context.next();

  const [, handle, rkey] = match;
  const isTrail = !!trailMatch;

  // Debug: verify edge function is running
  console.log(`og-rewrite: path=${path} handle=${handle} rkey=${rkey} isTrail=${isTrail}`);

  try {
    // Fetch the record directly from the AppView (accepts handles)
    const collection = isTrail
      ? "app.sidetrail.trail"
      : "network.cosmik.collection";
    const record = await fetchRecord(handle, collection, rkey);
    if (!record) return context.next();

    // Get the original HTML
    const response = await context.next();
    const html = await response.text();

    // Build OG values
    const title = isTrail
      ? (record.title ?? "Untitled Trail")
      : (record.name ?? "Untitled Burrow");
    const description = isTrail
      ? record.description || `A trail by @${handle}`
      : `A burrow by @${handle}`;

    // Replace OG meta tags
    const rewritten = html
      .replace(
        /<meta property="og:title" content="[^"]*"/,
        `<meta property="og:title" content="${escapeAttr(title)}"`,
      )
      .replace(
        /<meta property="og:description" content="[^"]*"/,
        `<meta property="og:description" content="${escapeAttr(description)}"`,
      )
      .replace(
        /<meta name="twitter:title" content="[^"]*"/,
        `<meta name="twitter:title" content="${escapeAttr(title)}"`,
      )
      .replace(
        /<meta name="twitter:description" content="[^"]*"/,
        `<meta name="twitter:description" content="${escapeAttr(description)}"`,
      )
      .replace(
        /<title>[^<]*<\/title>/,
        `<title>${escapeHtml(title)} — Rabbithole</title>`,
      );

    return new Response(rewritten, {
      status: response.status,
      headers: { ...Object.fromEntries(response.headers), "x-og-rewrite": "hit" },
    });
  } catch {
    // On any error, just serve the original page
    return context.next();
  }
};

async function fetchRecord(
  repo: string,
  collection: string,
  rkey: string,
): Promise<any | null> {
  try {
    const url = new URL(
      "https://public.api.bsky.app/xrpc/com.atproto.repo.getRecord",
    );
    url.searchParams.set("repo", repo);
    url.searchParams.set("collection", collection);
    url.searchParams.set("rkey", rkey);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    return data.value ?? null;
  } catch {
    return null;
  }
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
