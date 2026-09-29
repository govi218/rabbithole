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
