import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

test("downloads the current SQL editor as a .sql file", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator('.cm-content[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 60_000 });
  const sql = "SELECT 'download me' AS message;";
  await editor.fill(sql);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download", exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.sql$/);
  const path = await download.path();
  expect(await fs.readFile(path!, "utf8")).toBe(sql);
});

test("customizes accent and all syntax groups, persists, and resets", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const editor = page.locator('.cm-content[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 60_000 });
  await editor.fill("-- A comment\nSELECT 'sample', 123;");
  const trigger = page.getByRole("button", { name: "Customize colors", exact: true });
  await trigger.click();
  const palette = page.getByRole("region", { name: "Theme and syntax colors", exact: true });
  await expect(palette.locator('input[type="color"]')).toHaveCount(10);
  const choices = [
    ["Theme accent", "accent", "#8855ff"],
    ["Keywords", "syntax-keyword", "#ff8899"],
    ["Strings", "syntax-string", "#22ccaa"],
    ["Numbers & literals", "syntax-literal", "#44aaff"],
    ["Comments", "syntax-comment", "#8899aa"],
    ["Types", "syntax-type", "#ddaa33"],
    ["Functions & headings", "syntax-function", "#eeeeaa"],
    ["Operators & punctuation", "syntax-operator", "#aabbcc"],
    ["Names & identifiers", "syntax-identifier", "#ccddee"],
    ["Parameters & invalid syntax", "syntax-special", "#ff6677"],
  ];
  for (const [label, key, color] of choices) {
    await palette.getByLabel(label, { exact: true }).evaluate((element, value) => {
      (element as HTMLInputElement).value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, color);
    await expect
      .poll(() =>
        page
          .locator("html")
          .evaluate(
            (element, variable) => (element as HTMLElement).style.getPropertyValue(`--${variable}`),
            key
          )
      )
      .toBe(color);
  }
  // Verify rendered tokens change, not only the settings inputs.
  await expect(
    editor
      .locator("span")
      .filter({ hasText: /^SELECT$/ })
      .first()
  ).toHaveCSS("color", "rgb(255, 136, 153)");
  await expect(
    editor
      .locator("span")
      .filter({ hasText: /^'sample'$/ })
      .first()
  ).toHaveCSS("color", "rgb(34, 204, 170)");
  await expect(editor.locator("span").filter({ hasText: /^123$/ }).first()).toHaveCSS(
    "color",
    "rgb(68, 170, 255)"
  );
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.reload();
  await expect(editor).toBeVisible({ timeout: 60_000 });
  await trigger.click();
  await expect(palette.getByLabel("Theme accent", { exact: true })).toHaveValue("#8855ff");
  await expect(palette.getByLabel("Keywords", { exact: true })).toHaveValue("#ff8899");
  await palette.getByRole("button", { name: "Reset colors", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("html")
        .evaluate((element) => (element as HTMLElement).style.getPropertyValue("--accent"))
    )
    .toBe("");
  await expect(palette.getByLabel("Theme accent", { exact: true })).toHaveValue("#22d3ee");
});
