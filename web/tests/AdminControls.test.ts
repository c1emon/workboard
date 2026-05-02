// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ConfirmationDialog from "../src/components/admin/ConfirmationDialog.vue";
import DateToolbar from "../src/components/admin/DateToolbar.vue";
import ListHeader from "../src/components/admin/ListHeader.vue";
import TimeTagSelect from "../src/components/admin/TimeTagSelect.vue";

describe("admin controls", () => {
  it("updates time tag selection", async () => {
    const wrapper = mount(TimeTagSelect, {
      props: { modelValue: "全天" }
    });

    await wrapper.find("select").setValue("下午");

    expect(wrapper.findAll("option").map((option) => option.text())).toEqual(["全天", "上午", "下午"]);
    expect(wrapper.emitted("update:modelValue")).toEqual([["下午"]]);
  });

  it("renders list headings with the shared helper text", () => {
    const wrapper = mount(ListHeader, {
      props: { title: "许可列表" }
    });

    expect(wrapper.classes()).toContain("list-heading");
    expect(wrapper.text()).toContain("许可列表");
    expect(wrapper.text()).toContain("默认展示当天，可以切换日期查看历史或未来安排");
  });

  it("emits date toolbar actions", async () => {
    const wrapper = mount(DateToolbar, {
      props: {
        modelValue: "2026-05-01",
        today: "2026-05-02",
        yesterday: "2026-05-01",
        addLabel: "新增计划",
        allowShowAll: true,
        showAll: false
      }
    });

    await wrapper.find('input[type="date"]').setValue("2026-05-03");
    await wrapper.find(".yesterday-button").trigger("click");
    await wrapper.find(".today-button").trigger("click");
    await wrapper.find('input[name="operationShowAll"]').setValue(true);
    await wrapper.find('[aria-label="新增计划"]').trigger("click");

    expect(wrapper.classes()).toContain("date-toolbar");
    expect(wrapper.emitted("update:modelValue")).toEqual([["2026-05-03"]]);
    expect(wrapper.emitted("yesterday")).toEqual([[]]);
    expect(wrapper.emitted("today")).toEqual([[]]);
    expect(wrapper.emitted("update:showAll")).toEqual([[true]]);
    expect(wrapper.emitted("add")).toEqual([[]]);
  });

  it("emits confirmation dialog decisions", async () => {
    const wrapper = mount(ConfirmationDialog, {
      props: {
        title: "删除许可",
        message: "确认删除这条许可吗？",
        detail: "删除后不可恢复。",
        confirmLabel: "删除"
      }
    });

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("删除许可");
    expect(wrapper.text()).toContain("删除后不可恢复。");

    await wrapper.find(".confirmation-cancel").trigger("click");
    await wrapper.find(".confirmation-confirm").trigger("click");

    expect(wrapper.emitted("cancel")).toEqual([[]]);
    expect(wrapper.emitted("confirm")).toEqual([[]]);
  });
});
