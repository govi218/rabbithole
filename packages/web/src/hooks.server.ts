import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  if (pathname.startsWith("/ingest")) {
    const useAssetHost =
      pathname.startsWith("/ingest/static/") ||
      pathname.startsWith("/ingest/array/");
    const hostname = useAssetHost
      ? "us-assets.i.posthog.com"
      : "us.i.posthog.com";

    const url = new URL(event.request.url);
    url.protocol = "https:";
    url.hostname = hostname;
    url.port = "443";
    url.pathname = pathname.replace(/^\/ingest/, "");

    const headers = new Headers(event.request.headers);
    headers.set("host", hostname);
    headers.set("accept-encoding", "");

    const clientIp =
      event.request.headers.get("x-forwarded-for") || event.getClientAddress();
    if (clientIp) {
      headers.set("x-forwarded-for", clientIp);
    }

    const response = await fetch(url.toString(), {
      method: event.request.method,
      headers,
      body: event.request.body,
      // @ts-expect-error - duplex is required for streaming request bodies
      duplex: "half",
    });

    return response;
  }

  return resolve(event);
};
