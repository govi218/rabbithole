import { json } from "@sveltejs/kit";
import { extractOpenGraphData } from "@rabbithole/shared/utils/og";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const target = url.searchParams.get("url");
  if (!target) return json({ error: "Missing url" }, { status: 400 });

  try {
    const res = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Rabbithole/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return json({ title: null, image: null, description: null });
    const html = await res.text();
    return json(extractOpenGraphData(html));
  } catch {
    return json({ title: null, image: null, description: null });
  }
};
