// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("fills empty cells with a muted dash", () => {
    const wrapper = mount(DenseRows, {
      props: {
        columns,
        rows: [{ timeTag: "上午", task: "" }],
        visibleRows: 2
      }
    });

    const cells = wrapper.findAll(".dense-cell");

    expect(cells[1].text()).toBe("-");
    expect(cells[1].classes()).toContain("muted-cell");
  });

  it("centers dense table headers and cells", () => {
    const source = readFileSync(resolve(__dirname, "../src/components/DenseRows.vue"), "utf8");

    expect(source).toMatch(/\.dense-head span,[\s\S]*\.dense-cell \{[^}]*text-align: center;/);
    expect(source).toMatch(/\.time-cell \{[^}]*justify-content: center;/);
  });
});
