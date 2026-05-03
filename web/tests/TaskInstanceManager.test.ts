// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { defineComponent, onMounted, ref } from "vue";
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
      metadata: { target: "1号线" },
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
      return { selectedDate, admin };
    },
    template: `
      <TaskInstanceManager
        v-model:selected-date="selectedDate"
        v-model:generation-end-date="admin.taskInstanceGenerationEndDate.value"
        today="2026-05-01"
        yesterday="2026-04-30"
        :rows="admin.taskInstanceRows.value"
        :form="admin.taskInstanceForm"
        :form-open="admin.taskInstanceFormOpen.value"
        :editing-id="admin.taskInstanceEditingId.value"
        :generation-summary="admin.taskInstanceGenerationSummary.value"
        @add="admin.openTaskInstanceCreate"
        @today="selectedDate = '2026-05-01'"
        @yesterday="selectedDate = '2026-04-30'"
        @edit="admin.openTaskInstanceEdit"
        @cancel="admin.cancelTaskInstance"
        @delete="admin.removeTaskInstance"
        @regenerate="admin.regenerateTaskInstances"
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

    expect(fetchTaskInstances).toHaveBeenCalledWith("2026-05-01", "patrol");
    expect(wrapper.text()).toContain("人工巡视");
    expect(wrapper.text()).toContain("手动");
  });

  it("saves manual instances through the create API", async () => {
    const { wrapper } = mountHarness();
    await flush();

    await wrapper.find('[aria-label="新增实例"]').trigger("click");
    await wrapper.find('input[name="taskInstanceContent"]').setValue("临时巡视");
    await wrapper.find('select[name="taskInstanceType"]').setValue("patrol");
    await wrapper.find(".inline-admin-form").trigger("submit.prevent");

    expect(createTaskInstance).toHaveBeenCalledWith(expect.objectContaining({
      type: "patrol",
      content: "临时巡视"
    }));
  });

  it("confirms before regenerating instances", async () => {
    const { wrapper, requestConfirmation } = mountHarness();
    await flush();

    await wrapper.find('input[name="taskInstanceGenerationEndDate"]').setValue("2026-05-31");
    await wrapper.find(".manager-actions .secondary-action").trigger("click");

    expect(requestConfirmation).toHaveBeenCalledWith(expect.objectContaining({ title: "重新生成实例" }));
    expect(generateTaskInstances).toHaveBeenCalledWith({
      windowStartDate: "2026-05-01",
      windowEndDate: "2026-05-31",
      types: ["patrol"],
      refreshPending: true
    });
    expect(wrapper.text()).toContain("新增 1，更新 2，跳过 3");
  });
});
