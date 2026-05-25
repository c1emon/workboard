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
    expect(wrapper.find(".dense-body").exists()).toBe(true);
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

  it("prioritizes task column width and keeps time columns compact", () => {
    const wrapper = mount(DenseRows, {
      props: {
        columns: [
          { key: "timeTag", label: "时间" },
          { key: "target", label: "对象" },
          { key: "task", label: "任务" },
          { key: "personnel", label: "人员" },
          { key: "vehicle", label: "车辆" },
          { key: "other", label: "其他" }
        ],
        rows,
        visibleRows: 2
      }
    });

    expect(wrapper.attributes("style")).toContain(
      "--grid-template-columns: 58px minmax(112px, 1.15fr) minmax(220px, 2.6fr) minmax(72px, 0.72fr) minmax(72px, 0.72fr) minmax(78px, 0.78fr)"
    );
  });

  it("clamps long task text to two lines and keeps fixed-height rows", () => {
    const wrapper = mount(DenseRows, {
      props: {
        columns,
        rows: [
          { timeTag: "上午", task: "需要跨多个设备间隔开展安全措施布置并完成逐项复核确认" },
          ...rows
        ],
        visibleRows: 2
      }
    });

    expect(wrapper.find(".scroll-track").classes()).toContain("looping");
    expect(wrapper.findAll(".dense-row")).toHaveLength((rows.length + 1) * 2);
    expect(wrapper.findAll(".task-cell").length).toBeGreaterThan(0);
  });

  it("can fill the parent height for permit tables", () => {
    const wrapper = mount(DenseRows, {
      props: {
        columns,
        rows: [{ timeTag: "下午", task: "单条任务也可能包含较长说明需要完整展示避免被固定高度裁切" }],
        visibleRows: 3,
        fillHeight: true
      }
    });

    expect(wrapper.classes()).toContain("fill-height");
    expect(wrapper.find(".scroll-track").classes()).not.toContain("looping");
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
    expect(source).toMatch(/\.task-cell \{[^}]*-webkit-line-clamp: 2;/);
    expect(source).toMatch(/\.dense-body \{[^}]*overflow: hidden;/);
    expect(source).toMatch(/\.dense-body:not\(\.auto-scroll\) \{[^}]*overflow-y: auto;/);
    expect(source).toMatch(/\.dense-row \{[^}]*height: var\(--row-height\);/);
  });
});
