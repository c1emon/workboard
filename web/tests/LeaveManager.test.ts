// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import LeaveManager from "../src/components/admin/LeaveManager.vue";

describe("LeaveManager", () => {
  it("renders leave people and emits toolbar and delete actions", async () => {
    const wrapper = mount(LeaveManager, {
      props: {
        selectedDate: "2026-05-01",
        today: "2026-05-02",
        yesterday: "2026-05-01",
        rows: [
          {
            id: "leave-1",
            date: "2026-05-01",
            name: "王五",
            enabled: true
          }
        ]
      }
    });

    expect(wrapper.text()).toContain("休假列表");
    expect(wrapper.find(".leave-table").exists()).toBe(true);
    expect(wrapper.find("tbody tr").text()).toContain("王五");

    await wrapper.find('input[type="date"]').setValue("2026-05-03");
    await wrapper.find(".yesterday-button").trigger("click");
    await wrapper.find(".today-button").trigger("click");
    await wrapper.find('[aria-label="新增休假"]').trigger("click");
    await wrapper.find("tbody .row-actions .danger").trigger("click");

    expect(wrapper.emitted("update:selectedDate")).toEqual([["2026-05-03"]]);
    expect(wrapper.emitted("yesterday")).toEqual([[]]);
    expect(wrapper.emitted("today")).toEqual([[]]);
    expect(wrapper.emitted("add")).toEqual([[]]);
    expect(wrapper.emitted("delete")).toEqual([["leave-1"]]);
  });

  it("shows an empty state when no leave people exist", () => {
    const wrapper = mount(LeaveManager, {
      props: {
        selectedDate: "2026-05-01",
        today: "2026-05-02",
        yesterday: "2026-05-01",
        rows: []
      }
    });

    expect(wrapper.text()).toContain("当前日期暂无休假人员");
  });
});
