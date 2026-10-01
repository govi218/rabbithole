import { test, expect } from "./fixtures";

test("categorise shows candidates and groups", async ({ bg }) => {
  await bg.skipOnboarding();
  await bg.seedCloudKey();

  await bg.context.route("**/api/v1/chat/completions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                candidates: [
                  { key: "test", title: "Test", description: "test" },
                ],
              }),
            },
          },
        ],
      }),
    });
  });

  await bg.context.route("**/api/alpha/decisions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answers: {
          tab_0: { choice: "r1-test" },
          tab_1: { choice: "r1-test" },
        },
      }),
    });
  });

  for (const path of ["alpha", "beta"]) {
    const p = await bg.context.newPage();
    await p.goto(`https://example.com/${path}`);
  }

  const newtab = await bg.openNewtab();

  const btn = newtab.locator("button", { hasText: /clean up/i }).first();
  await btn.waitFor({ timeout: 10000 });
  await btn.click();

  await expect(newtab.locator(".candidate-list")).toContainText("Test", {
    timeout: 10000,
  });
  await expect(newtab.locator(".group-section")).toHaveCount(1, {
    timeout: 10000,
  });
});

test("categorise confirm applies changes", async ({ bg }) => {
  await bg.skipOnboarding();
  await bg.seedCloudKey();

  await bg.context.route("**/api/v1/chat/completions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                candidates: [
                  { key: "test", title: "Test", description: "test" },
                ],
              }),
            },
          },
        ],
      }),
    });
  });

  await bg.context.route("**/api/alpha/decisions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answers: {
          tab_0: { choice: "r1-test" },
          tab_1: { choice: "r1-test" },
        },
      }),
    });
  });

  for (const path of ["alpha", "beta"]) {
    const p = await bg.context.newPage();
    await p.goto(`https://example.com/${path}`);
  }

  const newtab = await bg.openNewtab();

  const btn = newtab.locator("button", { hasText: /clean up/i }).first();
  await btn.waitFor({ timeout: 10000 });
  await btn.click();

  await expect(newtab.locator(".candidate-list")).toContainText("Test", {
    timeout: 10000,
  });

  const confirmBtn = newtab.locator("button", { hasText: /confirm/i }).first();
  await confirmBtn.click();

  await expect(newtab.locator(".success")).toBeVisible({ timeout: 10000 });
  await expect(newtab.locator(".success")).toContainText(/saved|done/i);
});

// a single valid web tab produces a singleton assignment — the modal must
// still show the group (regression: singleton dissolve silently emptied it)
test("categorise with a single tab still shows its group", async ({ bg }) => {
  await bg.skipOnboarding();
  await bg.seedCloudKey();

  await bg.context.route("**/api/v1/chat/completions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                candidates: [
                  { key: "test", title: "Test", description: "test" },
                ],
              }),
            },
          },
        ],
      }),
    });
  });

  await bg.context.route("**/api/alpha/decisions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answers: {
          tab_0: { choice: "r1-test" },
        },
      }),
    });
  });

  const p = await bg.context.newPage();
  await p.goto("https://example.com/alpha");

  const newtab = await bg.openNewtab();

  const btn = newtab.locator("button", { hasText: /clean up/i }).first();
  await btn.waitFor({ timeout: 10000 });
  await btn.click();

  await expect(newtab.locator(".candidate-list")).toContainText("Test", {
    timeout: 10000,
  });
  await expect(newtab.locator(".group-section")).toHaveCount(1, {
    timeout: 10000,
  });
});

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

  const newtab = await bg.openNewtab();

  const btn = newtab.locator("button", { hasText: /clean up/i }).first();
  await btn.waitFor({ timeout: 10000 });
  await btn.click();

  // real pipeline: real propose (Flash-Lite) + real Jev assignment
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
