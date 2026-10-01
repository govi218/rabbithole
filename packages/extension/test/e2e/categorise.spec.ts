import { test, expect } from "./fixtures";
import type { TestHarness } from "./fixtures";

// real LLM (Flash-Lite + Jev via OpenRouter) by default; flip to false for
// deterministic route-mocked runs
const UseRealLlm = true;

async function mockPropose(
  bg: TestHarness,
  candidates: unknown[],
): Promise<void> {
  await bg.context.route("**/api/v1/chat/completions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({ candidates }),
            },
          },
        ],
      }),
    });
  });
}

async function mockDecisions(
  bg: TestHarness,
  answers: Record<string, unknown>,
): Promise<void> {
  await bg.context.route("**/api/alpha/decisions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ answers }),
    });
  });
}

async function openTabs(bg: TestHarness, urls: string[]): Promise<void> {
  for (const url of urls) {
    const p = await bg.context.newPage();
    await p.goto(url);
  }
}

async function runCategorise(
  bg: TestHarness,
): Promise<import("@playwright/test").Page> {
  const newtab = await bg.openNewtab();
  const btn = newtab.locator("button", { hasText: /clean up/i }).first();
  await btn.waitFor({ timeout: 10000 });
  await btn.click();
  return newtab;
}

async function setupLlm(bg: TestHarness): Promise<void> {
  if (UseRealLlm) {
    test.setTimeout(120000);
    await bg.skipOnboarding();
    await bg.seedCloudKey(process.env.OPENROUTER_API_KEY);
    return;
  }
  await bg.skipOnboarding();
  await bg.seedCloudKey();
}

test("categorise shows candidates and groups", async ({ bg }) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (UseRealLlm) {
    test.skip(!apiKey, "OPENROUTER_API_KEY not set");
  }
  await setupLlm(bg);

  if (UseRealLlm) {
    await openTabs(bg, [
      "https://en.wikipedia.org/wiki/Otter",
      "https://en.wikipedia.org/wiki/Sea_otter",
    ]);
  } else {
    await mockPropose(bg, [
      { key: "test", title: "Test", description: "test" },
    ]);
    await mockDecisions(bg, {
      tab_0: { choice: "r1-test" },
      tab_1: { choice: "r1-test" },
    });
    await openTabs(bg, [
      "https://example.com/alpha",
      "https://example.com/beta",
    ]);
  }

  const newtab = await runCategorise(bg);

  if (UseRealLlm) {
    await expect(newtab.locator(".candidate-list")).toBeVisible({
      timeout: 60000,
    });
    await expect(newtab.locator(".group-section").first()).toBeVisible({
      timeout: 60000,
    });
  } else {
    await expect(newtab.locator(".candidate-list")).toContainText("Test", {
      timeout: 10000,
    });
    await expect(newtab.locator(".group-section")).toHaveCount(1, {
      timeout: 10000,
    });
  }
});

// a single valid web tab produces a singleton assignment — the modal must
// still show the group (regression: singleton dissolve silently emptied it)
test("categorise with a single tab still shows its group", async ({ bg }) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (UseRealLlm) {
    test.skip(!apiKey, "OPENROUTER_API_KEY not set");
  }
  await setupLlm(bg);

  if (UseRealLlm) {
    await openTabs(bg, ["https://en.wikipedia.org/wiki/Otter"]);
  } else {
    await mockPropose(bg, [
      { key: "test", title: "Test", description: "test" },
    ]);
    await mockDecisions(bg, {
      tab_0: { choice: "r1-test" },
    });
    await openTabs(bg, ["https://example.com/alpha"]);
  }

  const newtab = await runCategorise(bg);

  if (UseRealLlm) {
    // with a single tab the LLM may legitimately propose nothing — assert
    // the flow completes without crashing (no error/retry)
    await expect(
      newtab.getByRole("heading", { name: "Clean Up My Tabs" }),
    ).toBeVisible({ timeout: 60000 });
    await expect(newtab.locator("button", { hasText: "Retry" })).toHaveCount(0);
  } else {
    await expect(newtab.locator(".candidate-list")).toContainText("Test", {
      timeout: 10000,
    });
    await expect(newtab.locator(".group-section")).toHaveCount(1, {
      timeout: 10000,
    });
  }
});

// apply path is LLM-independent — mocked only
test("categorise confirm applies changes", async ({ bg }) => {
  await bg.skipOnboarding();
  await bg.seedCloudKey();

  await mockPropose(bg, [{ key: "test", title: "Test", description: "test" }]);
  await mockDecisions(bg, {
    tab_0: { choice: "r1-test" },
    tab_1: { choice: "r1-test" },
  });
  await openTabs(bg, ["https://example.com/alpha", "https://example.com/beta"]);

  const newtab = await runCategorise(bg);

  await expect(newtab.locator(".candidate-list")).toContainText("Test", {
    timeout: 10000,
  });

  const confirmBtn = newtab.locator("button", { hasText: /confirm/i }).first();
  await confirmBtn.click();

  await expect(newtab.locator(".success")).toBeVisible({ timeout: 10000 });
  await expect(newtab.locator(".success")).toContainText(/saved|done/i);
});

// quality check: real pipeline should split otters from rabbits
test("categorise with real LLM (Flash-Lite + Jev)", async ({ bg }) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  test.skip(!apiKey, "OPENROUTER_API_KEY not set");
  test.setTimeout(120000);

  await bg.skipOnboarding();
  await bg.seedCloudKey(apiKey);

  for (const article of [
    "Otter",
    "Sea_otter",
    "Giant_otter",
    "Rabbit",
    "European_rabbit",
    "Cottontail_rabbit",
  ]) {
    const p = await bg.context.newPage();
    await p.goto(`https://en.wikipedia.org/wiki/${article}`);
  }

  const newtab = await runCategorise(bg);

  await expect(newtab.locator(".candidate-list")).toBeVisible({
    timeout: 60000,
  });
  await expect(newtab.locator(".candidate-list")).toContainText(/otter/i, {
    timeout: 60000,
  });
  await expect(newtab.locator(".candidate-list")).toContainText(/rabbit/i, {
    timeout: 60000,
  });
});
