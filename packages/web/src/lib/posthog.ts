import posthog from "posthog-js";

const PosthogApiKey = import.meta.env.PUBLIC_POSTHOG_PROJECT_TOKEN;
const PosthogHost = import.meta.env.PUBLIC_POSTHOG_HOST;

const ConsentKey = "rabbithole_analytics_consent";

export function getConsent(): boolean | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = localStorage.getItem(ConsentKey);
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

export function setConsent(consent: boolean) {
  localStorage.setItem(ConsentKey, String(consent));
  if (consent) {
    initPostHog();
  } else {
    posthog.shutdown();
  }
}

export function initPostHog() {
  if (!PosthogApiKey) {
    return;
  }
  if (getConsent() !== true) {
    return;
  }
  posthog.init(PosthogApiKey, {
    api_host: PosthogHost,
    // No automatic data collection
    capture_pageview: false,
    autocapture: false,
    disable_session_recording: true,
    disable_surveys: true,
    // Mask everything in case session recording ever gets enabled
    mask_all_text: true,
    mask_all_element_attributes: true,
  });
}

export function capture(event: string, properties?: Record<string, unknown>) {
  if (getConsent() !== true) {
    return;
  }
  posthog.capture(event, properties);
}

export function resetPostHog() {
  if (getConsent() !== true) {
    return;
  }
  posthog.reset();
}
