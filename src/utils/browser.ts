import { Logger } from "./index";
import { WebsiteStore } from "../storage/db";
import type { Website } from "./types";

export function extractOpenGraphData(html: string): {
  title: string | null;
  image: string | null;
  description: string | null;
} {
  let title: string | null = null;
  let image: string | null = null;
  let description: string | null = null;

  // Extract Open Graph title
  const titleMatch = html.match(
    /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
  );
  if (titleMatch) {
    title = titleMatch[1];
  }

  // Extract Open Graph image
  const imageMatch = html.match(
    /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
  );
  if (imageMatch) {
    image = imageMatch[1];
  }

  // Extract Open Graph description
  const descriptionMatch = html.match(
    /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i,
  );
  if (descriptionMatch) {
    description = descriptionMatch[1];
  }

  // Fallback 1: Standard meta description
  if (!description) {
    const metaDescriptionMatch = html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
    );
    if (metaDescriptionMatch) {
      description = metaDescriptionMatch[1];
    }
  }

  // Fallback 2: Twitter card description
  if (!description) {
    const twitterDescMatch = html.match(
      /<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i,
    );
    if (twitterDescMatch) {
      description = twitterDescMatch[1];
    }
  }

  // Fallback 3: Extract first paragraph of meaningful text
  if (!description) {
    description = extractFirstParagraph(html);
  }

  // Fallback 4: Use title as description if available
  if (!description && title) {
    description = title;
  }

  // Fallback 5: Generic placeholder
  if (!description) {
    description = "No description available";
  }

  return { title, image, description };
}

export function extractFirstParagraph(html: string): string | null {
  // Remove script and style tags
  let cleaned = html.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
  cleaned = cleaned.replace(
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    "",
  );

  // Try to find first paragraph
  const pMatch = cleaned.match(
    /<p[^>]*>([^<]+(?:<[^/][^>]*>[^<]*<\/[^>]+>[^<]*)*)<\/p>/i,
  );
  if (pMatch) {
    // Strip remaining HTML tags and clean up
    const text = pMatch[1].replace(/<[^>]+>/g, "").trim();
    // Limit to reasonable length (e.g., 160 characters)
    return text.length > 160 ? text.substring(0, 157) + "..." : text;
  }

  // Fallback: Get any substantial text from body
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    const bodyText = bodyMatch[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (bodyText.length > 20) {
      return bodyText.length > 160
        ? bodyText.substring(0, 157) + "..."
        : bodyText;
    }
  }

  // Try to extract from any heading tags as last resort
  const headingMatch = cleaned.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i);
  if (headingMatch) {
    const text = headingMatch[1].trim();
    return text.length > 0 ? text : null;
  }

  return null;
}

export function isNewtabPage(url: string): boolean {
  // Chrome variants
  if (url.includes("chrome://newtab")) return true;
  // Firefox
  if (url.includes("about:newtab")) return true;
  // Edge
  if (url.includes("edge://newtab")) return true;
  // Brave
  if (url.includes("brave://newtab")) return true;
  // Opera
  if (url.includes("opera://newtab")) return true;
  // Vivaldi
  if (url.includes("vivaldi://newtab")) return true;
  // Generic about:home for Firefox
  if (url.includes("about:home")) return true;

  return false;
}

/**
 * Returns true for URLs that are real http/https pages we can save.
 * Excludes browser internal pages, extension pages, new tab pages, etc.
 */
export function isValidWebUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (isNewtabPage(url)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function storeWebsites(
  tabs: chrome.tabs.Tab[],
  db: WebsiteStore,
): Promise<Website[]> {
  // Only keep real http/https pages — drop new-tab, chrome://, extension pages, etc.
  const validTabs = tabs.filter((tab) => isValidWebUrl(tab.url));

  if (validTabs.length === 0) {
    return [];
  }

  const websitesWithMetadata = await Promise.all(
    validTabs.map(async (tab) => {
      try {
        const response = await fetch(tab.url);
        const html = await response.text();
        const { title, image, description } = extractOpenGraphData(html);

        return {
          url: tab.url,
          name: tab.title ?? title,
          faviconUrl: tab.favIconUrl,
          savedAt: Date.now(),
          openGraphImageUrl: image,
          description: description ?? "",
        };
      } catch (error) {
        Logger.warn(`OG fetch failed for ${tab.url}, using fallback`, error);
        // Fallback to basic tab info
        return {
          url: tab.url,
          name: tab.title,
          savedAt: Date.now(),
          faviconUrl: tab.favIconUrl,
          openGraphImageUrl: null,
          description: "No description available",
        };
      }
    }),
  );

  await db.saveWebsites(websitesWithMetadata);
  return websitesWithMetadata;
}
