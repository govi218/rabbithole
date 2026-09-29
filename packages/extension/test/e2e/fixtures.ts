import {
  test as base,
  chromium,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { MessageRequest } from "../../src/utils/types";

const here = dirname(fileURLToPath(import.meta.url));
const extensionPath = resolve(here, "../../dist-chrome");
const newtabPath = "src/newtab/newtab.html";

export interface BackgroundResponse {
  [key: string]: unknown;
}

export interface TestHarness {
  context: BrowserContext;
  extId: string;
  msgPage: Page;
  sendMessage: (msg: unknown) => Promise<BackgroundResponse>;
  skipOnboarding: () => Promise<void>;
  seedCloudKey: () => Promise<void>;
  openNewtab: () => Promise<Page>;
}

export const test = base.extend<{ bg: TestHarness }>({
  bg: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent("serviceworker");
    }
    const extId = worker.url().split("/")[2];

    // the background worker can't receive its own runtime.sendMessage,
    // route messages through an extension page
    const msgPage = await context.newPage();
    await msgPage.goto(`chrome-extension://${extId}/${newtabPath}`);
    await msgPage.waitForLoadState("domcontentloaded");

    const sendMessage = async (msg: unknown): Promise<BackgroundResponse> => {
      const resp = await msgPage.evaluate(
        (m: unknown) =>
          new Promise<Record<string, unknown>>((resolve) => {
            chrome.runtime.sendMessage(m, (r: Record<string, unknown>) => {
              if (chrome.runtime.lastError) {
                resolve({ error: chrome.runtime.lastError.message });
              } else {
                resolve(r);
              }
            });
          }),
        msg,
      );
      return resp as BackgroundResponse;
    };

    const skipOnboarding = async (): Promise<void> => {
      // GET_SETTINGS returns undefined until onInstalled finishes seeding
      // the user record — poll until it's there, or UPDATE_SETTINGS crashes
      let settings: Record<string, unknown> | undefined;
      for (let i = 0; i < 20; i++) {
        settings = await sendMessage({ type: MessageRequest.GET_SETTINGS });
        if (
          settings &&
          typeof settings === "object" &&
          "hasSeenOnboarding" in settings
        ) {
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      await sendMessage({
        type: MessageRequest.UPDATE_SETTINGS,
        settings: { ...settings, hasSeenOnboarding: true },
      });
    };

    const seedCloudKey = async (): Promise<void> => {
      await msgPage.evaluate(() => {
        chrome.storage.local.set({
          cloudProvider: "openrouter",
          cloudApiKey: "test-key",
        });
      });
    };

    const openNewtab = async (): Promise<Page> => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extId}/${newtabPath}`);
      await page.waitForLoadState("domcontentloaded");
      return page;
    };

    await use({
      context,
      extId,
      msgPage,
      sendMessage,
      skipOnboarding,
      seedCloudKey,
      openNewtab,
    });
    await context.close();
  },
});

export { expect } from "@playwright/test";
