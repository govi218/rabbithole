export interface OgData {
  title: string | null;
  image: string | null;
  description: string | null;
}

export function extractOpenGraphData(html: string): OgData {
  let title: string | null = null;
  let image: string | null = null;
  let description: string | null = null;

  const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  if (titleMatch) title = titleMatch[1];

  const imageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (imageMatch) image = imageMatch[1];

  const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  if (descMatch) description = descMatch[1];

  if (!description) {
    const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (metaDesc) description = metaDesc[1];
  }

  if (!description) {
    const twitterDesc = html.match(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i);
    if (twitterDesc) description = twitterDesc[1];
  }

  return { title, image, description };
}
