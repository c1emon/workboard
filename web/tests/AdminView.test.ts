// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminView from "../src/views/AdminView.vue";
import { createPermit } from "../src/api/client";

vi.mock("../src/api/client", () => ({
  createHoliday: vi.fn().mockResolvedValue({ id: "holiday-1" }),
  createLeavePerson: vi.fn().mockResolvedValue({ id: "leave-1" }),
  createOtherArrangement: vi.fn().mockResolvedValue({ id: "other-1" }),
  createPermit: vi.fn().mockResolvedValue({ id: "permit-1" }),
  createTaskContainer: vi.fn().mockResolvedValue({ id: "container-1" }),
  createTaskItem: vi.fn().mockResolvedValue({ id: "item-1" })
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

describe("AdminView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the admin management sections", () => {
    const wrapper = mountAdmin();

    expect(wrapper.text()).toContain("操作");
    expect(wrapper.text()).toContain("许可");
    expect(wrapper.text()).toContain("巡视");
    expect(wrapper.text()).toContain("其他");
    expect(wrapper.text()).toContain("休假");
    expect(wrapper.text()).toContain("节假日");
  });

  it("submits a permit arrangement", async () => {
    const wrapper = mountAdmin();
    await wrapper.findAll(".section-nav button")[1].trigger("click");

    await wrapper.find('input[required]').setValue("2026-05-01");
    await wrapper.findAll("input")[1].setValue("动火许可");
    await wrapper.findAll("input")[2].setValue("张三");
    await wrapper.findAll("input")[3].setValue("A区");
    await wrapper.findAll("input")[4].setValue("已审批");
    await wrapper.find("form").trigger("submit.prevent");

    expect(createPermit).toHaveBeenCalledWith({
      date: "2026-05-01",
      timeTag: "全天",
      permit: "动火许可",
      personnel: "张三",
      area: "A区",
      other: "已审批"
    });
  });
});
