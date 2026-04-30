import { describe, expect, it } from "vitest";
import { expandContainer, validateTaskItem } from "../src/domain/taskExpansion.js";
import type { TaskContainer, TaskItemInput } from "../src/domain/taskExpansion.js";

describe("task expansion", () => {
  const baseContainer: TaskContainer = {
    id: "container-1",
    type: "operation",
    name: "操作",
    startAt: "2026-05-01T08:00:00+08:00",
    endAt: "2026-05-01T12:00:00+08:00",
    recurrenceType: "once",
    recurrenceIntervalMinutes: null,
    recurrenceCount: null,
    skipWeekends: false,
    skipHolidays: false,
    enabled: true
  };

  const baseItem: TaskItemInput = {
    id: "a",
    offsetMinutes: 0,
    durationMinutes: 60,
    content: "A",
    metadata: {}
  };

  it("expands overlapping child tasks relative to an occurrence start", () => {
    const expanded = expandContainer(
      baseContainer,
      [
        { id: "a", offsetMinutes: 0, durationMinutes: 120, content: "A", metadata: {} },
        { id: "b", offsetMinutes: 60, durationMinutes: 120, content: "B", metadata: {} }
      ],
      {
        windowStart: "2026-05-01T07:00:00+08:00",
        windowEnd: "2026-05-01T13:00:00+08:00",
        holidays: new Set()
      }
    );

    expect(expanded.map((item) => item.content)).toEqual(["A", "B"]);
    expect(expanded[0].startAt).toBe("2026-05-01T08:00:00.000+08:00");
    expect(expanded[1].startAt).toBe("2026-05-01T09:00:00.000+08:00");
  });

  it("does not expand disabled containers", () => {
    const expanded = expandContainer(
      { ...baseContainer, enabled: false },
      [baseItem],
      {
        windowStart: "2026-05-01T07:00:00+08:00",
        windowEnd: "2026-05-01T13:00:00+08:00",
        holidays: new Set()
      }
    );

    expect(expanded).toEqual([]);
  });

  it("skips a one-time occurrence on a weekend when weekend skips are enabled", () => {
    const expanded = expandContainer(
      {
        ...baseContainer,
        startAt: "2026-05-02T08:00:00+08:00",
        endAt: "2026-05-02T12:00:00+08:00",
        skipWeekends: true
      },
      [baseItem],
      {
        windowStart: "2026-05-02T00:00:00+08:00",
        windowEnd: "2026-05-02T23:59:59+08:00",
        holidays: new Set()
      }
    );

    expect(expanded).toEqual([]);
  });

  it("skips a one-time occurrence on a holiday when holiday skips are enabled", () => {
    const expanded = expandContainer(
      {
        ...baseContainer,
        skipHolidays: true
      },
      [baseItem],
      {
        windowStart: "2026-05-01T00:00:00+08:00",
        windowEnd: "2026-05-01T23:59:59+08:00",
        holidays: new Set(["2026-05-01"])
      }
    );

    expect(expanded).toEqual([]);
  });

  it("counts finite recurrence after weekend and holiday skips", () => {
    const expanded = expandContainer(
      {
        ...baseContainer,
        recurrenceType: "finite",
        recurrenceIntervalMinutes: 24 * 60,
        recurrenceCount: 3,
        skipWeekends: true,
        skipHolidays: true
      },
      [baseItem],
      {
        windowStart: "2026-05-01T00:00:00+08:00",
        windowEnd: "2026-05-07T23:59:59+08:00",
        holidays: new Set(["2026-05-04"])
      }
    );

    expect(expanded.map((item) => item.startAt)).toEqual([
      "2026-05-01T08:00:00.000+08:00",
      "2026-05-05T08:00:00.000+08:00",
      "2026-05-06T08:00:00.000+08:00"
    ]);
  });

  it("rejects finite recurrence with missing or zero interval", () => {
    expect(() =>
      expandContainer(
        { ...baseContainer, recurrenceType: "finite", recurrenceIntervalMinutes: null, recurrenceCount: 2 },
        [baseItem],
        {
          windowStart: "2026-05-01T00:00:00+08:00",
          windowEnd: "2026-05-02T00:00:00+08:00",
          holidays: new Set()
        }
      )
    ).toThrow("recurrenceIntervalMinutes must be positive for finite recurrence");

    expect(() =>
      expandContainer(
        { ...baseContainer, recurrenceType: "finite", recurrenceIntervalMinutes: 0, recurrenceCount: 2 },
        [baseItem],
        {
          windowStart: "2026-05-01T00:00:00+08:00",
          windowEnd: "2026-05-02T00:00:00+08:00",
          holidays: new Set()
        }
      )
    ).toThrow("recurrenceIntervalMinutes must be positive for finite recurrence");
  });

  it("rejects infinite recurrence with missing or zero interval", () => {
    expect(() =>
      expandContainer(
        { ...baseContainer, recurrenceType: "infinite", recurrenceIntervalMinutes: null },
        [baseItem],
        {
          windowStart: "2026-05-01T00:00:00+08:00",
          windowEnd: "2026-05-02T00:00:00+08:00",
          holidays: new Set()
        }
      )
    ).toThrow("recurrenceIntervalMinutes must be positive for infinite recurrence");

    expect(() =>
      expandContainer(
        { ...baseContainer, recurrenceType: "infinite", recurrenceIntervalMinutes: 0 },
        [baseItem],
        {
          windowStart: "2026-05-01T00:00:00+08:00",
          windowEnd: "2026-05-02T00:00:00+08:00",
          holidays: new Set()
        }
      )
    ).toThrow("recurrenceIntervalMinutes must be positive for infinite recurrence");
  });

  it("includes long occurrences that start before one interval but overlap the window", () => {
    const expanded = expandContainer(
      {
        ...baseContainer,
        recurrenceType: "finite",
        recurrenceIntervalMinutes: 60,
        recurrenceCount: 1
      },
      [{ ...baseItem, durationMinutes: 240 }],
      {
        windowStart: "2026-05-01T11:00:00+08:00",
        windowEnd: "2026-05-01T11:30:00+08:00",
        holidays: new Set()
      }
    );

    expect(expanded.map((item) => item.startAt)).toEqual(["2026-05-01T08:00:00.000+08:00"]);
  });

  it("rejects child tasks ending after the main task occurrence", () => {
    const result = validateTaskItem(240, { offsetMinutes: 180, durationMinutes: 90 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected validation to fail");
    expect(result.message).toBe("child task ends after parent occurrence");
  });
});
