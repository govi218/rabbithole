import { PostHog } from "posthog-js/dist/module.no-external";

const PosthogApiKey = import.meta.env.VITE_POSTHOG_API_KEY;
const PosthogHost = import.meta.env.VITE_POSTHOG_HOST;
const DistinctIdKey = "posthog_distinct_id";

let posthog: PostHog | null = null;

async function getDistinctId(): Promise<string> {
  const stored = await chrome.storage.local.get([DistinctIdKey]);
  if (stored[DistinctIdKey]) {
    return stored[DistinctIdKey];
  }
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [DistinctIdKey]: id });
  return id;
}

export async function initPostHog(options?: {
  persistence?: "localStorage" | "sessionStorage" | "memory";
}) {
  if (posthog) {
    return posthog;
  }

  const distinctId = await getDistinctId();
  const ph = new PostHog();
  ph.init(PosthogApiKey, {
    api_host: PosthogHost,
    // No automatic data collection
    capture_pageview: false,
    autocapture: false,
    disable_session_recording: true,
    disable_surveys: true,
    // No external assets
    disable_external_dependency_loading: true,
    // Mask everything in case session recording ever gets enabled
    mask_all_text: true,
    mask_all_element_attributes: true,
    // Persistence
    persistence: options?.persistence ?? "localStorage",
  });
  // Explicitly set distinct ID so it persists across service worker restarts
  ph.identify(distinctId);
  posthog = ph;
  return ph;
}

export function getPostHog(): PostHog | null {
  return posthog;
}

export function capture(event: string, properties?: Record<string, unknown>) {
  if (posthog) {
    posthog.capture(event, properties);
  }
}

export function stopPostHog() {
  if (posthog) {
    try {
      posthog.reset();
      posthog.shutdown();
    } catch (err) {
      console.warn("PostHog shutdown failed", err);
    }
    posthog = null;
  }
}
