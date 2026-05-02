// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HolidayManager from "../src/components/admin/HolidayManager.vue";
import OperationManager from "../src/components/admin/OperationManager.vue";
import OtherManager from "../src/components/admin/OtherManager.vue";
import PatrolManager from "../src/components/admin/PatrolManager.vue";
import PermitManager from "../src/components/admin/PermitManager.vue";

const calendarProps = {
  selectedDate: "2026-05-01",
  today: "2026-05-02",
  yesterday: "2026-05-01"
};

describe("admin managers", () => {
  it("renders permit rows and emits row actions", async () => {
    const wrapper = mount(PermitManager, {
      props: {
        ...calendarProps,
        rows: [
          {
            id: "permit-1",
            date: "2026-05-01",
            timeTag: "上午",
            startAt: "2026-05-01T08:00:00+08:00",
            endAt: "2026-05-01T12:00:00+08:00",
            permit: "动火许可",
            personnel: "张三",
            area: "A区",
            other: "已审批",
            enabled: true
          }
        ]
      }
    });

    expect(wrapper.text()).toContain("许可列表");
    expect(wrapper.text()).toContain("动火许可");

    await wrapper.find('[aria-label="禁用许可"]').trigger("click");
    await wrapper.findAll("tbody .row-actions button")[1].trigger("click");
    await wrapper.find("tbody .row-actions .danger").trigger("click");

    expect(wrapper.emitted("toggle")?.[0][0]).toMatchObject({ id: "permit-1" });
    expect(wrapper.emitted("edit")?.[0][0]).toMatchObject({ id: "permit-1" });
    expect(wrapper.emitted("delete")).toEqual([["permit-1"]]);
  });

  it("renders patrol rows and emits row actions", async () => {
    const wrapper = mount(PatrolManager, {
      props: {
        ...calendarProps,
        rows: [
          {
            id: "patrol-1",
            itemId: "item-1",
            date: "2026-05-01",
            timeTag: "下午",
            startAt: "2026-05-01T12:00:00+08:00",
            endAt: "2026-05-01T17:00:00+08:00",
            target: "1号线",
            personnel: "李四",
            vehicle: "皮卡",
            other: "带记录仪",
            enabled: true
          }
        ]
      }
    });

    expect(wrapper.text()).toContain("巡视列表");
    expect(wrapper.text()).toContain("1号线");

    await wrapper.findAll("tbody .row-actions button")[0].trigger("click");
    await wrapper.findAll("tbody .row-actions button")[1].trigger("click");
    await wrapper.find("tbody .row-actions .danger").trigger("click");

    expect(wrapper.emitted("toggle")?.[0][0]).toMatchObject({ id: "patrol-1" });
    expect(wrapper.emitted("edit")?.[0][0]).toMatchObject({ id: "patrol-1" });
    expect(wrapper.emitted("delete")).toEqual([["patrol-1"]]);
  });

  it("renders other rows and emits row actions", async () => {
    const wrapper = mount(OtherManager, {
      props: {
        ...calendarProps,
        rows: [
          {
            id: "other-1",
            date: "2026-05-01",
            timeTag: "全天",
            startAt: "2026-05-01T00:00:00+08:00",
            endAt: "2026-05-01T23:59:59+08:00",
            task: "清点物资",
            personnel: "王五",
            vehicle: "",
            other: "",
            enabled: false
          }
        ]
      }
    });

    expect(wrapper.text()).toContain("其他列表");
    expect(wrapper.text()).toContain("清点物资");

    await wrapper.findAll("tbody .row-actions button")[0].trigger("click");
    await wrapper.findAll("tbody .row-actions button")[1].trigger("click");
    await wrapper.find("tbody .row-actions .danger").trigger("click");

    expect(wrapper.emitted("toggle")?.[0][0]).toMatchObject({ id: "other-1" });
    expect(wrapper.emitted("edit")?.[0][0]).toMatchObject({ id: "other-1" });
    expect(wrapper.emitted("delete")).toEqual([["other-1"]]);
  });

  it("renders operation rows and emits row actions", async () => {
    const wrapper = mount(OperationManager, {
      props: {
        ...calendarProps,
        showAll: false,
        rows: [
          {
            id: "operation-1",
            name: "倒闸操作",
            description: "主线切换",
            startAt: "2026-05-01T08:00:00+08:00",
            endAt: "2026-05-01T20:00:00+08:00",
            recurrenceType: "finite",
            recurrenceIntervalMinutes: 240,
            recurrenceCount: 3,
            skipWeekends: false,
            skipHolidays: false,
            enabled: true,
            childTaskCount: 2,
            firstItemContent: "A、B 操作"
          }
        ]
      }
    });

    expect(wrapper.text()).toContain("操作计划");
    expect(wrapper.text()).toContain("有限循环");

    await wrapper.findAll("tbody .row-actions button")[0].trigger("click");
    await wrapper.findAll("tbody .row-actions button")[1].trigger("click");
    await wrapper.findAll("tbody .row-actions button")[2].trigger("click");
    await wrapper.find("tbody .row-actions .danger").trigger("click");

    expect(wrapper.emitted("detail")?.[0][0]).toMatchObject({ id: "operation-1" });
    expect(wrapper.emitted("toggle")?.[0][0]).toMatchObject({ id: "operation-1" });
    expect(wrapper.emitted("edit")?.[0][0]).toMatchObject({ id: "operation-1" });
    expect(wrapper.emitted("delete")).toEqual([["operation-1"]]);
  });

  it("renders holiday and adjusted workday rows", async () => {
    const wrapper = mount(HolidayManager, {
      props: {
        year: 2026,
        holidayRows: [{ id: "holiday-1", date: "2026-05-01", name: "劳动节", type: "holiday" }],
        adjustedWorkdayRows: [{ id: "workday-1", date: "2026-04-26", name: "劳动节", type: "adjusted_workday" }]
      }
    });

    expect(wrapper.text()).toContain("节假日");
    expect(wrapper.text()).toContain("2026-05-01");
    expect(wrapper.text()).toContain("2026-04-26");

    await wrapper.find('input[name="holidayYear"]').setValue("2027");
    await wrapper.find('[aria-label="导入 chinese-days"]').trigger("click");

    expect(wrapper.emitted("update:year")).toEqual([[2027]]);
    expect(wrapper.emitted("import")).toEqual([[]]);
  });
});
