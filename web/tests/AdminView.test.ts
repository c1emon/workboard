// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminView from "../src/views/AdminView.vue";
import { createPermit, fetchLeavePeople, fetchPermitArrangements, updatePermitArrangementEnabled } from "../src/api/client";

vi.mock("../src/api/client", () => ({
  createHoliday: vi.fn().mockResolvedValue({ id: "holiday-1" }),
  createLeavePerson: vi.fn().mockResolvedValue({ id: "leave-1" }),
  createOtherArrangement: vi.fn().mockResolvedValue({ id: "other-1" }),
  createPatrolArrangement: vi.fn().mockResolvedValue({ id: "patrol-1" }),
  createPermit: vi.fn().mockResolvedValue({ id: "permit-1" }),
  createTaskContainer: vi.fn().mockResolvedValue({ id: "container-1" }),
  createTaskItem: vi.fn().mockResolvedValue({ id: "item-1" }),
  deleteOtherArrangement: vi.fn().mockResolvedValue(undefined),
  deletePatrolArrangement: vi.fn().mockResolvedValue(undefined),
  deletePermitArrangement: vi.fn().mockResolvedValue(undefined),
  deleteLeavePerson: vi.fn().mockResolvedValue(undefined),
  fetchLeavePeople: vi.fn().mockResolvedValue([
    {
      id: "leave-1",
      date: "2026-05-01",
      name: "王五",
      enabled: true
    }
  ]),
  fetchOtherArrangements: vi.fn().mockResolvedValue([]),
  fetchPatrolArrangements: vi.fn().mockResolvedValue([]),
  fetchPermitArrangements: vi.fn().mockResolvedValue([
    {
      id: "permit-1",
      date: "2026-05-01",
      timeTag: "全天",
      permit: "动火许可",
      personnel: "张三",
      area: "A区",
      other: "已审批",
      enabled: true
    }
  ]),
  updateOtherArrangement: vi.fn().mockResolvedValue(undefined),
  updateOtherArrangementEnabled: vi.fn().mockResolvedValue(undefined),
  updateLeavePerson: vi.fn().mockResolvedValue(undefined),
  updatePatrolArrangement: vi.fn().mockResolvedValue(undefined),
  updatePatrolArrangementEnabled: vi.fn().mockResolvedValue(undefined),
  updatePermitArrangement: vi.fn().mockResolvedValue(undefined),
  updatePermitArrangementEnabled: vi.fn().mockResolvedValue(undefined)
}));

function mountAdmin() {
  return mount(AdminView, {
    global: {
      stubs: {
        RouterLink: { template: "<a><slot /></a>" }
      }
    }
  });
}

describe("AdminView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the admin management sections", () => {
    const wrapper = mountAdmin();

    expect(wrapper.text()).toContain("操作");
    expect(wrapper.text()).toContain("许可");
    expect(wrapper.text()).toContain("巡视");
    expect(wrapper.text()).toContain("其他");
    expect(wrapper.text()).toContain("休假");
    expect(wrapper.text()).toContain("节假日");
  });

  it("submits a permit arrangement", async () => {
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[1].trigger("click");
    await wrapper.find('[aria-label="新增许可"]').trigger("click");

    await wrapper.find('input[name="permit"]').setValue("动火许可");
    await wrapper.find('input[name="personnel"]').setValue("张三");
    await wrapper.find('input[name="area"]').setValue("A区");
    await wrapper.find('input[name="other"]').setValue("已审批");
    await wrapper.find(".modal-form").trigger("submit.prevent");

    expect(createPermit).toHaveBeenCalledWith({
      date: expect.any(String),
      timeTag: "全天",
      permit: "动火许可",
      personnel: "张三",
      area: "A区",
      other: "已审批"
    });
  });

  it("shows permit rows and toggles enabled state from the action column", async () => {
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[1].trigger("click");
    await new Promise((resolve) => setTimeout(resolve));

    expect(fetchPermitArrangements).toHaveBeenCalledWith(expect.any(String));
    expect(wrapper.text()).toContain("动火许可");

    await wrapper.find('[aria-label="禁用许可"]').trigger("click");

    expect(updatePermitArrangementEnabled).toHaveBeenCalledWith("permit-1", false);
  });

  it("uses date shortcut buttons for yesterday and today", async () => {
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[1].trigger("click");

    await wrapper.find('input[type="date"]').setValue("2026-05-10");
    await wrapper.find(".yesterday-button").trigger("click");
    await wrapper.find(".yesterday-button").trigger("click");

    expect(wrapper.find('input[type="date"]').element).toHaveProperty("value", "2026-05-08");

    await wrapper.find(".today-button").trigger("click");

    expect(wrapper.find('input[type="date"]').element).toHaveProperty("value", expect.any(String));
    expect(fetchPermitArrangements).toHaveBeenCalledWith(expect.any(String));
  });

  it("shows leave people as one-name rows with only delete in the action column", async () => {
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[4].trigger("click");
    await new Promise((resolve) => setTimeout(resolve));

    expect(fetchLeavePeople).toHaveBeenCalledWith(expect.any(String));
    expect(wrapper.text()).toContain("休假列表");
    expect(wrapper.find(".leave-table-shell").exists()).toBe(true);
    expect(wrapper.find(".leave-table").exists()).toBe(true);
    expect(wrapper.find(".leave-name-column").exists()).toBe(true);
    expect(wrapper.find("tbody tr").text()).toContain("王五");

    const actionButtons = wrapper.find("tbody .row-actions").findAll("button");

    expect(actionButtons).toHaveLength(1);
    expect(actionButtons[0].text()).toBe("删除");
  });

  it("places the add action in the date toolbar after the shortcut buttons", async () => {
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[2].trigger("click");

    const toolbar = wrapper.find(".date-toolbar");

    expect(toolbar.text()).toContain("日期:");
    expect(toolbar.find(".date-shortcuts").exists()).toBe(true);
    expect(toolbar.find(".date-field").exists()).toBe(true);
    expect(toolbar.find(".yesterday-button").exists()).toBe(true);
    expect(toolbar.find(".today-button").exists()).toBe(true);
    expect(toolbar.find('[aria-label="新增巡视"]').exists()).toBe(true);
    expect(wrapper.find(".list-heading .icon-action").exists()).toBe(false);
  });

  it("keeps enabled table text dark and weakens disabled rows", () => {
    const source = readFileSync(resolve(__dirname, "../src/views/AdminView.vue"), "utf8");

    expect(source).toContain("td {\n  color: #0f172a;");
    expect(source).toContain("tr.disabled td:not(.row-actions) {\n  color: #94a3b8;");
    expect(source).toContain("justify-content: space-between;");
    expect(source).toMatch(/\.date-toolbar :deep\(button\) \{[^}]*height: 32px;/);
    expect(source).toMatch(/\.date-toolbar :deep\(\.date-field input\) \{[^}]*height: 32px;/);
    expect(source).toMatch(/\.date-toolbar :deep\(\.toolbar-add-action\) \{[^}]*height: 32px;/);
    expect(source).toMatch(/\.leave-table-shell \{[^}]*width: 100%;/);
    expect(source).toMatch(/\.leave-table \{[^}]*width: 100%;[^}]*table-layout: fixed;/);
    expect(source).toMatch(/\.leave-name-column \{[^}]*width: 120px;/);
  });
});
