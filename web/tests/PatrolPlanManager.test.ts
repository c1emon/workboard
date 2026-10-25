// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineComponent, onMounted } from "vue";
import { describe, expect, it, vi } from "vitest";
import PatrolPlanManager from "../src/components/admin/PatrolPlanManager.vue";
import { usePatrolPlanAdmin } from "../src/composables/admin/usePatrolPlanAdmin";
import { createPatrolPlan, createPatrolPlanItem, fetchPatrolPlan, fetchPatrolPlans, importPatrolPlanItems, updatePatrolPlan, updatePatrolPlanItem } from "../src/api/client";
import { parsePatrolCycleItemExcel } from "../src/utils/patrolCycleItemExcel";

vi.mock("../src/utils/patrolCycleItemExcel", () => ({
  parsePatrolCycleItemExcel: vi.fn().mockResolvedValue([
    { cycleDay: 1, timeTag: "上午", target: "1号线", personnel: "张三", vehicle: "巡检车", other: "带记录仪" },
    { cycleDay: 2, timeTag: "下午", target: "2号线", personnel: "李四", vehicle: "", other: "" }
  ])
}));

vi.mock("../src/api/client", () => ({
  fetchPatrolPlans: vi.fn().mockResolvedValue([
    {
      id: "plan-1",
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
    id: "plan-1",
    name: "日常巡检",
    description: "90天周期",
    startAt: "2026-05-01T00:00:00+08:00",
    endAt: "2026-07-29T23:59:59+08:00",
    recurrenceType: "infinite",
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
  importPatrolPlanItems: vi.fn().mockResolvedValue({ imported: 2, cycleLength: 2 }),
  deletePatrolPlanItem: vi.fn().mockResolvedValue(undefined)
}));

function mountHarness() {
  const requestConfirmation = vi.fn().mockResolvedValue(true);
  const refresh = vi.fn();
  const Harness = defineComponent({
    components: { PatrolPlanManager },
    setup() {
      const admin = usePatrolPlanAdmin({
        withStatus: async (action) => { await action(); },
        refresh,
        requestConfirmation
      });
      onMounted(admin.loadPatrolPlans);
      return { admin };
    },
    template: `
      <PatrolPlanManager
        :rows="admin.patrolPlanRows.value"
        :detail="admin.patrolPlanDetail.value"
        :detail-open="admin.patrolPlanDetailOpen.value"
        :item-manager-open="admin.patrolCycleItemManagerOpen.value"
        :plan-form="admin.patrolPlanForm"
        :plan-form-open="admin.patrolPlanFormOpen.value"
        :plan-editing-id="admin.patrolPlanEditingId.value"
        :item-form="admin.patrolCycleItemForm"
        :item-form-open="admin.patrolCycleItemFormOpen.value"
        :item-editing-id="admin.patrolCycleItemEditingId.value"
        @add-plan="admin.openPatrolPlanCreate"
        @edit-plan="admin.openPatrolPlanEdit"
        @select-plan="admin.selectPatrolPlan"
        @manage-items="admin.openPatrolCycleItemManager"
        @close-detail="admin.closePatrolPlanDetail"
        @close-item-manager="admin.closePatrolCycleItemManager"
        @toggle-plan="admin.togglePatrolPlan"
        @delete-plan="admin.removePatrolPlan"
        @close-plan="admin.closePatrolPlanForm"
        @save-plan="admin.savePatrolPlan"
        @add-item="admin.openPatrolCycleItemCreate"
        @edit-item="admin.openPatrolCycleItemEdit"
        @delete-item="admin.removePatrolCycleItem"
        @close-item-form="admin.closePatrolCycleItemForm"
        @save-item="admin.savePatrolCycleItem"
        @import-file="admin.importPatrolCycleItemsFromExcel"
      />`
  });

  return { wrapper: mount(Harness), requestConfirmation, refresh };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
}

describe("PatrolPlanManager", () => {
  it("opens patrol plan detail from the detail action", async () => {
    const { wrapper } = mountHarness();
    await flush();

    expect(fetchPatrolPlans).toHaveBeenCalled();
    expect(fetchPatrolPlan).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("日常巡检");

    await wrapper.find("tbody .row-actions button").trigger("click");
    await flush();

    expect(fetchPatrolPlan).toHaveBeenCalledWith("plan-1");
    expect(wrapper.find(".patrol-detail-modal").exists()).toBe(true);
    expect(wrapper.text()).toContain("1号线");
    expect(wrapper.text()).toContain("张三");
    expect(wrapper.find(".patrol-detail-modal").text()).not.toContain("新增周期项");
    expect(wrapper.find(".patrol-detail-modal").text()).not.toContain("修改");
    expect(wrapper.find(".patrol-detail-modal").text()).not.toContain("删除");
  });

  it("opens patrol plan creation in a modal", async () => {
    const { wrapper } = mountHarness();
    await flush();

    await wrapper.find('[aria-label="新增巡视模板"]').trigger("click");

    expect(wrapper.find(".modal-backdrop").exists()).toBe(true);
    expect(wrapper.find(".patrol-plan-modal").exists()).toBe(true);
    expect(wrapper.find('input[name="patrolPlanStartAt"]').attributes("type")).toBe("date");
    expect(wrapper.find('input[name="patrolPlanEndAt"]').exists()).toBe(false);
    expect(wrapper.find('select[name="patrolPlanRecurrenceType"]').exists()).toBe(true);
    expect(wrapper.find('input[name="patrolPlanCycleLength"]').exists()).toBe(false);
    expect(wrapper.find('input[name="patrolPlanSkipWeekends"]').element).toHaveProperty("checked", true);

    await wrapper.find('input[name="patrolPlanName"]').setValue("临时巡检");
    await wrapper.find('input[name="patrolPlanStartAt"]').setValue("2026-05-01");
    await wrapper.find('select[name="patrolPlanRecurrenceType"]').setValue("once");
    await wrapper.find(".patrol-plan-modal").trigger("submit.prevent");

    expect(createPatrolPlan).toHaveBeenCalledWith(expect.objectContaining({
      name: "临时巡检",
      startAt: "2026-05-01T00:00:00+08:00",
      endAt: "2026-05-01T23:59:59+08:00",
      recurrenceType: "once",
      skipWeekends: true
    }));
  });

  it("derives patrol plan end time from the current cycle length when editing", async () => {
    const { wrapper } = mountHarness();
    await flush();

    await wrapper.findAll("tbody .row-actions button")[2].trigger("click");

    expect(wrapper.find('input[name="patrolPlanEndAt"]').exists()).toBe(false);

    await wrapper.find('input[name="patrolPlanStartAt"]').setValue("2026-06-01");
    await wrapper.find(".patrol-plan-modal").trigger("submit.prevent");

    expect(updatePatrolPlan).toHaveBeenCalledWith("plan-1", expect.objectContaining({
      startAt: "2026-06-01T00:00:00+08:00",
      endAt: "2026-08-29T23:59:59+08:00"
    }));
  });

  it("manages patrol cycle items from a dedicated modal", async () => {
    const { wrapper } = mountHarness();
    await flush();

    await wrapper.findAll("tbody .row-actions button")[1].trigger("click");
    await flush();

    expect(fetchPatrolPlan).toHaveBeenCalledWith("plan-1");
    expect(wrapper.find(".patrol-item-manager-modal").exists()).toBe(true);
    expect(wrapper.find(".patrol-item-manager-modal").text()).toContain("修改");
    expect(wrapper.find(".patrol-item-manager-modal").text()).toContain("删除");
    expect(wrapper.find(".patrol-item-manager-modal").text()).toContain("导入周期项");
    expect(wrapper.find('.detail-toolbar').text()).toContain('导入模板下载');

    await wrapper.find('[aria-label="新增周期项"]').trigger("click");
    expect(wrapper.find(".patrol-cycle-item-modal").exists()).toBe(true);
    expect(wrapper.find('input[name="patrolCycleSortOrder"]').exists()).toBe(false);
    await wrapper.find('input[name="patrolCycleTarget"]').setValue("2号线");
    await wrapper.find(".patrol-cycle-item-modal").trigger("submit.prevent");
    expect(createPatrolPlanItem).toHaveBeenCalledWith("plan-1", expect.objectContaining({ target: "2号线", sortOrder: 1 }));

    await wrapper.find(".patrol-item-manager-modal tbody .row-actions button").trigger("click");
    expect(wrapper.find(".patrol-cycle-item-modal").exists()).toBe(true);
    await wrapper.find('input[name="patrolCycleTarget"]').setValue("3号线");
    await wrapper.find(".patrol-cycle-item-modal").trigger("submit.prevent");
    expect(updatePatrolPlanItem).toHaveBeenCalledWith("plan-1", "item-1", expect.objectContaining({ target: "3号线" }));
  });

  it("opens the shared import step with an explicit target", async () => {
    const { wrapper } = mountHarness();
    await flush();
    await wrapper.findAll('tbody .row-actions button')[1].trigger('click');
    await flush();
    const manager = wrapper.findComponent(PatrolPlanManager);
    const button = manager.findAll('.detail-toolbar button').find(button => button.text() === '导入周期项')!;
    await button.trigger('click');
    expect(manager.emitted('open-import')?.[0][0]).toMatchObject({ id: 'plan-1', name: '日常巡检' });
    expect(importPatrolPlanItems).not.toHaveBeenCalled();
  });

  it("keeps long patrol cycle item lists scrollable inside the manager modal", () => {
    const source = readFileSync(resolve(__dirname, "../src/components/admin/PatrolPlanManager.vue"), "utf8");

    expect(source).toContain("patrol-item-manager-table");
    expect(source).toContain("patrol-detail-table");
    expect(source).toMatch(/\.patrol-detail-modal\s*\{[^}]*max-height:/s);
    expect(source).toMatch(/\.patrol-item-manager-modal\s*\{[^}]*max-height:/s);
    expect(source).toMatch(/\.patrol-item-manager-modal\s*\{[^}]*grid-template-rows:/s);
    expect(source).toMatch(/\.patrol-item-manager-table\s*\{[^}]*overflow-y:\s*auto/s);
    expect(source).toMatch(/\.patrol-detail-table\s*\{[^}]*overflow-y:\s*auto/s);
  });
});
