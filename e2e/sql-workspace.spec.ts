import { test, expect } from "@playwright/test";

test("opens directly into SQL without profile, Home, or removed controls", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator('.cm-content[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("dialog", { name: "New profile" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Home", exact: true })).toHaveCount(0);
  for (const name of [
    "Explain",
    "Share",
    "Duck Brain",
    "Compare",
    "Add to dashboard",
    "Import data",
  ]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: /Switch connection/ })).toHaveCount(0);
  await editor.fill(
    "CREATE TABLE student(id INT PRIMARY KEY, name VARCHAR); INSERT INTO student VALUES (123456, 'saveneet'); SELECT * FROM student;"
  );
  await editor.press("Control+Shift+Enter");
  await expect(page.getByText("saveneet", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Pin result", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Compare/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add to dashboard", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.cm-content[contenteditable="true"]').first()).toContainText(
    "CREATE TABLE",
    { timeout: 60_000 }
  );
  await expect(page.getByRole("tab", { name: "Home", exact: true })).toHaveCount(0);
});

test("keeps schema access on mobile without the navigation rail", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const showSchema = page.getByRole("button", { name: "Show schema explorer", exact: true });
  await expect(showSchema).toBeVisible({ timeout: 60_000 });
  await showSchema.click();
  await expect(page.getByRole("dialog", { name: "Schema explorer" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
});
