// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminView from "../src/views/AdminView.vue";
import OperationTaskTimeline from "../src/components/OperationTaskTimeline.vue";
import {
  createOperationPlan,
  createPermit,
  createTaskItem,
  deleteTaskItem,
  fetchLeavePeople,
  fetchOperationPlan,
  fetchOperationPlans,
  fetchPermitArrangements,
  updateOperationPlan,
  updatePermitArrangementEnabled
} from "../src/api/client";

vi.mock("../src/api/client", () => ({
  createHoliday: vi.fn().mockResolvedValue({ id: "holiday-1" }),
  createLeavePerson: vi.fn().mockResolvedValue({ id: "leave-1" }),
  createOperationPlan: vi.fn().mockResolvedValue({ id: "operation-2" }),
  createOtherArrangement: vi.fn().mockResolvedValue({ id: "other-1" }),
  createPatrolArrangement: vi.fn().mockResolvedValue({ id: "patrol-1" }),
  createPermit: vi.fn().mockResolvedValue({ id: "permit-1" }),
  createTaskContainer: vi.fn().mockResolvedValue({ id: "container-1" }),
  createTaskItem: vi.fn().mockResolvedValue({ id: "item-1" }),
  deleteOperationPlan: vi.fn().mockResolvedValue(undefined),
  deleteOtherArrangement: vi.fn().mockResolvedValue(undefined),
  deletePatrolArrangement: vi.fn().mockResolvedValue(undefined),
  deletePermitArrangement: vi.fn().mockResolvedValue(undefined),
  deleteTaskItem: vi.fn().mockResolvedValue(undefined),
  deleteLeavePerson: vi.fn().mockResolvedValue(undefined),
  fetchLeavePeople: vi.fn().mockResolvedValue([
    {
      id: "leave-1",
      date: "2026-05-01",
      name: "王五",
      enabled: true
    }
  ]),
  fetchOperationPlan: vi.fn().mockResolvedValue({
    id: "operation-1",
    name: "倒闸操作",
    description: "主线切换",
    startAt: "2026-05-01T08:00:00+08:00",
    endAt: "2026-05-01T20:00:00+08:00",
    recurrenceType: "once",
    recurrenceIntervalMinutes: null,
    recurrenceCount: null,
    skipWeekends: false,
    skipHolidays: false,
    enabled: true,
    items: [
      {
        id: "item-1",
        offsetMinutes: 0,
        durationMinutes: 120,
        content: "A、B 操作",
        metadata: {},
        sortOrder: 0
      },
      {
        id: "item-2",
        offsetMinutes: 150,
        durationMinutes: 60,
        content: "复核记录",
        metadata: { crew: "B" },
        sortOrder: 1
      }
    ]
  }),
  fetchOperationPlans: vi.fn().mockResolvedValue([
    {
      id: "operation-1",
      name: "倒闸操作",
      description: "主线切换",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T20:00:00+08:00",
      recurrenceType: "once",
      recurrenceIntervalMinutes: null,
      recurrenceCount: null,
      skipWeekends: false,
      skipHolidays: false,
      enabled: true,
      childTaskCount: 1,
      firstItemContent: "A、B 操作"
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
  updateOperationPlan: vi.fn().mockResolvedValue(undefined),
  updateOperationPlanEnabled: vi.fn().mockResolvedValue(undefined),
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

  afterEach(() => {
    vi.useRealTimers();
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

  it("loads operation plans and disables date controls when showing all", async () => {
    const wrapper = mountAdmin();
    await new Promise((resolve) => setTimeout(resolve));

    expect(fetchOperationPlans).toHaveBeenCalledWith(expect.any(String), "date");
    expect(wrapper.text()).toContain("倒闸操作");

    await wrapper.find('input[name="operationShowAll"]').setValue(true);

    expect(fetchOperationPlans).toHaveBeenLastCalledWith(expect.any(String), "all");
    expect(wrapper.find('input[type="date"]').attributes("disabled")).toBeDefined();
    expect(wrapper.find(".yesterday-button").attributes("disabled")).toBeDefined();
    expect(wrapper.find(".today-button").attributes("disabled")).toBeDefined();
  });

  it("creates operation plans from a modal instead of the main page", async () => {
    const wrapper = mountAdmin();
    await wrapper.find('[aria-label="新增计划"]').trigger("click");

    expect(wrapper.find(".operation-modal").exists()).toBe(true);
    expect(wrapper.find(".operation-panel .form-grid").exists()).toBe(false);
    expect(wrapper.find(".operation-task-timeline").exists()).toBe(false);
    expect(wrapper.find('input[name="operationItemContent"]').exists()).toBe(false);

    await wrapper.find('input[name="operationName"]').setValue("新增操作");
    await wrapper.find(".operation-modal").trigger("submit.prevent");

    expect(createOperationPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "新增操作"
      })
    );
    expect(createOperationPlan).toHaveBeenCalledWith(expect.not.objectContaining({ item: expect.anything() }));
  });

  it("does not render dash placeholders for empty operation summaries", async () => {
    vi.mocked(fetchOperationPlans).mockResolvedValueOnce([
      {
        id: "operation-empty",
        name: "操作计划",
        description: "",
        startAt: "2026-05-01T10:30:00+08:00",
        endAt: "2026-05-02T20:00:00+08:00",
        recurrenceType: "infinite",
        recurrenceIntervalMinutes: 5760,
        recurrenceCount: null,
        skipWeekends: false,
        skipHolidays: false,
        enabled: true,
        childTaskCount: 3,
        firstItemContent: ""
      }
    ]);
    const wrapper = mountAdmin();
    await new Promise((resolve) => setTimeout(resolve));

    const cells = wrapper.find("tbody tr").findAll("td");

    expect(cells[0].text()).toBe("操作计划");
    expect(cells[2].text()).toBe("无限循环");
    expect(cells[3].text()).toBe("3");
  });

  it("shows operation plan columns with a detail action", async () => {
    const wrapper = mountAdmin();
    await new Promise((resolve) => setTimeout(resolve));

    const headers = wrapper.find(".operation-panel thead tr").findAll("th").map((header) => header.text());
    const cells = wrapper.find(".operation-panel tbody tr").findAll("td");
    const actionButtons = wrapper.find(".operation-panel tbody .row-actions").findAll("button").map((button) => button.text());

    expect(headers).toEqual(["名称", "说明", "类型", "子任务数", "操作"]);
    expect(cells).toHaveLength(5);
    expect(cells[0].text()).toBe("倒闸操作");
    expect(cells[1].text()).toBe("主线切换");
    expect(cells[2].text()).toBe("一次性");
    expect(cells[3].text()).toBe("1");
    expect(actionButtons).toContain("详情");
  });

  it("opens operation detail in read-only mode", async () => {
    const wrapper = mountAdmin();
    await new Promise((resolve) => setTimeout(resolve));

    await wrapper.find(".operation-panel tbody .row-actions button").trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 310));

    expect(wrapper.find(".operation-modal h2").text()).toBe("详情计划");
    expect(wrapper.find('input[name="operationName"]').attributes("disabled")).toBeDefined();
    expect(wrapper.find('input[name="operationItemContent"]').exists()).toBe(false);
    expect(wrapper.find('input[name="operationOffset"]').exists()).toBe(false);
    expect(wrapper.find(".operation-modal button[type='submit']").exists()).toBe(false);
    expect(wrapper.find(".operation-task-timeline").text()).toContain("A、B 操作");
    expect(wrapper.find(".operation-task-timeline").text()).toContain("复核记录");

    wrapper.findComponent(OperationTaskTimeline).vm.$emit("select", {
      id: "item-2",
      offsetMinutes: 150,
      durationMinutes: 60,
      content: "复核记录",
      metadata: { crew: "B" },
      sortOrder: 1
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".operation-item-modal h2").text()).toBe("子任务详情");
    expect(wrapper.find('input[name="operationItemContent"]').attributes("disabled")).toBeDefined();
    expect((wrapper.find('input[name="operationItemContent"]').element as HTMLInputElement).value).toBe("复核记录");

    await wrapper.find(".operation-modal").trigger("submit.prevent");

    expect(updateOperationPlan).not.toHaveBeenCalled();
  });

  it("shows a loading animation before opening operation detail", async () => {
    let resolveDetail: (value: Awaited<ReturnType<typeof fetchOperationPlan>>) => void = () => undefined;
    vi.mocked(fetchOperationPlan).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDetail = resolve;
      })
    );
    const wrapper = mountAdmin();
    await new Promise((resolve) => setTimeout(resolve));
    vi.useFakeTimers();

    await wrapper.find(".operation-panel tbody .row-actions button").trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".operation-modal").exists()).toBe(false);
    expect(wrapper.find(".operation-task-timeline").exists()).toBe(false);
    expect(wrapper.find(".operation-modal-loading").text()).toContain("计划加载中");

    resolveDetail({
      id: "operation-1",
      name: "倒闸操作",
      description: "主线切换",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T20:00:00+08:00",
      recurrenceType: "once",
      recurrenceIntervalMinutes: null,
      recurrenceCount: null,
      skipWeekends: false,
      skipHolidays: false,
      enabled: true,
      childTaskCount: 1,
      firstItemContent: "A、B 操作",
      items: [{ id: "item-1", offsetMinutes: 0, durationMinutes: 120, content: "A、B 操作", metadata: {}, sortOrder: 0 }]
    });
    await vi.advanceTimersByTimeAsync(300);
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".operation-modal-loading").exists()).toBe(false);
    expect(wrapper.find(".operation-modal").exists()).toBe(true);
    expect(wrapper.find(".operation-task-timeline").text()).toContain("A、B 操作");
  });

  it("keeps the operation loading animation visible for a minimum duration", async () => {
    const wrapper = mountAdmin();
    await new Promise((resolve) => setTimeout(resolve));
    vi.useFakeTimers();

    await wrapper.find(".operation-panel tbody .row-actions button").trigger("click");
    await wrapper.vm.$nextTick();
    await Promise.resolve();

    expect(wrapper.find(".operation-modal-loading").exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(299);
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".operation-modal-loading").exists()).toBe(true);
    expect(wrapper.find(".operation-modal").exists()).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".operation-modal-loading").exists()).toBe(false);
    expect(wrapper.find(".operation-modal").exists()).toBe(true);
  });

  it("selects operation child tasks from the timeline while editing", async () => {
    const wrapper = mountAdmin();
    await new Promise((resolve) => setTimeout(resolve));

    await wrapper.findAll(".operation-panel tbody .row-actions button")[2].trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 310));
    wrapper.findComponent(OperationTaskTimeline).vm.$emit("select", {
      id: "item-2",
      offsetMinutes: 150,
      durationMinutes: 60,
      content: "复核记录",
      metadata: { crew: "B" },
      sortOrder: 1
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".operation-modal").text()).not.toContain("子任务 offset");
    expect(wrapper.find(".operation-item-modal h2").text()).toBe("编辑子任务");
    expect(wrapper.find(".operation-item-modal").text()).toContain("开始时间点 (分)");
    expect(wrapper.find(".operation-item-modal").text()).toContain("任务时长 (分)");
    expect(wrapper.find(".operation-item-modal").text()).toContain("任务内容");
    expect(wrapper.find(".operation-item-modal").text()).not.toContain("offset（分钟）");
    expect(wrapper.find(".operation-item-modal").text()).not.toContain("时长（分钟）");
    expect(wrapper.find(".operation-item-modal").text()).not.toContain("展示内容");
    expect((wrapper.find('input[name="operationItemContent"]').element as HTMLInputElement).value).toBe("复核记录");
    expect((wrapper.find('input[name="operationItemOffset"]').element as HTMLInputElement).value).toBe("150");

    await wrapper.find('input[name="operationItemOffset"]').setValue("200");
    await wrapper.find(".operation-item-modal").trigger("submit.prevent");

    expect(updateOperationPlan).toHaveBeenCalledWith(
      "operation-1",
      expect.objectContaining({
        endAt: "2026-05-01T12:20:00+08:00",
        item: expect.objectContaining({ id: "item-2", content: "复核记录", offsetMinutes: 200 })
      })
    );
  });

  it("adds operation child tasks from the preview action while editing", async () => {
    vi.mocked(createTaskItem).mockResolvedValueOnce({ id: "item-3" });
    const wrapper = mountAdmin();
    await new Promise((resolve) => setTimeout(resolve));

    await wrapper.findAll(".operation-panel tbody .row-actions button")[2].trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 310));
    await wrapper.find('[aria-label="新增子任务"]').trigger("click");

    expect(wrapper.find(".operation-item-modal h2").text()).toBe("新增子任务");

    await wrapper.find('input[name="operationItemOffset"]').setValue("30");
    await wrapper.find('input[name="operationItemDuration"]').setValue("45");
    await wrapper.find('input[name="operationItemContent"]').setValue("新增班次");
    await wrapper.find(".operation-item-modal").trigger("submit.prevent");

    expect(createTaskItem).toHaveBeenCalledWith(
      expect.objectContaining({
        containerId: "operation-1",
        offsetMinutes: 30,
        durationMinutes: 45,
        content: "新增班次",
        target: "",
        personnel: "",
        vehicle: "",
        other: "",
        metadata: {},
        sortOrder: 2
      })
    );
    expect(wrapper.find(".operation-task-timeline").text()).toContain("新增班次");
  });

  it("deletes operation child tasks with confirmation while editing", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    const wrapper = mountAdmin();
    await new Promise((resolve) => setTimeout(resolve));

    await wrapper.findAll(".operation-panel tbody .row-actions button")[2].trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 310));
    wrapper.findComponent(OperationTaskTimeline).vm.$emit("select", {
      id: "item-2",
      offsetMinutes: 150,
      durationMinutes: 60,
      content: "复核记录",
      metadata: { crew: "B" },
      sortOrder: 1
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".operation-item-delete").text()).toBe("删除");

    await wrapper.find(".operation-item-delete").trigger("click");

    expect(confirmSpy).toHaveBeenCalledWith("确认删除这个子任务吗？");
    expect(deleteTaskItem).toHaveBeenCalledWith("item-2");
    expect(updateOperationPlan).toHaveBeenCalledWith(
      "operation-1",
      expect.objectContaining({
        endAt: "2026-05-01T10:00:00+08:00"
      })
    );
    expect(updateOperationPlan).toHaveBeenCalledWith("operation-1", expect.not.objectContaining({ item: expect.anything() }));
    expect(wrapper.find(".operation-item-modal").exists()).toBe(false);
    expect(wrapper.find(".operation-task-timeline").text()).not.toContain("复核记录");

    confirmSpy.mockRestore();
  });

  it("shows derived timing fields by operation recurrence type", async () => {
    vi.mocked(fetchOperationPlans).mockResolvedValueOnce([
      {
        id: "operation-finite",
        name: "有限操作",
        description: "两轮",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T15:00:00+08:00",
        recurrenceType: "finite",
        recurrenceIntervalMinutes: 999,
        recurrenceCount: 99,
        skipWeekends: false,
        skipHolidays: false,
        enabled: true,
        childTaskCount: 2,
        firstItemContent: "第一步"
      }
    ]);
    vi.mocked(fetchOperationPlan).mockResolvedValueOnce({
      id: "operation-finite",
      name: "有限操作",
      description: "两轮",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T15:00:00+08:00",
      recurrenceType: "finite",
      recurrenceIntervalMinutes: 999,
      recurrenceCount: 99,
      skipWeekends: false,
      skipHolidays: false,
      enabled: true,
      childTaskCount: 2,
      firstItemContent: "第一步",
      items: [
        { id: "item-1", offsetMinutes: 0, durationMinutes: 120, content: "第一步", metadata: {}, sortOrder: 0 },
        { id: "item-2", offsetMinutes: 150, durationMinutes: 60, content: "第二步", metadata: {}, sortOrder: 1 }
      ]
    });

    const wrapper = mountAdmin();
    await new Promise((resolve) => setTimeout(resolve));
    await wrapper.find(".operation-panel tbody .row-actions button").trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 310));

    expect((wrapper.find('input[name="operationEndAt"]').element as HTMLInputElement).value).toBe("2026-05-01T15:00");
    expect((wrapper.find('input[name="operationRecurrenceInterval"]').element as HTMLInputElement).value).toBe("210");
    expect((wrapper.find('input[name="operationRecurrenceCount"]').element as HTMLInputElement).value).toBe("2");

    await wrapper.find(".operation-modal .modal-heading button").trigger("click");
    await wrapper.findAll(".operation-panel tbody .row-actions button")[2].trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 310));

    expect(wrapper.find('input[name="operationRecurrenceInterval"]').exists()).toBe(false);
    expect(wrapper.find('input[name="operationRecurrenceCount"]').exists()).toBe(false);
  });

  it("hides end time for infinite operation plans", async () => {
    vi.mocked(fetchOperationPlan).mockResolvedValueOnce({
      id: "operation-infinite",
      name: "无限操作",
      description: "持续循环",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T12:00:00+08:00",
      recurrenceType: "infinite",
      recurrenceIntervalMinutes: 240,
      recurrenceCount: null,
      skipWeekends: false,
      skipHolidays: false,
      enabled: true,
      childTaskCount: 1,
      firstItemContent: "巡检",
      items: [{ id: "item-1", offsetMinutes: 0, durationMinutes: 120, content: "巡检", metadata: {}, sortOrder: 0 }]
    });
    const wrapper = mountAdmin();
    await new Promise((resolve) => setTimeout(resolve));

    await wrapper.find(".operation-panel tbody .row-actions button").trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 310));

    expect(wrapper.find('input[name="operationEndAt"]').exists()).toBe(false);
    expect(wrapper.find('input[name="operationRecurrenceInterval"]').exists()).toBe(true);
    expect(wrapper.find('input[name="operationRecurrenceCount"]').exists()).toBe(false);
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

  it("places operation start time and recurrence type on one row", async () => {
    const wrapper = mountAdmin();
    await wrapper.find('[aria-label="新增计划"]').trigger("click");

    const row = wrapper.find(".operation-schedule-row");

    expect(row.exists()).toBe(true);
    expect(row.findAll("label").map((label) => label.text())).toEqual(["循环类型 一次性有限循环无限循环", "开始时间"]);
    expect(row.find("select").exists()).toBe(true);
    expect(row.find('input[type="datetime-local"]').exists()).toBe(true);
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
