// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OperationTimeline from "../src/components/OperationTimeline.vue";

const visMocks = vi.hoisted(() => {
  const dataSetPayloads: unknown[][] = [];
  const timelineInstances: Array<{
    container: HTMLElement;
    items: { data: unknown[] };
    options: Record<string, unknown>;
    setItems: ReturnType<typeof vi.fn>;
    setOptions: ReturnType<typeof vi.fn>;
    addCustomTime: ReturnType<typeof vi.fn>;
    setCustomTime: ReturnType<typeof vi.fn>;
    setCustomTimeMarker: ReturnType<typeof vi.fn>;
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
    setItems = vi.fn();
    setOptions = vi.fn();
    addCustomTime = vi.fn();
    setCustomTime = vi.fn();
    setCustomTimeMarker = vi.fn();
    redraw = vi.fn();
    destroy = vi.fn();

    constructor(container: HTMLElement, items: { data: unknown[] }, options: Record<string, unknown>) {
      this.container = container;
      this.items = items;
      this.options = options;
      timelineInstances.push(this);
    }
  }

  return { DataSet, Timeline, dataSetPayloads, timelineInstances };
});

vi.mock("vis-timeline/standalone", () => ({
  DataSet: visMocks.DataSet,
  Timeline: visMocks.Timeline
}));

const items = [
  {
    content: "A线停电操作",
    startAt: "2026-05-01T08:30:00+08:00",
    endAt: "2026-05-01T10:30:00+08:00",
    extData: {}
  }
];

async function waitForTimelineLoad() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve));
}

async function waitForAssertion(assertion: () => void): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await waitForTimelineLoad();
    }
  }
  throw lastError;
}

describe("OperationTimeline", () => {
  beforeEach(() => {
    visMocks.dataSetPayloads.length = 0;
    visMocks.timelineInstances.length = 0;
  });

  it("uses vis-timeline with a 24 hour window centered on server time", async () => {
    mount(OperationTimeline, {
      props: { items, serverTime: "2026-05-01T12:00:00+08:00" }
    });
    await waitForAssertion(() => {
      expect(visMocks.timelineInstances).toHaveLength(1);
    });

    const dayMs = 24 * 60 * 60 * 1000;
    expect(visMocks.timelineInstances[0].options).toMatchObject({
      start: new Date("2026-05-01T00:00:00+08:00"),
      end: new Date("2026-05-02T00:00:00+08:00"),
      min: new Date("2026-05-01T00:00:00+08:00"),
      max: new Date("2026-05-02T00:00:00+08:00"),
      zoomMin: dayMs,
      zoomMax: dayMs
    });
    expect(visMocks.dataSetPayloads[0]).toEqual([
      expect.objectContaining({
        content: "A线停电操作",
        start: new Date("2026-05-01T08:30:00+08:00"),
        end: new Date("2026-05-01T10:30:00+08:00")
      })
    ]);
    expect(visMocks.timelineInstances[0].addCustomTime).toHaveBeenCalledWith(
      new Date("2026-05-01T12:00:00+08:00"),
      "server-time"
    );
    expect(visMocks.timelineInstances[0].setCustomTimeMarker).not.toHaveBeenCalled();
  });
});
