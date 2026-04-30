// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AdminView from "../src/views/AdminView.vue";

describe("AdminView", () => {
  it("renders the admin management sections", () => {
    const wrapper = mount(AdminView);

    expect(wrapper.text()).toContain("操作");
    expect(wrapper.text()).toContain("许可");
    expect(wrapper.text()).toContain("巡视");
    expect(wrapper.text()).toContain("其他");
    expect(wrapper.text()).toContain("休假");
    expect(wrapper.text()).toContain("节假日");
  });
});
