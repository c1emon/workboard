// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OperationTaskTimeline from "../src/components/OperationTaskTimeline.vue";

const visMocks = vi.hoisted(() => {
  const dataSetPayloads: unknown[][] = [];
  const timelineInstances: Array<{
    container: HTMLElement;
    items: { data: unknown[] };
    options: Record<string, unknown>;
    handlers: Record<string, (payload: { items?: string[] }) => void>;
    setItems: ReturnType<typeof vi.fn>;
    setOptions: ReturnType<typeof vi.fn>;
    setSelection: ReturnType<typeof vi.fn>;
    redraw: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }> = [];

  class DataSet {
    data: unknown[];

    constructor(data: unknown[]) {
      this.data = data;
      dataSetPayloads.push(data);
    }
  }

  class Timeline {
    container: HTMLElement;
    items: { data: unknown[] };
    options: Record<string, unknown>;
    handlers: Record<string, (payload: { items?: string[] }) => void> = {};
    setItems = vi.fn();
    setOptions = vi.fn();
    setSelection = vi.fn();
    redraw = vi.fn();
    destroy = vi.fn();

    constructor(container: HTMLElement, items: { data: unknown[] }, options: Record<string, unknown>) {
      this.container = container;
      this.items = items;
      this.options = options;
      timelineInstances.push(this);
    }

    on(event: string, callback: (payload: { items?: string[] }) => void) {
      this.handlers[event] = callback;
    }
  }

  return { DataSet, Timeline, dataSetPayloads, timelineInstances };
});

vi.mock("vis-timeline/standalone", () => ({
  DataSet: visMocks.DataSet,
  Timeline: visMocks.Timeline
}));

const items = [
  { id: "item-1", offsetMinutes: 0, durationMinutes: 120, content: "A、B 操作", metadata: {}, sortOrder: 0 },
  { id: "item-2", offsetMinutes: 180, durationMinutes: 60, content: "复核记录", metadata: { crew: "B" }, sortOrder: 1 }
];

describe("OperationTaskTimeline", () => {
  beforeEach(() => {
    visMocks.dataSetPayloads.length = 0;
    visMocks.timelineInstances.length = 0;
  });

  it("initializes vis-timeline with child task ranges by offset and duration", async () => {
    const wrapper = mount(OperationTaskTimeline, {
      props: { items, durationMinutes: 480, readonly: true, startAt: "2026-05-01T08:30" }
    });
    await wrapper.vm.$nextTick();
    await Promise.resolve();

    expect(wrapper.text()).toContain("子任务预览");
    expect(wrapper.text()).not.toContain("子任务时间轴");
    expect(wrapper.text()).not.toContain("视窗");
    expect(visMocks.timelineInstances).toHaveLength(1);
    expect(visMocks.dataSetPayloads[0]).toEqual([
      expect.objectContaining({
        id: "item-1",
        content: "A、B 操作",
        start: new Date("2026-01-01T08:30:00+08:00"),
        className: expect.stringContaining("operation-task-color-0")
      }),
      expect.objectContaining({
        id: "item-2",
        content: "复核记录",
        end: new Date("2026-01-01T12:30:00+08:00"),
        className: expect.stringContaining("operation-task-color-1")
      })
    ]);
    expect(visMocks.timelineInstances[0].options).toMatchObject({
      editable: false,
      selectable: true,
      min: new Date("2026-01-01T08:30:00+08:00"),
      max: new Date("2026-01-01T16:30:00+08:00")
    });
    expect(visMocks.timelineInstances[0].options).not.toHaveProperty("timeAxis");
    expect(visMocks.timelineInstances[0].options.format).toMatchObject({
      minorLabels: {
        minute: "HH:mm",
        hour: "HH:mm",
        day: "HH:mm"
      },
      majorLabels: {
        minute: "",
        hour: "",
        day: ""
      }
    });
    expect(visMocks.timelineInstances[0].redraw).toHaveBeenCalled();
  });

  it("redraws after timeline items change so vis can measure the mounted modal", async () => {
    const wrapper = mount(OperationTaskTimeline, {
      props: { items: [], durationMinutes: 480, readonly: false, startAt: "2026-05-01T08:30" }
    });
    await wrapper.vm.$nextTick();
    await Promise.resolve();

    visMocks.timelineInstances[0].redraw.mockClear();
    await wrapper.setProps({ items });

    expect(visMocks.timelineInstances[0].setItems).toHaveBeenCalled();
    expect(visMocks.timelineInstances[0].redraw).toHaveBeenCalled();
  });

  it("emits select when a vis-timeline item is selected", async () => {
    const wrapper = mount(OperationTaskTimeline, {
      props: { items, durationMinutes: 480, readonly: true, startAt: "2026-05-01T08:30" }
    });
    await wrapper.vm.$nextTick();
    await Promise.resolve();

    visMocks.timelineInstances[0].handlers.select({ items: ["item-2"] });

    expect(wrapper.emitted("select")?.[0]).toEqual([items[1]]);
  });
});
