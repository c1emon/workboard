import { describe, expect, it } from "vitest";
import { expandContainer, validateTaskItem } from "../src/domain/taskExpansion.js";

describe("task expansion", () => {
  it("expands overlapping child tasks relative to an occurrence start", () => {
    const expanded = expandContainer(
      {
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
      },
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

  it("rejects child tasks ending after the main task occurrence", () => {
    const result = validateTaskItem(240, { offsetMinutes: 180, durationMinutes: 90 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected validation to fail");
    expect(result.message).toBe("child task ends after parent occurrence");
  });
});
