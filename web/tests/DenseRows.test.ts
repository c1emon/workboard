// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DenseRows, { type DenseColumn } from "../src/components/DenseRows.vue";

const columns: DenseColumn[] = [
  { key: "timeTag", label: "时间" },
  { key: "task", label: "任务" }
];

const rows = Array.from({ length: 8 }, (_, index) => ({
  timeTag: index % 2 === 0 ? "上午" : "下午",
  task: `任务 ${index + 1}`
}));

describe("DenseRows", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("automatically scrolls when rows exceed the visible height", () => {
    const wrapper = mount(DenseRows, {
      props: {
        columns,
        rows,
        visibleRows: 2
      }
    });

    expect(wrapper.find(".scroll-track").classes()).toContain("looping");
  });

  it("duplicates overflowing rows for seamless continuous scrolling", () => {
    const wrapper = mount(DenseRows, {
      props: {
        columns,
        rows,
        visibleRows: 2
      }
    });

    expect(wrapper.findAll(".dense-row")).toHaveLength(rows.length * 2);
    expect(wrapper.find(".scroll-track").attributes("style")).toContain("--row-count: 8");
  });

  it("uses a narrow fixed width for time columns", () => {
    const wrapper = mount(DenseRows, {
      props: {
        columns,
        rows,
        visibleRows: 2
      }
    });

    expect(wrapper.attributes("style")).toContain("--grid-template-columns: 56px minmax(0, 1fr)");
  });

  it("shows a muted empty plan message when there are no rows", () => {
    const wrapper = mount(DenseRows, {
      props: {
        columns,
        rows: [],
        visibleRows: 2
      }
    });

    expect(wrapper.find(".empty-plan").text()).toBe("无计划安排");
    expect(wrapper.findAll(".empty-row")).toHaveLength(0);
  });
});
