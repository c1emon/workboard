import { expect, test } from "@playwright/test";

test("admin-created permit appears on the board", async ({ page }) => {
  await page.goto("/admin");

  await page.locator(".section-nav button", { hasText: "许可" }).click();
  await page.getByRole("button", { name: "新增许可" }).click();
  await page.getByRole("textbox", { name: "任务" }).fill("E2E 动火许可");
  await page.getByRole("textbox", { name: "人员" }).fill("张三");
  await page.getByRole("textbox", { name: "对象" }).fill("A区");
  await page.getByRole("textbox", { name: "其他" }).fill("已审批");
  await page.getByRole("button", { name: "保存" }).click();

  await expect(page.getByRole("cell", { name: "E2E 动火许可" })).toBeVisible();
  await expect(page.getByText("已同步")).toBeVisible();

  await page.getByRole("link", { name: "查看看板" }).click();

  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByText("E2E 动火许可")).toBeVisible();
  await expect(page.getByText("张三")).toBeVisible();
});
