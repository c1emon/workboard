// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { defineComponent, onMounted } from "vue";
import { describe, expect, it, vi } from "vitest";
import PatrolPlanManager from "../src/components/admin/PatrolPlanManager.vue";
import { usePatrolPlanAdmin } from "../src/composables/admin/usePatrolPlanAdmin";
import { fetchPatrolPlan, fetchPatrolPlans, updatePatrolPlanItem } from "../src/api/client";

vi.mock("../src/api/client", () => ({
  fetchPatrolPlans: vi.fn().mockResolvedValue([
    {
      id: "plan-1",
      name: "日常巡检",
      description: "90天周期",
      startAt: "2026-05-01T00:00:00+08:00",
      endAt: "2026-07-29T23:59:59+08:00",
      skipWeekends: false,
      skipHolidays: true,
      enabled: true,
      cycleLength: 90
    }
  ]),
  fetchPatrolPlan: vi.fn().mockResolvedValue({
    id: "plan-1",
    name: "日常巡检",
    description: "90天周期",
    startAt: "2026-05-01T00:00:00+08:00",
    endAt: "2026-07-29T23:59:59+08:00",
    skipWeekends: false,
    skipHolidays: true,
    enabled: true,
    cycleLength: 90,
    items: [
      {
        id: "item-1",
        templateId: "plan-1",
        cycleDay: 1,
        timeTag: "上午",
        target: "1号线",
        personnel: "张三",
        vehicle: "巡检车",
        other: "带记录仪",
        content: "1号线",
        sortOrder: 0
      }
    ]
  }),
  createPatrolPlan: vi.fn().mockResolvedValue({ id: "plan-2" }),
  updatePatrolPlan: vi.fn().mockResolvedValue(undefined),
  updatePatrolPlanEnabled: vi.fn().mockResolvedValue(undefined),
  deletePatrolPlan: vi.fn().mockResolvedValue(undefined),
  createPatrolPlanItem: vi.fn().mockResolvedValue({ id: "item-2" }),
  updatePatrolPlanItem: vi.fn().mockResolvedValue(undefined),
  deletePatrolPlanItem: vi.fn().mockResolvedValue(undefined)
}));

function mountHarness() {
  const Harness = defineComponent({
    components: { PatrolPlanManager },
    setup() {
      const admin = usePatrolPlanAdmin({
        withStatus: async (action) => { await action(); },
        refresh: vi.fn(),
        requestConfirmation: vi.fn().mockResolvedValue(true)
      });
      onMounted(admin.loadPatrolPlans);
      return { admin };
    },
    template: `
      <PatrolPlanManager
        :rows="admin.patrolPlanRows.value"
        :detail="admin.patrolPlanDetail.value"
        :plan-form="admin.patrolPlanForm"
        :plan-form-open="admin.patrolPlanFormOpen.value"
        :plan-editing-id="admin.patrolPlanEditingId.value"
        :item-form="admin.patrolCycleItemForm"
        :item-editing-id="admin.patrolCycleItemEditingId.value"
        @add-plan="admin.openPatrolPlanCreate"
        @edit-plan="admin.openPatrolPlanEdit"
        @select-plan="admin.selectPatrolPlan"
        @toggle-plan="admin.togglePatrolPlan"
        @delete-plan="admin.removePatrolPlan"
        @close-plan="admin.closePatrolPlanForm"
        @save-plan="admin.savePatrolPlan"
        @add-item="admin.openPatrolCycleItemCreate"
        @edit-item="admin.openPatrolCycleItemEdit"
        @delete-item="admin.removePatrolCycleItem"
        @save-item="admin.savePatrolCycleItem"
      />`
  });

  return mount(Harness);
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
}

describe("PatrolPlanManager", () => {
  it("shows patrol plans and cycle rows", async () => {
    const wrapper = mountHarness();
    await flush();

    expect(fetchPatrolPlans).toHaveBeenCalled();
    expect(fetchPatrolPlan).toHaveBeenCalledWith("plan-1");
    expect(wrapper.text()).toContain("日常巡检");
    expect(wrapper.text()).toContain("1号线");
    expect(wrapper.text()).toContain("张三");
  });

  it("saves edited cycle items", async () => {
    const wrapper = mountHarness();
    await flush();

    await wrapper.find(".cycle-detail tbody .row-actions button").trigger("click");
    await wrapper.find('input[name="patrolCycleTarget"]').setValue("2号线");
    await wrapper.find(".cycle-detail .inline-admin-form").trigger("submit.prevent");

    expect(updatePatrolPlanItem).toHaveBeenCalledWith(
      "plan-1",
      "item-1",
      expect.objectContaining({
        cycleDay: 1,
        target: "2号线"
      })
    );
  });
});
