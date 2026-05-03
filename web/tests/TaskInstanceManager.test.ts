// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { defineComponent, onMounted, ref, watch } from "vue";
import { describe, expect, it, vi } from "vitest";
import TaskInstanceManager from "../src/components/admin/TaskInstanceManager.vue";
import { useTaskInstanceAdmin } from "../src/composables/admin/useTaskInstanceAdmin";
import { createTaskInstance, fetchTaskInstances, generateTaskInstances } from "../src/api/client";

vi.mock("../src/api/client", () => ({
  fetchTaskInstances: vi.fn().mockResolvedValue([
    {
      id: "instance-1",
      type: "patrol",
      templateId: null,
      sourceTemplateItemId: null,
      sourceType: "manual",
      generationKey: null,
      occurrenceDate: "2026-05-01",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T12:00:00+08:00",
      content: "人工巡视",
      metadata: { target: "1号线", personnel: "张三" },
      status: "pending",
      generatedAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z"
    }
  ]),
  createTaskInstance: vi.fn().mockResolvedValue({ id: "instance-2" }),
  updateTaskInstance: vi.fn().mockResolvedValue(undefined),
  updateTaskInstanceStatus: vi.fn().mockResolvedValue(undefined),
  deleteTaskInstance: vi.fn().mockResolvedValue(undefined),
  generateTaskInstances: vi.fn().mockResolvedValue({ inserted: 1, updated: 2, skipped: 3 })
}));

function mountHarness() {
  const requestConfirmation = vi.fn().mockResolvedValue(true);
  const refresh = vi.fn();
  const Harness = defineComponent({
    components: { TaskInstanceManager },
    setup() {
      const selectedDate = ref("2026-05-01");
      const admin = useTaskInstanceAdmin({
        selectedDate,
        today: "2026-05-01",
        withStatus: async (action) => { await action(); },
        refresh,
        requestConfirmation
      });
      onMounted(admin.loadTaskInstanceRows);
      watch(admin.taskInstanceShowAll, admin.loadTaskInstanceRows);
      return { selectedDate, admin };
    },
    template: `
      <TaskInstanceManager
        v-model:selected-date="selectedDate"
        today="2026-05-01"
        yesterday="2026-04-30"
        v-model:show-all="admin.taskInstanceShowAll.value"
        :rows="admin.taskInstanceRows.value"
        :patrol-plans="[{ id: 'plan-1', name: '日常巡检', description: '', startAt: '2026-05-01T00:00:00+08:00', endAt: '2026-05-31T23:59:59+08:00', recurrenceType: 'infinite', skipWeekends: false, skipHolidays: false, enabled: true, cycleLength: 90 }]"
        :form="admin.taskInstanceForm"
        :form-open="admin.taskInstanceFormOpen.value"
        :refresh-form="admin.taskInstanceRefreshForm"
        :refresh-open="admin.taskInstanceRefreshOpen.value"
        :editing-id="admin.taskInstanceEditingId.value"
        :generation-summary="admin.taskInstanceGenerationSummary.value"
        @add="admin.openTaskInstanceCreate"
        @today="selectedDate = '2026-05-01'"
        @yesterday="selectedDate = '2026-04-30'"
        @edit="admin.openTaskInstanceEdit"
        @cancel="admin.cancelTaskInstance"
        @delete="admin.removeTaskInstance"
        @open-refresh="admin.openTaskInstanceRefresh"
        @close-refresh="admin.closeTaskInstanceRefresh"
        @refresh="admin.refreshTaskInstances([{ id: 'plan-1', name: '日常巡检', description: '', startAt: '2026-05-01T00:00:00+08:00', endAt: '2026-05-31T23:59:59+08:00', recurrenceType: 'infinite', skipWeekends: false, skipHolidays: false, enabled: true, cycleLength: 90 }])"
        @save="admin.saveTaskInstance"
        @close="admin.closeTaskInstanceForm"
      />`
  });

  return { wrapper: mount(Harness), requestConfirmation, refresh };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
}

