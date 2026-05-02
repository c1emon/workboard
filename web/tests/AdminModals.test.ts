// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ArrangementModal from "../src/components/admin/ArrangementModal.vue";
import HolidayImportModal from "../src/components/admin/HolidayImportModal.vue";
import OperationItemModal from "../src/components/admin/OperationItemModal.vue";
import OperationPlanModal from "../src/components/admin/OperationPlanModal.vue";

describe("admin modals", () => {
  it("edits arrangement form fields and emits save or close", async () => {
    const form = {
      date: "2026-05-01",
      timeTag: "全天" as const,
      primary: "",
      personnel: "",
      secondary: "",
      tertiary: "",
      other: ""
    };
    const wrapper = mount(ArrangementModal, {
      props: {
        kind: "permit",
        title: "新增许可",
        form
      }
    });

    await wrapper.find('input[name="target"]').setValue("A区");
    await wrapper.find('input[name="task"]').setValue("动火许可");
    await wrapper.find(".modal-form").trigger("submit.prevent");
    await wrapper.find('[aria-label="关闭弹窗"]').trigger("click");

    expect(form.primary).toBe("A区");
    expect(form.secondary).toBe("动火许可");
    expect(wrapper.emitted("save")).toEqual([[]]);
    expect(wrapper.emitted("close")).toEqual([[]]);
  });

  it("edits holiday import settings and emits submit", async () => {
    const form = {
      source: "remote" as const,
      url: "https://example.test/chinese-days.json"
    };
    const wrapper = mount(HolidayImportModal, {
      props: { form }
    });

    await wrapper.find('input[name="holidayImportUrl"]').setValue("https://example.test/next.json");
    await wrapper.find(".holiday-import-modal").trigger("submit.prevent");

    expect(form.url).toBe("https://example.test/next.json");
    expect(wrapper.emitted("submit")).toEqual([[]]);
  });

  it("renders operation plan modal and emits timeline actions", async () => {
    const form = {
      name: "倒闸操作",
      description: "主线切换",
      startAt: "2026-05-01T08:00",
      endAt: "2026-05-01T20:00",
      recurrenceType: "once" as const,
      recurrenceIntervalMinutes: 1440,
      recurrenceCount: 7,
      skipWeekends: false,
      skipHolidays: false
    };
    const item = { id: "item-1", offsetMinutes: 0, durationMinutes: 60, content: "A、B 操作", metadata: {}, sortOrder: 0 };
    const wrapper = mount(OperationPlanModal, {
      props: {
        title: "修改计划",
        mode: "edit",
        form,
        readOnly: false,
        hasEndAt: true,
        computedEndAt: "2026-05-01T09:00",
        derivedRecurrenceIntervalMinutes: 60,
        derivedRecurrenceCount: 1,
        durationMinutes: 60,
        items: [item],
        selectedItemId: "item-1",
        canAddItems: true
      }
    });

    await wrapper.find('input[name="operationName"]').setValue("改名操作");
    await wrapper.find(".operation-modal").trigger("submit.prevent");

    expect(form.name).toBe("改名操作");
    expect(wrapper.emitted("save")).toEqual([[]]);
  });

  it("renders operation item modal and emits edit actions", async () => {
    const form = {
      id: "item-1",
      baseItemId: "",
      offsetHours: 0,
      offsetMinutes: 30,
      durationHours: 1,
      durationMinutes: 0,
      content: "复核记录",
      metadataJson: "{}",
      metadataExpanded: false,
      sortOrder: 0
    };
    const wrapper = mount(OperationItemModal, {
      props: {
        title: "编辑子任务",
        mode: "edit",
        form,
        readOnly: false,
        baseOptions: [{ id: "base-1", offsetMinutes: 0, durationMinutes: 30, content: "前置任务", metadata: {}, sortOrder: 0 }]
      }
    });

    await wrapper.find('input[name="operationItemContent"]').setValue("复核记录2");
    await wrapper.find('input[name="operationItemOffsetMinutes"]').trigger("change");
    await wrapper.find(".operation-item-delete").trigger("click");
    await wrapper.find(".operation-item-modal").trigger("submit.prevent");

    expect(form.content).toBe("复核记录2");
    expect(wrapper.emitted("normalize-offset")).toEqual([[]]);
    expect(wrapper.emitted("delete")).toEqual([[]]);
    expect(wrapper.emitted("save")).toEqual([[]]);
  });
});
