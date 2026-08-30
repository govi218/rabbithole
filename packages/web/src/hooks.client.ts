import posthog from "posthog-js";
import { PUBLIC_POSTHOG_PROJECT_TOKEN } from "$env/static/public";
import type { HandleClientError } from "@sveltejs/kit";

posthog.init(PUBLIC_POSTHOG_PROJECT_TOKEN, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: "2026-01-30",
  // No automatic data collection
  capture_pageview: false,
  autocapture: false,
  disable_session_recording: true,
  disable_surveys: true,
  // Mask everything
  mask_all_text: true,
  mask_all_element_attributes: true,
  // Only explicit capture() calls
  capture_exceptions: false,
});

export const handleError: HandleClientError = async ({ error }) => {
  // Don't send exceptions to PostHog — may contain sensitive info
  console.error(error);
};
