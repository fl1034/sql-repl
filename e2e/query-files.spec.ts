import { test, expect } from "@playwright/test";

test("brands the workspace and switches themes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "SQL/REPL", exact: true })).toBeVisible({
    timeout: 60_000,
  });
  const html = page.locator("html");
  const wasDark = await html.evaluate((element) => element.classList.contains("dark"));
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  await expect
    .poll(() => html.evaluate((element) => element.classList.contains("dark")))
    .toBe(!wasDark);
  await page.reload();
  await expect(page.getByRole("img", { name: "SQL/REPL", exact: true })).toBeVisible();
  await expect
    .poll(() => html.evaluate((element) => element.classList.contains("dark")))
    .toBe(!wasDark);
});

test("saves query files into nested folders and reuses open tabs", async ({ page }) => {
  await page.goto("/");
  const editor = () =>
    page.locator('[role="tabpanel"]:visible .cm-content[contenteditable="true"]').first();
  await expect(editor()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "New query folder", exact: true }).click();
  await page.getByLabel("Folder name", { exact: true }).fill("Reports");
  await page.getByRole("button", { name: "Create folder", exact: true }).click();
  const tree = page.getByRole("tree", { name: "Queries", exact: true });
  await expect(
    tree
      .getByRole("treeitem", { name: "Queries", exact: true })
      .getByRole("treeitem", { name: "Reports", exact: true })
  ).toBeVisible();
  await expect(tree.getByRole("treeitem", { name: "Reports", exact: true })).toBeVisible();
  // Select the parent for a nested folder.
  await tree.getByRole("button", { name: "Reports", exact: true }).click();
  await page.getByRole("button", { name: "New query folder", exact: true }).click();
  await page.getByLabel("Folder name", { exact: true }).fill("Daily");
  await page.getByRole("button", { name: "Create folder", exact: true }).click();
  await expect(tree.getByRole("treeitem", { name: "Daily", exact: true })).toBeVisible();
  await editor().fill("SELECT 42 AS answer;");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Save query", exact: true });
  await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue("");
  await expect(dialog.getByText("Give your untitled query a name before saving.")).toBeVisible();
  await dialog.getByLabel("Name", { exact: true }).fill("Daily answer.sql");
  await dialog.getByLabel("Folder", { exact: true }).selectOption("Reports/Daily");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
  const file = tree.getByRole("treeitem", { name: "Daily answer.sql", exact: true });
  await expect(file).toBeVisible();
  await expect(page.getByRole("tab", { name: "Daily answer.sql", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "New query", exact: true }).click();
  await editor().fill("SELECT 1;");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await dialog.getByLabel("Name", { exact: true }).fill("Daily answer.sql");
  await dialog.getByLabel("Folder", { exact: true }).selectOption("Reports/Daily");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("A query with that name already exists in this folder", { exact: true })
  ).toBeVisible();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await file.dblclick();
  await expect(page.getByRole("tab", { name: "Daily answer.sql", exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.getByRole("tab", { name: "Daily answer.sql", exact: true })).toHaveCount(1);
  await editor().fill("SELECT 99 AS answer;");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Query saved", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Close Daily answer.sql", exact: true }).click();
  await file.dblclick();
  await expect(editor()).toContainText("SELECT 99");
  await expect(tree.getByRole("treeitem", { name: "Daily answer.sql", exact: true })).toHaveCount(
    1
  );
  // A reload restores the same file identity, including empty folder paths.
  await page.reload();
  await expect(editor()).toContainText("SELECT 99", { timeout: 60_000 });
  await tree.getByRole("button", { name: "Reports", exact: true }).click();
  await tree.getByRole("button", { name: "Daily", exact: true }).click();
  await file.dblclick();
  await expect(page.getByRole("tab", { name: "Daily answer.sql", exact: true })).toHaveCount(1);
});
