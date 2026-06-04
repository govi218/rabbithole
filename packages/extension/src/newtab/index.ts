import Rabbithole from "src/lib/Rabbithole.svelte";
import { initPostHog } from "src/utils/posthog";
import { MessageRequest } from "src/utils";

// global styles
import "./styles.css";

const target = document.getElementById("app");

function render() {
  new Rabbithole({
    target,
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // Check if analytics is enabled before initializing PostHog
  const response = await chrome.runtime.sendMessage({
    type: MessageRequest.GET_SETTINGS,
  });
  if (response?.analyticsEnabled) {
    initPostHog();
  }
  render();
});
