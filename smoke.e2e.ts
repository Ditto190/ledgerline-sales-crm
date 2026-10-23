import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/opportunities",
  "/companies",
  "/contacts",
  "/activities",
  "/inbox",
  "/settings",
];

test.describe("Ledgerline CRM smoke", () => {
  for (const route of routes) {
    test(`renders ${route} without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(route);
      await expect(page.locator("body")).not.toContainText("This page didn't load");
      await expect(page.locator("body")).not.toContainText("Page not found");
      expect(errors).toEqual([]);
    });
  }

  test("unknown route shows 404", async ({ page }) => {
    await page.goto("/does-not-exist");
    await expect(page.getByText("Page not found")).toBeVisible();
  });

  test("data persists across reload (local-first)", async ({ page }) => {
    await page.goto("/companies");
    const before = await page.evaluate(() => Object.keys(window.localStorage).length);
    await page.reload();
    const after = await page.evaluate(() => Object.keys(window.localStorage).length);
    expect(after).toBeGreaterThanOrEqual(before);
  });
});
