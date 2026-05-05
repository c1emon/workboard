// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import ArrangementModal from "../src/components/admin/ArrangementModal.vue";
import HolidayImportModal from "../src/components/admin/HolidayImportModal.vue";
import OperationItemModal from "../src/components/admin/OperationItemModal.vue";
import OperationPlanModal from "../src/components/admin/OperationPlanModal.vue";

describe("admin modals", () => {
  function operationItemForm(overrides: Partial<{
    extData: Record<string, unknown>;
  }> = {}) {
    return {
      id: "item-1",
      baseItemId: "",
      offsetHours: 0,
      offsetMinutes: 30,
      durationHours: 1,
      durationMinutes: 0,
      content: "复核记录",
      extData: {},
      sortOrder: 0,
      ...overrides
    };
  }

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
    const item = { id: "item-1", offsetMinutes: 0, durationMinutes: 60, content: "A、B 操作", extData: {}, sortOrder: 0 };
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

  it("shows the operation end time input only for finite plans", async () => {
    const baseForm: {
      name: string;
      description: string;
      startAt: string;
      endAt: string;
      recurrenceType: "once" | "finite" | "infinite";
      recurrenceIntervalMinutes: number;
      recurrenceCount: number;
      skipWeekends: boolean;
      skipHolidays: boolean;
    } = {
      name: "倒闸操作",
      description: "主线切换",
      startAt: "2026-05-01T08:00",
      endAt: "2026-05-01T20:00",
      recurrenceType: "once",
      recurrenceIntervalMinutes: 1440,
      recurrenceCount: 7,
      skipWeekends: false,
      skipHolidays: false
    };
    const mountModal = (form: typeof baseForm) =>
      mount(OperationPlanModal, {
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
          items: [],
          selectedItemId: null,
          canAddItems: true
        }
      });

    const onceWrapper = mountModal(baseForm);
    expect(onceWrapper.find('input[name="operationEndAt"]').exists()).toBe(false);

    const infiniteWrapper = mountModal({ ...baseForm, recurrenceType: "infinite" });
    expect(infiniteWrapper.find('input[name="operationEndAt"]').exists()).toBe(false);

    const finiteForm = { ...baseForm, recurrenceType: "finite" as const };
    const finiteWrapper = mountModal(finiteForm);
    const endInput = finiteWrapper.find('input[name="operationEndAt"]');
    expect(endInput.exists()).toBe(true);
    expect(endInput.attributes("disabled")).toBeUndefined();

    await endInput.setValue("2026-05-01T18:30");

    expect(finiteForm.endAt).toBe("2026-05-01T18:30");
  });

  it("renders operation item modal without exposing extension JSON and emits edit actions", async () => {
    const form = operationItemForm({ extData: { crew: "B" } });
    const wrapper = mount(OperationItemModal, {
      props: {
        title: "编辑子任务",
        mode: "edit",
        form,
        readOnly: false,
        baseOptions: [{ id: "base-1", offsetMinutes: 0, durationMinutes: 30, content: "前置任务", extData: {}, sortOrder: 0 }]
      }
    });

    expect(wrapper.text().toLowerCase()).not.toContain("extdata json");
    expect(wrapper.find(".operation-item-extData-toggle").exists()).toBe(false);
    expect(wrapper.find('textarea[name="operationItemExtData"]').exists()).toBe(false);

    await wrapper.find('input[name="operationItemContent"]').setValue("复核记录2");
    await wrapper.find('input[name="operationItemOffsetMinutes"]').trigger("change");
    await wrapper.find(".operation-item-delete").trigger("click");
    await wrapper.find(".operation-item-modal").trigger("submit.prevent");

    expect(form.content).toBe("复核记录2");
    expect(wrapper.emitted("normalize-offset")).toEqual([[]]);
    expect(wrapper.emitted("delete")).toEqual([[]]);
    expect(wrapper.emitted("save")).toEqual([[]]);
  });

  it("never exposes operation item extData as editable JSON", async () => {
    const form = operationItemForm();
    const wrapper = mount(OperationItemModal, {
      props: {
        title: "编辑子任务",
        mode: "edit",
        form,
        readOnly: false,
        baseOptions: []
      }
    });

    expect(wrapper.find('textarea[name="operationItemExtData"]').exists()).toBe(false);
    expect(wrapper.find(".operation-item-extData-toggle").exists()).toBe(false);
    expect(wrapper.text().toLowerCase()).not.toContain("extdata json");
  });

  it("keeps non-default and readonly extData hidden from the item modal", () => {
    const nonDefaultWrapper = mount(OperationItemModal, {
      props: {
        title: "编辑子任务",
        mode: "edit",
        form: operationItemForm({ extData: { crew: "B" } }),
        readOnly: false,
        baseOptions: []
      }
    });
    const readonlyWrapper = mount(OperationItemModal, {
      props: {
        title: "子任务详情",
        mode: "edit",
        form: operationItemForm(),
        readOnly: true,
        baseOptions: []
      }
    });

    expect(nonDefaultWrapper.find(".operation-item-extData-toggle").exists()).toBe(false);
    expect(nonDefaultWrapper.find('textarea[name="operationItemExtData"]').exists()).toBe(false);
    expect(nonDefaultWrapper.text().toLowerCase()).not.toContain("extdata json");
    expect(readonlyWrapper.find('textarea[name="operationItemExtData"]').exists()).toBe(false);
    expect(readonlyWrapper.text().toLowerCase()).not.toContain("extdata json");
    expect(readonlyWrapper.text()).not.toContain("{}");
  });

  it("keeps operation modal content scrollable when child task lists are long", () => {
    const source = readFileSync(resolve(__dirname, "../src/components/admin/OperationPlanModal.vue"), "utf8");

    expect(source).toContain("operation-modal-body");
    expect(source).toMatch(/\.operation-modal\s*\{[^}]*max-height:/s);
    expect(source).toMatch(/\.operation-modal\s*\{[^}]*grid-template-rows:/s);
    expect(source).toMatch(/\.operation-modal-body\s*\{[^}]*overflow-y:\s*auto/s);
  });
});
