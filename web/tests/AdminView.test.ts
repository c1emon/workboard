// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminView from "../src/views/AdminView.vue";
import OperationTaskTimeline from "../src/components/OperationTaskTimeline.vue";
import {
	  createLeavePerson,
	  createOperationPlan,
	  createPermit,
  fetchTaskInstances,
  fetchPatrolPlans,
  fetchPatrolPlan,
	  fetchHolidays,
	  deleteOperationPlanItem,
  deletePermitArrangement,
  fetchLeavePeople,
  fetchOperationPlan,
  fetchOperationPlans,
  fetchOtherArrangements,
  fetchPermitArrangements,
  generateTaskInstances,
  importChineseDaysHolidays,
  updateOperationPlan,
  updatePermitArrangementEnabled
} from "../src/api/client";

vi.mock("../src/api/client", () => ({
  createHoliday: vi.fn().mockResolvedValue({ id: "holiday-1" }),
  createLeavePerson: vi.fn().mockResolvedValue({ id: "leave-1" }),
  createOperationPlan: vi.fn().mockResolvedValue({ id: "operation-2" }),
  createPatrolPlan: vi.fn().mockResolvedValue({ id: "patrol-plan-2" }),
	  createOtherArrangement: vi.fn().mockResolvedValue({ id: "other-1" }),
	  createPermit: vi.fn().mockResolvedValue({ id: "permit-1" }),
	  deleteOperationPlan: vi.fn().mockResolvedValue(undefined),
	  deleteOperationPlanItem: vi.fn().mockResolvedValue(undefined),
	  deleteOtherArrangement: vi.fn().mockResolvedValue(undefined),
  deletePatrolPlan: vi.fn().mockResolvedValue(undefined),
  deletePatrolPlanItem: vi.fn().mockResolvedValue(undefined),
  deleteTaskInstance: vi.fn().mockResolvedValue(undefined),
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
        extData: {},
        sortOrder: 0
      },
      {
        id: "item-2",
        offsetMinutes: 150,
        durationMinutes: 60,
        content: "复核记录",
        extData: { crew: "B" },
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
  fetchTaskInstances: vi.fn().mockResolvedValue([
    {
      id: "instance-1",
      type: "patrol",
      templateId: "patrol-plan-1",
      sourceTemplateItemId: "cycle-1",
      sourceType: "generated",
      generationKey: "patrol-plan-1:cycle-1:2026-05-01",
      occurrenceDate: "2026-05-01",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T12:00:00+08:00",
      content: "1号线",
      extData: { target: "1号线" },
      status: "pending",
      generatedAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z"
    }
  ]),
  fetchPatrolPlans: vi.fn().mockResolvedValue([
    {
      id: "patrol-plan-1",
      name: "日常巡检",
      description: "90天周期",
      startAt: "2026-05-01T00:00:00+08:00",
      endAt: "2026-07-29T23:59:59+08:00",
      recurrenceType: "infinite",
      skipWeekends: false,
      skipHolidays: true,
      enabled: true,
      cycleLength: 90
    }
  ]),
  fetchPatrolPlan: vi.fn().mockResolvedValue({
    id: "patrol-plan-1",
    name: "日常巡检",
    description: "90天周期",
    startAt: "2026-05-01T00:00:00+08:00",
    endAt: "2026-07-29T23:59:59+08:00",
    recurrenceType: "infinite",
    skipWeekends: false,
    skipHolidays: true,
    enabled: true,
    cycleLength: 90,
    items: [{ id: "cycle-1", templateId: "patrol-plan-1", cycleDay: 1, timeTag: "上午", target: "1号线", personnel: "张三", vehicle: "", other: "", content: "1号线", sortOrder: 0 }]
  }),
  fetchPermitArrangements: vi.fn().mockResolvedValue([
    {
      id: "permit-1",
      date: "2026-05-01",
      timeTag: "全天",
      target: "A区",
      task: "动火许可",
      personnel: "张三",
      vehicle: "工程车",
      other: "已审批",
      enabled: true
    }
  ]),
  fetchHolidays: vi.fn().mockResolvedValue([
    { id: "holiday-1", date: "2026-05-01", name: "劳动节", type: "holiday" },
    { id: "workday-1", date: "2026-04-26", name: "劳动节", type: "adjusted_workday" }
  ]),
  importChineseDaysHolidays: vi.fn().mockResolvedValue({ imported: 2, holidays: 1, adjustedWorkdays: 1 }),
  generateTaskInstances: vi.fn().mockResolvedValue({ inserted: 1, updated: 0, skipped: 0 }),
  createTaskInstance: vi.fn().mockResolvedValue({ id: "instance-2" }),
  updateTaskInstance: vi.fn().mockResolvedValue(undefined),
  updateTaskInstanceStatus: vi.fn().mockResolvedValue(undefined),
  updatePatrolPlan: vi.fn().mockResolvedValue(undefined),
  updatePatrolPlanEnabled: vi.fn().mockResolvedValue(undefined),
  createPatrolPlanItem: vi.fn().mockResolvedValue({ id: "cycle-2" }),
  updatePatrolPlanItem: vi.fn().mockResolvedValue(undefined),
  updateOtherArrangement: vi.fn().mockResolvedValue(undefined),
  updateOtherArrangementEnabled: vi.fn().mockResolvedValue(undefined),
  updateOperationPlan: vi.fn().mockResolvedValue(undefined),
  updateOperationPlanEnabled: vi.fn().mockResolvedValue(undefined),
  updateLeavePerson: vi.fn().mockResolvedValue(undefined),
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

async function openOperationSection(wrapper: ReturnType<typeof mountAdmin>): Promise<void> {
  await wrapper.findAll(".section-nav button")[4].trigger("click");
  await new Promise((resolve) => setTimeout(resolve));
}

async function waitForAssertion(assertion: () => void): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve));
    }
  }
  throw lastError;
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

    expect(wrapper.findAll(".section-nav button strong").map((label) => label.text())).toEqual([
      "许可",
      "其他",
      "休假",
      "巡视",
      "操作",
      "节假日"
    ]);
  });

  it("selects permit by default after loading the admin panel", async () => {
    const wrapper = mountAdmin();
    await waitForAssertion(() => {
      expect(fetchPermitArrangements).toHaveBeenCalled();
    });

    expect(wrapper.find(".section-nav button.active strong").text()).toBe("许可");
    expect(wrapper.text()).toContain("许可列表");
    await waitForAssertion(() => {
      expect(wrapper.text()).toContain("动火许可");
    });
    expect(fetchOperationPlans).not.toHaveBeenCalled();
  });

  it("lists holidays by year in holiday and adjusted workday sections", async () => {
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[5].trigger("click");
    await new Promise((resolve) => setTimeout(resolve));

    expect(fetchHolidays).toHaveBeenCalledWith(Number(new Date().getFullYear()));
    expect(wrapper.find('input[name="holidayYear"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("休假");
    expect(wrapper.text()).toContain("调休");
    expect(wrapper.text()).toContain("2026-05-01");
    expect(wrapper.text()).toContain("2026-04-26");
  });

  it("opens a chinese-days import modal with the remote source selected", async () => {
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[5].trigger("click");
    await new Promise((resolve) => setTimeout(resolve));

    await wrapper.find('[aria-label="导入 chinese-days"]').trigger("click");

    expect(wrapper.find(".holiday-import-modal").exists()).toBe(true);
    expect(wrapper.find('input[name="holidayImportSource"][value="remote"]').element).toHaveProperty("checked", true);
    expect(wrapper.find('input[name="holidayImportUrl"]').element).toHaveProperty(
      "value",
      "https://cdn.jsdelivr.net/npm/chinese-days/dist/chinese-days.json"
    );
  });

  it("imports chinese-days holidays from the remote URL after in-app confirmation", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ holidays: { "2026-05-01": "Labour Day,劳动节,2" }, workdays: {}, inLieuDays: {} })
    } as unknown as Response);
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[5].trigger("click");
    await new Promise((resolve) => setTimeout(resolve));

    await wrapper.find('[aria-label="导入 chinese-days"]').trigger("click");
    await wrapper.find('input[name="holidayImportUrl"]').setValue("https://example.test/chinese-days.json");
    await wrapper.find(".holiday-import-modal").trigger("submit.prevent");

    expect(wrapper.find(".confirmation-modal").exists()).toBe(true);
    expect(wrapper.find(".confirmation-modal").text()).toContain("覆盖节假日数据");
    expect(importChineseDaysHolidays).not.toHaveBeenCalled();

    await wrapper.find(".confirmation-confirm").trigger("click");
    await new Promise((resolve) => setTimeout(resolve));

    expect(fetchSpy).toHaveBeenCalledWith("https://example.test/chinese-days.json");
    expect(importChineseDaysHolidays).toHaveBeenCalledWith({
      holidays: { "2026-05-01": "Labour Day,劳动节,2" },
      workdays: {},
      inLieuDays: {}
    });
    expect(fetchHolidays).toHaveBeenLastCalledWith(Number(new Date().getFullYear()));
    expect(wrapper.find(".holiday-import-modal").exists()).toBe(false);

    fetchSpy.mockRestore();
  });

  it("imports chinese-days holidays from a local JSON file", async () => {
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[5].trigger("click");
    await new Promise((resolve) => setTimeout(resolve));

    await wrapper.find('[aria-label="导入 chinese-days"]').trigger("click");
    await wrapper.find('input[name="holidayImportSource"][value="local"]').setValue(true);
    const file = new File([JSON.stringify({ holidays: {}, workdays: { "2026-04-26": "Labour Day,劳动节,2" }, inLieuDays: {} })], "days.json", {
      type: "application/json"
    });
    const input = wrapper.find('input[name="holidayImportFile"]');
    Object.defineProperty(input.element, "files", { value: [file] });
    await input.trigger("change");
    await wrapper.find(".holiday-import-modal").trigger("submit.prevent");
    await wrapper.find(".confirmation-confirm").trigger("click");

    await waitForAssertion(() => {
      expect(importChineseDaysHolidays).toHaveBeenCalledWith({
        holidays: {},
        workdays: { "2026-04-26": "Labour Day,劳动节,2" },
        inLieuDays: {}
      });
    });
  });

  it("does not import chinese-days holidays when confirmation is cancelled", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[5].trigger("click");
    await new Promise((resolve) => setTimeout(resolve));

    await wrapper.find('[aria-label="导入 chinese-days"]').trigger("click");
    await wrapper.find(".holiday-import-modal").trigger("submit.prevent");
    expect(wrapper.find(".confirmation-modal").exists()).toBe(true);

    await wrapper.find(".confirmation-cancel").trigger("click");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(importChineseDaysHolidays).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("deletes permit rows after in-app confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[0].trigger("click");
    await new Promise((resolve) => setTimeout(resolve));

    await wrapper.find("tbody .row-actions .danger").trigger("click");

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(wrapper.find(".confirmation-modal").exists()).toBe(true);
    expect(wrapper.find(".confirmation-modal").text()).toContain("删除许可");
    expect(deletePermitArrangement).not.toHaveBeenCalled();

    await wrapper.find(".confirmation-cancel").trigger("click");
    expect(deletePermitArrangement).not.toHaveBeenCalled();

    await wrapper.find("tbody .row-actions .danger").trigger("click");
    await wrapper.find(".confirmation-confirm").trigger("click");

    expect(deletePermitArrangement).toHaveBeenCalledWith("permit-1");

    confirmSpy.mockRestore();
  });

  it("submits a permit arrangement", async () => {
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[0].trigger("click");
    await wrapper.find('[aria-label="新增许可"]').trigger("click");

    await wrapper.find('input[name="target"]').setValue("A区");
    await wrapper.find('input[name="task"]').setValue("动火许可");
    await wrapper.find('input[name="personnel"]').setValue("张三");
    await wrapper.find('input[name="vehicle"]').setValue("工程车");
    await wrapper.find('input[name="other"]').setValue("已审批");
    await wrapper.find(".modal-form").trigger("submit.prevent");

    expect(createPermit).toHaveBeenCalledWith({
      date: expect.any(String),
      timeTag: "上午",
      target: "A区",
      task: "动火许可",
      personnel: "张三",
      vehicle: "工程车",
      other: "已审批"
    });
  });

  it("shows permit rows and toggles enabled state from the action column", async () => {
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[0].trigger("click");
    await new Promise((resolve) => setTimeout(resolve));

    expect(fetchPermitArrangements).toHaveBeenCalledWith(expect.any(String), "date");
    expect(wrapper.text()).toContain("动火许可");

    await wrapper.find('[aria-label="禁用许可"]').trigger("click");

    expect(updatePermitArrangementEnabled).toHaveBeenCalledWith("permit-1", false);
  });

  it("uses date shortcut buttons for yesterday and today", async () => {
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[0].trigger("click");

    await wrapper.find('input[type="date"]').setValue("2026-05-10");
    await wrapper.find(".yesterday-button").trigger("click");
    await wrapper.find(".yesterday-button").trigger("click");

    expect(wrapper.find('input[type="date"]').element).toHaveProperty("value", "2026-05-08");

    await wrapper.find(".today-button").trigger("click");

    expect(wrapper.find('input[type="date"]').element).toHaveProperty("value", expect.any(String));
    expect(fetchPermitArrangements).toHaveBeenCalledWith(expect.any(String), "date");
  });

  it("refreshes current date when today shortcut is clicked after midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T16:30:00.000Z"));
    const wrapper = mountAdmin();

    expect(wrapper.find('input[type="date"]').element).toHaveProperty("value", "2026-05-02");

    vi.setSystemTime(new Date("2026-05-02T16:30:00.000Z"));
    await wrapper.find(".today-button").trigger("click");

    expect(wrapper.find('input[type="date"]').element).toHaveProperty("value", "2026-05-03");
    expect(fetchPermitArrangements).toHaveBeenCalledWith("2026-05-03", "date");
  });

  it("loads operation plans and disables date controls when showing all", async () => {
    const wrapper = mountAdmin();
    await openOperationSection(wrapper);

    expect(fetchOperationPlans).toHaveBeenCalledWith(expect.any(String), "date");
    expect(wrapper.text()).toContain("倒闸操作");

    await wrapper.find('input[name="operationShowAll"]').setValue(true);

    expect(fetchOperationPlans).toHaveBeenLastCalledWith(expect.any(String), "all");
    expect(wrapper.find('input[type="date"]').attributes("disabled")).toBeDefined();
    expect(wrapper.find(".yesterday-button").attributes("disabled")).toBeDefined();
    expect(wrapper.find(".today-button").attributes("disabled")).toBeDefined();
  });

  it("refreshes operation instances from operation plans", async () => {
    const wrapper = mountAdmin();
    await openOperationSection(wrapper);

    await wrapper.find(".operation-panel .manager-actions .secondary-action").trigger("click");

    expect(wrapper.find(".operation-refresh-modal").exists()).toBe(true);
    expect(wrapper.find('select[name="operationRefreshTemplate"]').element).toHaveProperty("value", "");

    await wrapper.find('select[name="operationRefreshTemplate"]').setValue("operation-1");
    await wrapper.find('input[name="operationRefreshEndDate"]').setValue("2026-05-31");
    await wrapper.find(".operation-refresh-modal").trigger("submit.prevent");

    expect(wrapper.find(".confirmation-modal").text()).toContain("刷新实例");
    await wrapper.find(".confirmation-confirm").trigger("click");

    expect(generateTaskInstances).toHaveBeenCalledWith({
      windowStartDate: expect.any(String),
      windowEndDate: "2026-05-31",
      types: ["operation"],
      templateIds: ["operation-1"],
      refreshPending: true
    });
    expect(wrapper.text()).toContain("新增 1，更新 0，跳过 0");
  });

  it("loads arrangement lists with all scope and disables date controls when showing all", async () => {
    const wrapper = mountAdmin();

    await wrapper.findAll(".section-nav button")[0].trigger("click");
    await wrapper.find('input[name="operationShowAll"]').setValue(true);
    expect(fetchPermitArrangements).toHaveBeenLastCalledWith(expect.any(String), "all");
    expect(wrapper.find('input[type="date"]').attributes("disabled")).toBeDefined();

    await wrapper.findAll(".section-nav button")[3].trigger("click");
    await waitForAssertion(() => {
	      expect(fetchTaskInstances).toHaveBeenCalledWith(expect.any(String), "patrol", "date");
      expect(fetchPatrolPlans).toHaveBeenCalled();
    });
    expect(wrapper.text()).toContain("任务实例");
    expect(wrapper.find(".patrol-plan-panel").exists()).toBe(false);
    await wrapper.find('input[name="operationShowAll"]').setValue(true);
    expect(fetchTaskInstances).toHaveBeenLastCalledWith(expect.any(String), "patrol", "all");
    expect(wrapper.find('input[type="date"]').attributes("disabled")).toBeDefined();

    await wrapper.findAll(".section-nav button")[1].trigger("click");
    await wrapper.find('input[name="operationShowAll"]').setValue(true);
    expect(fetchOtherArrangements).toHaveBeenLastCalledWith(expect.any(String), "all");

    await wrapper.findAll(".section-nav button")[2].trigger("click");
    await wrapper.find('input[name="operationShowAll"]').setValue(true);
    expect(fetchLeavePeople).toHaveBeenLastCalledWith(expect.any(String), "all");
  });

  it("shows patrol instance and template management", async () => {
    const wrapper = mountAdmin();

    await wrapper.findAll(".section-nav button")[3].trigger("click");

    await waitForAssertion(() => {
      expect(fetchTaskInstances).toHaveBeenCalledWith(expect.any(String), "patrol", "date");
      expect(fetchPatrolPlans).toHaveBeenCalled();
    });
    expect(wrapper.text()).toContain("任务实例");
    expect(wrapper.text()).toContain("1号线");
    expect(wrapper.find(".patrol-plan-panel").exists()).toBe(false);

    await wrapper.find(".task-instance-panel .manager-actions .secondary-action").trigger("click");
    await wrapper.find('select[name="taskInstanceRefreshTemplate"]').setValue("patrol-plan-1");
    await wrapper.find('input[name="taskInstanceRefreshEndDate"]').setValue("2026-05-31");
    await wrapper.find(".task-instance-modal").trigger("submit.prevent");
    await wrapper.find(".confirmation-confirm").trigger("click");

    await wrapper.findAll(".patrol-tabs button")[1].trigger("click");

    expect(wrapper.find(".task-instance-panel").exists()).toBe(false);
    expect(wrapper.text()).toContain("巡视模板");
    expect(wrapper.text()).toContain("日常巡检");

    await wrapper.find(".patrol-plan-panel tbody .row-actions button").trigger("click");
    await waitForAssertion(() => {
      expect(fetchPatrolPlan).toHaveBeenCalledWith("patrol-plan-1");
    });
    expect(wrapper.find(".patrol-detail-modal").exists()).toBe(true);

    expect(generateTaskInstances).toHaveBeenCalledWith({
      windowStartDate: expect.any(String),
      windowEndDate: "2026-05-31",
      types: ["patrol"],
      templateIds: ["patrol-plan-1"],
      refreshPending: true
    });
  });

  it("shows a prompt instead of saving when adding a duplicate leave person", async () => {
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[2].trigger("click");
    await wrapper.find('input[type="date"]').setValue("2026-05-01");
    await new Promise((resolve) => setTimeout(resolve));

    expect(wrapper.find(".admin-toolbar").text()).toContain("已同步");

    await wrapper.find('[aria-label="新增休假"]').trigger("click");
    await wrapper.find('input[name="leaveName"]').setValue("王五");
    await wrapper.find(".modal-form").trigger("submit.prevent");

    expect(wrapper.find(".confirmation-modal").exists()).toBe(true);
    expect(wrapper.find(".confirmation-modal").text()).toContain("人员重复");
    expect(wrapper.find(".confirmation-modal").text()).toContain("王五");
    expect(createLeavePerson).not.toHaveBeenCalled();
    expect(wrapper.find(".admin-toolbar").text()).toContain("已同步");
  });

  it("creates operation plans from a modal instead of the main page", async () => {
    const wrapper = mountAdmin();
    await openOperationSection(wrapper);
    await wrapper.find('[aria-label="新增计划"]').trigger("click");

    expect(wrapper.find(".operation-modal").exists()).toBe(true);
    expect(wrapper.find(".operation-panel .form-grid").exists()).toBe(false);
    expect(wrapper.find(".operation-task-timeline").exists()).toBe(false);
    expect(wrapper.find('input[name="operationItemContent"]').exists()).toBe(false);

    await wrapper.find('input[name="operationName"]').setValue("新增操作");
    await wrapper.find(".operation-modal").trigger("submit.prevent");

    expect(createOperationPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "新增操作",
        endAt: null,
        recurrenceIntervalMinutes: null,
        recurrenceCount: null
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
    await openOperationSection(wrapper);

    const cells = wrapper.find("tbody tr").findAll("td");

    expect(cells[0].text()).toBe("操作计划");
    expect(cells[2].text()).toBe("无限循环");
    expect(cells[3].text()).toBe("3");
  });

  it("shows operation plan columns with a detail action", async () => {
    const wrapper = mountAdmin();
    await openOperationSection(wrapper);

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
    await openOperationSection(wrapper);

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
      extData: { crew: "B" },
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
    await openOperationSection(wrapper);
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
      items: [{ id: "item-1", offsetMinutes: 0, durationMinutes: 120, content: "A、B 操作", extData: {}, sortOrder: 0 }]
    });
    await vi.advanceTimersByTimeAsync(300);
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".operation-modal-loading").exists()).toBe(false);
    expect(wrapper.find(".operation-modal").exists()).toBe(true);
    expect(wrapper.find(".operation-task-timeline").text()).toContain("A、B 操作");
  });

  it("keeps the operation loading animation visible for a minimum duration", async () => {
    const wrapper = mountAdmin();
    await openOperationSection(wrapper);
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
    await openOperationSection(wrapper);

    await wrapper.findAll(".operation-panel tbody .row-actions button")[2].trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 310));
    wrapper.findComponent(OperationTaskTimeline).vm.$emit("select", {
      id: "item-2",
      offsetMinutes: 150,
      durationMinutes: 60,
      content: "复核记录",
      extData: { crew: "B" },
      sortOrder: 1
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".operation-modal").text()).not.toContain("子任务 offset");
    expect(wrapper.find(".operation-item-modal h2").text()).toBe("编辑子任务");
    expect(wrapper.find(".operation-item-modal").text()).toContain("开始基准");
    expect(wrapper.find(".operation-item-offset-title").text()).toBe("相对基准偏移时间");
    expect(wrapper.find(".operation-item-offset-controls").exists()).toBe(true);
    const editOffsetFields = wrapper.findAll(".operation-item-offset-field");
    expect(editOffsetFields).toHaveLength(2);
    expect(editOffsetFields[0].find('input[name="operationItemOffsetHours"]').exists()).toBe(true);
    expect(editOffsetFields[0].find(".duration-unit").text()).toBe("时");
    expect(editOffsetFields[1].find('input[name="operationItemOffsetMinutes"]').exists()).toBe(true);
    expect(editOffsetFields[1].find(".duration-unit").text()).toBe("分");
    expect(wrapper.find(".operation-item-modal").text()).toContain("任务时长");
    expect(wrapper.find(".operation-item-modal").text()).toContain("任务内容");
    expect(wrapper.find(".operation-item-modal").text()).not.toContain("offset（分钟）");
    expect(wrapper.find(".operation-item-modal").text()).not.toContain("时长（分钟）");
    expect(wrapper.find(".operation-item-modal").text()).not.toContain("展示内容");
    expect((wrapper.find('input[name="operationItemContent"]').element as HTMLInputElement).value).toBe("复核记录");
    expect((wrapper.find('input[name="operationItemOffsetHours"]').element as HTMLInputElement).value).toBe("2");
    expect((wrapper.find('input[name="operationItemOffsetMinutes"]').element as HTMLInputElement).value).toBe("30");

    await wrapper.find('input[name="operationItemOffsetHours"]').setValue("3");
    await wrapper.find('input[name="operationItemOffsetMinutes"]').setValue("20");
    await wrapper.find(".operation-item-modal").trigger("submit.prevent");

    expect(updateOperationPlan).toHaveBeenCalledWith(
      "operation-1",
      expect.objectContaining({
        endAt: null,
        recurrenceIntervalMinutes: null,
        recurrenceCount: null,
        item: expect.objectContaining({ id: "item-2", content: "复核记录", offsetMinutes: 200 })
      })
    );
  });

  it("keeps operation item extData hidden and preserves it while saving", async () => {
    const wrapper = mountAdmin();
    await openOperationSection(wrapper);

    await wrapper.findAll(".operation-panel tbody .row-actions button")[2].trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 310));
    wrapper.findComponent(OperationTaskTimeline).vm.$emit("select", {
      id: "item-2",
      offsetMinutes: 150,
      durationMinutes: 60,
      content: "复核记录",
      extData: { crew: "B" },
      sortOrder: 1
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".operation-item-modal").exists()).toBe(true);
    expect(wrapper.find(".operation-item-modal").text().toLowerCase()).not.toContain("extdata json");
    expect(wrapper.find('textarea[name="operationItemExtData"]').exists()).toBe(false);

    await wrapper.find(".operation-item-modal").trigger("submit.prevent");
    await wrapper.vm.$nextTick();

    expect(updateOperationPlan).toHaveBeenCalledWith(
      "operation-1",
      expect.objectContaining({
        item: expect.objectContaining({ id: "item-2", extData: { crew: "B" } })
      })
    );
    expect(wrapper.find(".operation-item-modal").exists()).toBe(false);

    wrapper.findComponent(OperationTaskTimeline).vm.$emit("select", {
      id: "item-1",
      offsetMinutes: 0,
      durationMinutes: 120,
      content: "A、B 操作",
      extData: {},
      sortOrder: 0
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".operation-item-extData-error").exists()).toBe(false);
  });

  it("adds operation child tasks from the preview action while editing", async () => {
    vi.mocked(fetchOperationPlan).mockResolvedValueOnce({
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
      childTaskCount: 3,
      firstItemContent: "A、B 操作",
      items: [
        { id: "item-1", offsetMinutes: 0, durationMinutes: 120, content: "A、B 操作", extData: {}, sortOrder: 0 },
        { id: "item-2", offsetMinutes: 150, durationMinutes: 60, content: "复核记录", extData: { crew: "B" }, sortOrder: 1 },
        { id: "item-existing-duplicate", offsetMinutes: 195, durationMinutes: 75, content: "新增班次", extData: {}, sortOrder: 3 }
      ]
    });
    const wrapper = mountAdmin();
    await openOperationSection(wrapper);

    await wrapper.findAll(".operation-panel tbody .row-actions button")[2].trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 310));
    await wrapper.find('[aria-label="新增子任务"]').trigger("click");

    expect(wrapper.find(".operation-item-modal h2").text()).toBe("新增子任务");

    const baseSelect = wrapper.find('select[name="operationItemBaseItem"]');
    expect(baseSelect.exists()).toBe(true);
    expect(baseSelect.text()).toContain("A、B 操作 · 结束 2时0分");
    expect(baseSelect.text()).toContain("复核记录 · 结束 3时30分");
    expect(baseSelect.text()).not.toContain("结束 120 分");
    expect(wrapper.find(".operation-item-offset-title").text()).toBe("相对基准偏移时间");
    expect(wrapper.find(".operation-item-offset-controls").exists()).toBe(true);
    expect(wrapper.find('input[name="operationItemOffset"]').exists()).toBe(false);
    const offsetFields = wrapper.findAll(".operation-item-offset-field");
    expect(offsetFields).toHaveLength(2);
    expect(offsetFields[0].find('input[name="operationItemOffsetHours"]').exists()).toBe(true);
    expect(offsetFields[0].find(".duration-unit").text()).toBe("时");
    expect(offsetFields[1].find('input[name="operationItemOffsetMinutes"]').exists()).toBe(true);
    expect(offsetFields[1].find(".duration-unit").text()).toBe("分");
    expect(wrapper.find('input[name="operationItemDuration"]').exists()).toBe(false);
    expect(wrapper.find(".operation-item-modal").text()).toContain("时");
    expect(wrapper.find(".operation-item-modal").text()).toContain("分");
    expect(wrapper.find(".operation-item-duration-controls").exists()).toBe(true);
    const durationFields = wrapper.findAll(".operation-item-duration-field");
    expect(durationFields).toHaveLength(2);
    expect(durationFields[0].find('input[name="operationItemDurationHours"]').exists()).toBe(true);
    expect(durationFields[0].find(".duration-unit").text()).toBe("时");
    expect(durationFields[1].find('input[name="operationItemDurationMinutes"]').exists()).toBe(true);
    expect(durationFields[1].find(".duration-unit").text()).toBe("分");
    expect(wrapper.find(".operation-item-json").exists()).toBe(false);

    await wrapper.find('select[name="operationItemBaseItem"]').setValue("item-1");
    await wrapper.find('input[name="operationItemOffsetHours"]').setValue("0");
    const offsetMinutesInput = wrapper.find('input[name="operationItemOffsetMinutes"]');
    (offsetMinutesInput.element as HTMLInputElement).value = "75";
    await offsetMinutesInput.trigger("input");
    expect((wrapper.find('input[name="operationItemOffsetHours"]').element as HTMLInputElement).value).toBe("0");
    expect((wrapper.find('input[name="operationItemOffsetMinutes"]').element as HTMLInputElement).value).toBe("75");
    await offsetMinutesInput.trigger("blur");
    expect((wrapper.find('input[name="operationItemOffsetHours"]').element as HTMLInputElement).value).toBe("1");
    expect((wrapper.find('input[name="operationItemOffsetMinutes"]').element as HTMLInputElement).value).toBe("15");
    await wrapper.find('input[name="operationItemDurationHours"]').setValue("0");
    const durationMinutesInput = wrapper.find('input[name="operationItemDurationMinutes"]');
    (durationMinutesInput.element as HTMLInputElement).value = "75";
    await durationMinutesInput.trigger("input");
    expect((wrapper.find('input[name="operationItemDurationHours"]').element as HTMLInputElement).value).toBe("0");
    expect((wrapper.find('input[name="operationItemDurationMinutes"]').element as HTMLInputElement).value).toBe("75");
    await durationMinutesInput.trigger("keydown.enter");
    expect((wrapper.find('input[name="operationItemDurationHours"]').element as HTMLInputElement).value).toBe("1");
    expect((wrapper.find('input[name="operationItemDurationMinutes"]').element as HTMLInputElement).value).toBe("15");
    await wrapper.find('input[name="operationItemContent"]').setValue("新增班次");
    vi.mocked(fetchOperationPlan).mockResolvedValueOnce({
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
      childTaskCount: 3,
      firstItemContent: "A、B 操作",
      items: [
        { id: "item-1", offsetMinutes: 0, durationMinutes: 120, content: "A、B 操作", extData: {}, sortOrder: 0 },
        { id: "item-2", offsetMinutes: 150, durationMinutes: 60, content: "复核记录", extData: { crew: "B" }, sortOrder: 1 },
        { id: "item-existing-duplicate", offsetMinutes: 195, durationMinutes: 75, content: "新增班次", extData: {}, sortOrder: 3 },
        { id: "item-3", offsetMinutes: 195, durationMinutes: 75, content: "新增班次", extData: {}, sortOrder: 3 }
      ]
    });
    await wrapper.find(".operation-item-modal").trigger("submit.prevent");

    expect(updateOperationPlan).toHaveBeenCalledWith(
      "operation-1",
      expect.objectContaining({
        recurrenceIntervalMinutes: null,
        recurrenceCount: null,
        item: expect.objectContaining({
	        offsetMinutes: 195,
	        durationMinutes: 75,
	        content: "新增班次",
	        extData: {},
	        sortOrder: 3
	      })
      })
    );
    expect(fetchOperationPlan).toHaveBeenCalledTimes(2);
    expect(fetchOperationPlan).toHaveBeenLastCalledWith("operation-1");
    expect(wrapper.findComponent(OperationTaskTimeline).props("selectedItemId")).toBe("item-3");
    expect(wrapper.find(".operation-task-timeline").text()).toContain("新增班次");
  });

  it("extends an operation plan before adding a child task beyond the current duration", async () => {
    vi.mocked(fetchOperationPlans).mockResolvedValueOnce([
      {
        id: "operation-single",
        name: "操作",
        description: "操作安排",
        startAt: "2026-05-02T08:00:00+08:00",
        endAt: "2026-05-02T16:30:00+08:00",
        recurrenceType: "infinite",
        recurrenceIntervalMinutes: 510,
        recurrenceCount: null,
        skipWeekends: false,
        skipHolidays: false,
        enabled: true,
        childTaskCount: 1,
        firstItemContent: "白班1"
      }
    ]);
    vi.mocked(fetchOperationPlan).mockResolvedValueOnce({
      id: "operation-single",
      name: "操作",
      description: "操作安排",
      startAt: "2026-05-02T08:00:00+08:00",
      endAt: "2026-05-02T16:30:00+08:00",
      recurrenceType: "infinite",
      recurrenceIntervalMinutes: 510,
      recurrenceCount: null,
      skipWeekends: false,
      skipHolidays: false,
      enabled: true,
      childTaskCount: 1,
      firstItemContent: "白班1",
      items: [{ id: "item-1", offsetMinutes: 0, durationMinutes: 510, content: "白班1", extData: {}, sortOrder: 0 }]
    });
    const wrapper = mountAdmin();
    await openOperationSection(wrapper);

    await wrapper.findAll(".operation-panel tbody .row-actions button")[2].trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 310));
    await wrapper.find('[aria-label="新增子任务"]').trigger("click");
    await wrapper.find('input[name="operationItemOffsetHours"]').setValue("8");
    await wrapper.find('input[name="operationItemOffsetMinutes"]').setValue("30");
    await wrapper.find('input[name="operationItemDurationHours"]').setValue("8");
    await wrapper.find('input[name="operationItemDurationMinutes"]').setValue("30");
    await wrapper.find('input[name="operationItemContent"]').setValue("晚班1");
    await wrapper.find(".operation-item-modal").trigger("submit.prevent");

    expect(updateOperationPlan).toHaveBeenCalledWith(
      "operation-single",
      expect.objectContaining({
        endAt: null,
        recurrenceIntervalMinutes: 1020,
        item: expect.objectContaining({ offsetMinutes: 510, durationMinutes: 510 })
      })
    );
  });

  it("deletes operation child tasks with confirmation while editing", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const wrapper = mountAdmin();
    await openOperationSection(wrapper);

    await wrapper.findAll(".operation-panel tbody .row-actions button")[2].trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 310));
    wrapper.findComponent(OperationTaskTimeline).vm.$emit("select", {
      id: "item-2",
      offsetMinutes: 150,
      durationMinutes: 60,
      content: "复核记录",
      extData: { crew: "B" },
      sortOrder: 1
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".operation-item-delete").text()).toBe("删除");

    await wrapper.find(".operation-item-delete").trigger("click");

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(wrapper.find(".confirmation-modal").exists()).toBe(true);
    expect(wrapper.find(".confirmation-modal").text()).toContain("删除子任务");
	    expect(deleteOperationPlanItem).not.toHaveBeenCalled();

    await wrapper.find(".confirmation-confirm").trigger("click");

    await waitForAssertion(() => {
	      expect(deleteOperationPlanItem).toHaveBeenCalledWith("operation-1", "item-2");
    });
    expect(updateOperationPlan).not.toHaveBeenCalled();
    await waitForAssertion(() => {
      expect(wrapper.find(".operation-item-modal").exists()).toBe(false);
    });
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
        { id: "item-1", offsetMinutes: 0, durationMinutes: 120, content: "第一步", extData: {}, sortOrder: 0 },
        { id: "item-2", offsetMinutes: 150, durationMinutes: 60, content: "第二步", extData: {}, sortOrder: 1 }
      ]
    });

    const wrapper = mountAdmin();
    await openOperationSection(wrapper);
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

  it("saves finite operation plans with explicit window end and derived cycle fields", async () => {
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
        { id: "item-1", offsetMinutes: 0, durationMinutes: 120, content: "第一步", extData: {}, sortOrder: 0 },
        { id: "item-2", offsetMinutes: 150, durationMinutes: 60, content: "第二步", extData: {}, sortOrder: 1 }
      ]
    });

    const wrapper = mountAdmin();
    await openOperationSection(wrapper);
    await wrapper.findAll(".operation-panel tbody .row-actions button")[2].trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 310));

    await wrapper.find('input[name="operationEndAt"]').setValue("2026-05-01T16:00");
    await wrapper.find(".operation-modal").trigger("submit.prevent");

    expect(updateOperationPlan).toHaveBeenCalledWith(
      "operation-finite",
      expect.objectContaining({
        endAt: "2026-05-01T16:00:00+08:00",
        recurrenceIntervalMinutes: 210,
        recurrenceCount: 3
      })
    );
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
      items: [{ id: "item-1", offsetMinutes: 0, durationMinutes: 120, content: "巡检", extData: {}, sortOrder: 0 }]
    });
    const wrapper = mountAdmin();
    await openOperationSection(wrapper);

    await wrapper.find(".operation-panel tbody .row-actions button").trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 310));

    expect(wrapper.find('input[name="operationEndAt"]').exists()).toBe(false);
    expect(wrapper.find('input[name="operationRecurrenceInterval"]').exists()).toBe(true);
    expect(wrapper.find('input[name="operationRecurrenceCount"]').exists()).toBe(false);
  });

  it("shows leave people as one-name rows with only delete in the action column", async () => {
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[2].trigger("click");
    await new Promise((resolve) => setTimeout(resolve));

    expect(fetchLeavePeople).toHaveBeenCalledWith(expect.any(String), "date");
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
    await wrapper.findAll(".section-nav button")[3].trigger("click");

    const toolbar = wrapper.find(".date-toolbar");

    expect(toolbar.text()).toContain("日期:");
    expect(toolbar.find(".date-shortcuts").exists()).toBe(true);
    expect(toolbar.find(".date-field").exists()).toBe(true);
    expect(toolbar.find(".yesterday-button").exists()).toBe(true);
    expect(toolbar.find(".today-button").exists()).toBe(true);
    expect(toolbar.find('[aria-label="新增实例"]').exists()).toBe(true);
    expect(wrapper.find(".list-heading .icon-action").exists()).toBe(false);
  });

  it("places operation start time and recurrence type on one row", async () => {
    const wrapper = mountAdmin();
    await openOperationSection(wrapper);
    await wrapper.find('[aria-label="新增计划"]').trigger("click");

    const row = wrapper.find(".operation-schedule-row");

    expect(row.exists()).toBe(true);
    expect(row.findAll("label").map((label) => label.text())).toEqual(["循环类型 一次性有限循环无限循环", "开始时间"]);
    expect(row.find("select").exists()).toBe(true);
    expect(row.find('input[type="datetime-local"]').exists()).toBe(true);
  });

  it("keeps enabled table text dark and weakens disabled rows", () => {
    const adminViewSource = readFileSync(resolve(__dirname, "../src/views/AdminView.vue"), "utf8");
    const managerStylesSource = readFileSync(resolve(__dirname, "../src/components/admin/managerStyles.css"), "utf8");
    const dateToolbarSource = readFileSync(resolve(__dirname, "../src/components/admin/DateToolbar.vue"), "utf8");
    const leaveManagerSource = readFileSync(resolve(__dirname, "../src/components/admin/LeaveManager.vue"), "utf8");
    const operationItemModalSource = readFileSync(resolve(__dirname, "../src/components/admin/OperationItemModal.vue"), "utf8");

    expect(adminViewSource).toContain("useAdminViewModel");
    expect(adminViewSource.split("\n").length).toBeLessThan(430);
    expect(managerStylesSource).toContain("td {\n  color: #0f172a;");
    expect(managerStylesSource).toContain("tr.disabled td:not(.row-actions) {\n  color: #94a3b8;");
    expect(adminViewSource).toContain("justify-content: space-between;");
    expect(dateToolbarSource).toMatch(/button \{[^}]*height: 32px;/);
    expect(dateToolbarSource).toMatch(/\.date-field input \{[^}]*height: 32px;/);
    expect(dateToolbarSource).toMatch(/\.toolbar-add-action \{[^}]*height: 32px;/);
    expect(leaveManagerSource).toMatch(/\.leave-table-shell \{[^}]*width: 100%;/);
    expect(leaveManagerSource).toMatch(/\.leave-table \{[^}]*width: 100%;[^}]*table-layout: fixed;/);
    expect(leaveManagerSource).toMatch(/\.leave-name-column \{[^}]*width: 120px;/);
    expect(operationItemModalSource).toMatch(
      /\.operation-item-start-row,[\s\S]*\.operation-item-duration-row \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(240px, 280px\);/
    );
    expect(operationItemModalSource).toMatch(/\.operation-item-offset-field input,[\s\S]*\.operation-item-duration-field input \{[^}]*text-align: center;/);
  });

  it("keeps the admin view model split by domain", () => {
    const source = readFileSync(resolve(__dirname, "../src/composables/admin/useAdminViewModel.ts"), "utf8");

    expect(source).toContain("useConfirmation");
    expect(source).toContain("useArrangementAdmin");
    expect(source).toContain("useHolidayAdmin");
    expect(source).toContain("useOperationAdmin");
    expect(source.split("\n").length).toBeLessThan(260);
  });
});