describe("TaskInstanceManager", () => {
  it("lists selected-date instances", async () => {
    const { wrapper } = mountHarness();
    await flush();

    expect(fetchTaskInstances).toHaveBeenCalledWith("2026-05-01", "patrol", "date");
    expect(wrapper.find("thead tr").findAll("th").map((header) => header.text())).toEqual(["日期", "时间", "内容", "人员", "来源", "操作"]);
    expect(wrapper.find("tbody tr").findAll("td").slice(0, 5).map((cell) => cell.text())).toEqual([
      "2026-05-01",
      "上午",
      "人工巡视",
      "张三",
      "手动"
    ]);
    expect(wrapper.text()).toContain("人工巡视");
    expect(wrapper.text()).toContain("手动");
    expect(wrapper.text()).toContain("上午");
    expect(wrapper.text()).not.toContain("08:00:00");
  });

  it("loads all instances when show all is enabled", async () => {
    const { wrapper } = mountHarness();
    await flush();

    await wrapper.find('input[name="operationShowAll"]').setValue(true);
    await flush();

    expect(fetchTaskInstances).toHaveBeenLastCalledWith("2026-05-01", "patrol", "all");
    expect(wrapper.find('input[type="date"]').attributes("disabled")).toBeDefined();
  });

  it("saves manual instances through the create API", async () => {
    const { wrapper } = mountHarness();
    await flush();

    await wrapper.find('[aria-label="新增实例"]').trigger("click");

    expect(wrapper.find(".modal-backdrop").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("元数据 JSON");
    expect(wrapper.find('select[name="taskInstanceType"]').exists()).toBe(false);
    expect(wrapper.find('input[name="taskInstanceStartAt"]').exists()).toBe(false);
    expect(wrapper.find('input[name="taskInstanceEndAt"]').exists()).toBe(false);
    expect(wrapper.find('input[name="taskInstanceDate"]').exists()).toBe(true);
    expect(wrapper.find('select[name="taskInstanceTimeTag"]').exists()).toBe(true);
    expect(wrapper.find('input[name="taskInstanceTarget"]').exists()).toBe(true);

    await wrapper.find('input[name="taskInstanceDate"]').setValue("2026-05-02");
    await wrapper.find('select[name="taskInstanceTimeTag"]').setValue("下午");
    await wrapper.find('input[name="taskInstanceTarget"]').setValue("2号线");
    await wrapper.find('input[name="taskInstancePersonnel"]').setValue("李四");
    await wrapper.find('input[name="taskInstanceVehicle"]').setValue("巡检车");
    await wrapper.find('input[name="taskInstanceOther"]').setValue("带记录仪");
    await wrapper.find(".task-instance-modal").trigger("submit.prevent");

    expect(createTaskInstance).toHaveBeenCalledWith({
      type: "patrol",
      startAt: "2026-05-02T12:00:00+08:00",
      endAt: "2026-05-02T17:00:00+08:00",
      content: "2号线",
      metadata: {
        timeTag: "下午",
        target: "2号线",
        personnel: "李四",
        vehicle: "巡检车",
        other: "带记录仪"
      }
    });
  });

  it("confirms before regenerating instances", async () => {
    const { wrapper, requestConfirmation } = mountHarness();
    await flush();

    expect(wrapper.text()).not.toContain("生成至");
    expect(wrapper.find('input[name="taskInstanceGenerationEndDate"]').exists()).toBe(false);

    await wrapper.find(".manager-actions .secondary-action").trigger("click");

    expect(wrapper.find(".modal-backdrop").exists()).toBe(true);
    expect(wrapper.find('select[name="taskInstanceRefreshTemplate"]').element.value).toBe("");

    await wrapper.find('select[name="taskInstanceRefreshTemplate"]').setValue("plan-1");
    await wrapper.find('input[name="taskInstanceRefreshEndDate"]').setValue("2026-05-31");
    await wrapper.find(".task-instance-modal").trigger("submit.prevent");

    expect(requestConfirmation).toHaveBeenCalledWith(expect.objectContaining({ title: "刷新实例" }));
    expect(generateTaskInstances).toHaveBeenCalledWith({
      windowStartDate: "2026-05-01",
      windowEndDate: "2026-05-31",
      types: ["patrol"],
      templateIds: ["plan-1"],
      refreshPending: true
    });
    expect(wrapper.text()).toContain("新增 1，更新 2，跳过 3");
  });
});
