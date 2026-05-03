import { describe, expect, it } from "vitest";
import { createTestDatabase, type AppDatabase } from "../src/db/database.js";
import { generateTaskInstances } from "../src/domain/taskInstanceGeneration.js";

type TemplateType = "operation" | "permit" | "patrol" | "other";
type RecurrenceType = "once" | "finite" | "infinite";

interface InstanceRow {
  id: string;
  type: TemplateType;
  template_id: string | null;
  source_template_item_id: string | null;
  source_type: string;
  generation_key: string | null;
  occurrence_date: string;
  start_at: string;
  end_at: string;
  content: string;
  ext_data_json: string;
  status: string;
}

describe("task instance generation", () => {
  it("creates one-time task instances once", () => {
    const db = createTestDatabase();
    insertTemplate(db, { id: "operation-1", startAt: "2026-05-01T08:00:00+08:00", endAt: "2026-05-01T10:00:00+08:00" });
    insertItem(db, { id: "item-1", templateId: "operation-1", offsetMinutes: 30, durationMinutes: 45, content: "检查闭锁" });

    const result = generateTaskInstances(db, {
      windowStartDate: "2026-05-01",
      windowEndDate: "2026-05-01",
      types: ["operation"]
    });

    expect(result).toEqual({ inserted: 1, updated: 0, skipped: 0 });
    expect(readInstances(db)).toEqual([
      expect.objectContaining({
        type: "operation",
        template_id: "operation-1",
        source_template_item_id: "item-1",
        source_type: "generated",
        generation_key: "operation-1:item-1:2026-05-01T08:00:00.000+08:00",
        occurrence_date: "2026-05-01",
        start_at: "2026-05-01T08:30:00.000+08:00",
        end_at: "2026-05-01T09:15:00.000+08:00",
        content: "检查闭锁",
        status: "pending"
      })
    ]);
  });

  it("expands a once operation plan as one complete child-task cycle using compatibility endAt", () => {
    const db = createTestDatabase();
    insertTemplate(db, {
      id: "operation-once-cycle",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T08:00:00+08:00"
    });
    insertItem(db, { id: "first", templateId: "operation-once-cycle", offsetMinutes: 0, durationMinutes: 60, content: "第一项" });
    insertItem(db, { id: "last", templateId: "operation-once-cycle", offsetMinutes: 90, durationMinutes: 80, content: "结束最晚" });

    const result = generateTaskInstances(db, {
      windowStartDate: "2026-05-01",
      windowEndDate: "2026-05-01",
      types: ["operation"]
    });

    expect(result).toEqual({ inserted: 2, updated: 0, skipped: 0 });
    expect(readInstances(db).map((row) => `${row.content}:${row.start_at}:${row.end_at}`)).toEqual([
      "第一项:2026-05-01T08:00:00.000+08:00:2026-05-01T09:00:00.000+08:00",
      "结束最晚:2026-05-01T09:30:00.000+08:00:2026-05-01T10:50:00.000+08:00"
    ]);
  });

  it("derives operation cycle duration from the latest child-task end", () => {
    const db = createTestDatabase();
    insertTemplate(db, {
      id: "operation-derived-cycle",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T08:01:00+08:00",
      recurrenceType: "infinite",
      recurrenceIntervalMinutes: 5
    });
    insertItem(db, { id: "late-offset", templateId: "operation-derived-cycle", offsetMinutes: 120, durationMinutes: 10, content: "偏移最大" });
    insertItem(db, { id: "late-end", templateId: "operation-derived-cycle", offsetMinutes: 90, durationMinutes: 80, content: "结束最晚" });

    const result = generateTaskInstances(db, {
      windowStartDate: "2026-05-01",
      windowEndDate: "2026-05-01",
      types: ["operation"]
    });

    expect(result).toEqual({ inserted: 11, updated: 0, skipped: 0 });
    expect(readInstances(db).map((row) => `${row.content}:${row.start_at}`)).toEqual([
      "结束最晚:2026-05-01T09:30:00.000+08:00",
      "偏移最大:2026-05-01T10:00:00.000+08:00",
      "结束最晚:2026-05-01T12:20:00.000+08:00",
      "偏移最大:2026-05-01T12:50:00.000+08:00",
      "结束最晚:2026-05-01T15:10:00.000+08:00",
      "偏移最大:2026-05-01T15:40:00.000+08:00",
      "结束最晚:2026-05-01T18:00:00.000+08:00",
      "偏移最大:2026-05-01T18:30:00.000+08:00",
      "结束最晚:2026-05-01T20:50:00.000+08:00",
      "偏移最大:2026-05-01T21:20:00.000+08:00",
      "结束最晚:2026-05-01T23:40:00.000+08:00"
    ]);
  });

  it("does not generate operation instances when no child task defines a cycle", () => {
    const db = createTestDatabase();
    insertTemplate(db, {
      id: "operation-empty",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T20:00:00+08:00",
      recurrenceType: "infinite",
      recurrenceIntervalMinutes: 60
    });

    const result = generateTaskInstances(db, {
      windowStartDate: "2026-05-01",
      windowEndDate: "2026-05-01",
      types: ["operation"]
    });

    expect(result).toEqual({ inserted: 0, updated: 0, skipped: 0 });
    expect(readInstances(db)).toEqual([]);
  });

  it("keeps finite operation child instances fully inside the plan window", () => {
    const db = createTestDatabase();
    insertTemplate(db, {
      id: "operation-finite",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T11:00:00+08:00",
      recurrenceType: "finite",
      recurrenceIntervalMinutes: 999
    });
    insertItem(db, { id: "first", templateId: "operation-finite", offsetMinutes: 0, durationMinutes: 60, content: "完整第一项" });
    insertItem(db, { id: "second", templateId: "operation-finite", offsetMinutes: 90, durationMinutes: 30, content: "完整第二项" });

    const result = generateTaskInstances(db, {
      windowStartDate: "2026-05-01",
      windowEndDate: "2026-05-01",
      types: ["operation"]
    });

    expect(result).toEqual({ inserted: 3, updated: 0, skipped: 0 });
    expect(readInstances(db).map((row) => `${row.content}:${row.start_at}:${row.end_at}`)).toEqual([
      "完整第一项:2026-05-01T08:00:00.000+08:00:2026-05-01T09:00:00.000+08:00",
      "完整第二项:2026-05-01T09:30:00.000+08:00:2026-05-01T10:00:00.000+08:00",
      "完整第一项:2026-05-01T10:00:00.000+08:00:2026-05-01T11:00:00.000+08:00"
    ]);
    expect(readInstances(db).every((row) => new Date(row.end_at).getTime() <= new Date("2026-05-01T11:00:00+08:00").getTime())).toBe(true);
  });

  it("creates simple daily recurrence instances", () => {
    const db = createTestDatabase();
    insertTemplate(db, {
      id: "permit-1",
      type: "permit",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T09:00:00+08:00",
      recurrenceType: "finite",
      recurrenceIntervalMinutes: 24 * 60,
      recurrenceCount: 3
    });
    insertItem(db, { id: "item-1", templateId: "permit-1", offsetMinutes: 0, durationMinutes: 30, content: "日报" });

    const result = generateTaskInstances(db, {
      windowStartDate: "2026-05-01",
      windowEndDate: "2026-05-04"
    });

    expect(result).toEqual({ inserted: 3, updated: 0, skipped: 0 });
    expect(readInstances(db).map((row) => row.start_at)).toEqual([
      "2026-05-01T08:00:00.000+08:00",
      "2026-05-02T08:00:00.000+08:00",
      "2026-05-03T08:00:00.000+08:00"
    ]);
  });

  it("generates patrol cycle day 1, day 2, and wraps day 90 to day 1", () => {
    const db = createTestDatabase();
    insertTemplate(db, {
      id: "patrol-1",
      type: "patrol",
      startAt: "2026-01-01T00:00:00+08:00",
      endAt: "2026-01-01T23:59:59+08:00"
    });
    insertItem(db, { id: "day-1", templateId: "patrol-1", content: "一号点", metadata: { cycleDay: 1, timeTag: "上午" } });
    insertItem(db, { id: "day-2", templateId: "patrol-1", content: "二号点", metadata: { cycleDay: 2, timeTag: "上午" } });
    insertItem(db, { id: "day-90", templateId: "patrol-1", content: "九十号点", metadata: { cycleDay: 90, timeTag: "上午" } });

    generateTaskInstances(db, {
      windowStartDate: "2026-01-01",
      windowEndDate: "2026-04-01",
      types: ["patrol"]
    });

    expect(readInstances(db).map((row) => `${row.occurrence_date}:${row.content}`)).toEqual([
      "2026-01-01:一号点",
      "2026-01-02:二号点",
      "2026-03-31:九十号点",
      "2026-04-01:一号点"
    ]);
  });

  it("uses patrol timeTag through timeRangeForDateTag", () => {
    const db = createTestDatabase();
    insertTemplate(db, { id: "patrol-1", type: "patrol", startAt: "2026-05-01T00:00:00+08:00", endAt: "2026-05-01T23:59:59+08:00" });
    insertItem(db, {
      id: "item-1",
      templateId: "patrol-1",
      content: "下午巡视",
      metadata: { cycleDay: 1, timeTag: "下午", target: "A区", personnel: "张三", vehicle: "工程车", other: "带钥匙" }
    });

    generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-01", types: ["patrol"] });

    const [instance] = readInstances(db);
    expect(instance.start_at).toBe("2026-05-01T12:00:00+08:00");
    expect(instance.end_at).toBe("2026-05-01T17:00:00+08:00");
    expect(JSON.parse(instance.ext_data_json)).toEqual({
      timeTag: "下午",
      target: "A区",
      personnel: "张三",
      vehicle: "工程车",
      other: "带钥匙",
      cycleDay: 1
    });
  });

  it("filters generation to selected template ids", () => {
    const db = createTestDatabase();
    insertTemplate(db, { id: "patrol-1", type: "patrol", startAt: "2026-05-01T00:00:00+08:00", endAt: "2026-05-01T23:59:59+08:00" });
    insertTemplate(db, { id: "patrol-2", type: "patrol", startAt: "2026-05-01T00:00:00+08:00", endAt: "2026-05-01T23:59:59+08:00" });
    insertItem(db, { id: "item-1", templateId: "patrol-1", content: "一号模板", metadata: { cycleDay: 1 } });
    insertItem(db, { id: "item-2", templateId: "patrol-2", content: "二号模板", metadata: { cycleDay: 1 } });

    const result = generateTaskInstances(db, {
      windowStartDate: "2026-05-01",
      windowEndDate: "2026-05-01",
      types: ["patrol"],
      templateIds: ["patrol-2"]
    });

    expect(result).toEqual({ inserted: 1, updated: 0, skipped: 0 });
    expect(readInstances(db).map((row) => row.content)).toEqual(["二号模板"]);
  });

  it("skips patrol holidays without consuming the cycle day", () => {
    const db = createTestDatabase();
    insertHoliday(db, "2026-05-02", "holiday");
    insertTemplate(db, {
      id: "patrol-1",
      type: "patrol",
      startAt: "2026-05-01T00:00:00+08:00",
      endAt: "2026-05-01T23:59:59+08:00",
      skipHolidays: true
    });
    insertItem(db, { id: "day-1", templateId: "patrol-1", content: "第一天", metadata: { cycleDay: 1 } });
    insertItem(db, { id: "day-2", templateId: "patrol-1", content: "第二天", metadata: { cycleDay: 2 } });

    generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-03", types: ["patrol"] });

    expect(readInstances(db).map((row) => `${row.occurrence_date}:${row.content}`)).toEqual([
      "2026-05-01:第一天",
      "2026-05-03:第二天"
    ]);
  });

  it("skips weekends when skipWeekends is true", () => {
    const db = createTestDatabase();
    insertTemplate(db, {
      id: "patrol-1",
      type: "patrol",
      startAt: "2026-05-01T00:00:00+08:00",
      endAt: "2026-05-01T23:59:59+08:00",
      skipWeekends: true
    });
    insertItem(db, { id: "day-1", templateId: "patrol-1", content: "工作日一", metadata: { cycleDay: 1 } });
    insertItem(db, { id: "day-2", templateId: "patrol-1", content: "工作日二", metadata: { cycleDay: 2 } });

    generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-04", types: ["patrol"] });

    expect(readInstances(db).map((row) => `${row.occurrence_date}:${row.content}`)).toEqual([
      "2026-05-01:工作日一",
      "2026-05-04:工作日二"
    ]);
  });

  it("does not skip adjusted workdays on weekends", () => {
    const db = createTestDatabase();
    insertHoliday(db, "2026-05-02", "adjusted_workday");
    insertTemplate(db, {
      id: "patrol-1",
      type: "patrol",
      startAt: "2026-05-01T00:00:00+08:00",
      endAt: "2026-05-01T23:59:59+08:00",
      skipWeekends: true
    });
    insertItem(db, { id: "day-1", templateId: "patrol-1", content: "周五", metadata: { cycleDay: 1 } });
    insertItem(db, { id: "day-2", templateId: "patrol-1", content: "调休周六", metadata: { cycleDay: 2 } });

    generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-02", types: ["patrol"] });

    expect(readInstances(db).map((row) => `${row.occurrence_date}:${row.content}`)).toEqual([
      "2026-05-01:周五",
      "2026-05-02:调休周六"
    ]);
  });

  it("keeps cross-day items intact when the occurrence start is not a holiday", () => {
    const db = createTestDatabase();
    insertHoliday(db, "2026-05-02", "holiday");
    insertTemplate(db, {
      id: "operation-1",
      startAt: "2026-05-01T20:00:00+08:00",
      endAt: "2026-05-02T08:00:00+08:00",
      skipHolidays: true
    });
    insertItem(db, { id: "item-1", templateId: "operation-1", offsetMinutes: 180, durationMinutes: 480, content: "夜间操作" });

    generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-02", types: ["operation"] });

    expect(readInstances(db)).toEqual([
      expect.objectContaining({
        start_at: "2026-05-01T23:00:00.000+08:00",
        end_at: "2026-05-02T07:00:00.000+08:00",
        content: "夜间操作"
      })
    ]);
  });

  it("does not overwrite manual, override, or terminal generated instances", () => {
    const db = createTestDatabase();
    insertTemplate(db, { id: "operation-1", startAt: "2026-05-01T08:00:00+08:00", endAt: "2026-05-01T09:00:00+08:00" });
    const cases = [
      { id: "manual", sourceType: "manual", status: "pending" },
      { id: "override", sourceType: "override", status: "pending" },
      { id: "done", sourceType: "generated", status: "done" },
      { id: "in-progress", sourceType: "generated", status: "in_progress" },
      { id: "cancelled", sourceType: "generated", status: "cancelled" }
    ];
    for (const [index, row] of cases.entries()) {
      insertItem(db, {
        id: row.id,
        templateId: "operation-1",
        offsetMinutes: index * 10,
        durationMinutes: 5,
        content: `new-${row.id}`
      });
      insertExistingInstance(db, {
        id: `existing-${row.id}`,
        templateId: "operation-1",
        itemId: row.id,
        sourceType: row.sourceType,
        status: row.status,
        generationKey: `operation-1:${row.id}:2026-05-01T08:00:00.000+08:00`,
        content: `old-${row.id}`
      });
    }

    const result = generateTaskInstances(db, {
      windowStartDate: "2026-05-01",
      windowEndDate: "2026-05-01",
      refreshPending: true
    });

    expect(result).toEqual({ inserted: 0, updated: 0, skipped: 5 });
    expect(readInstances(db).map((row) => row.content).sort()).toEqual([
      "old-cancelled",
      "old-done",
      "old-in-progress",
      "old-manual",
      "old-override"
    ]);
  });

  it("updates generated pending instances only when refreshPending is true", () => {
    const db = createTestDatabase();
    insertTemplate(db, { id: "operation-1", startAt: "2026-05-01T08:00:00+08:00", endAt: "2026-05-01T09:00:00+08:00" });
    insertItem(db, { id: "item-1", templateId: "operation-1", content: "new content", metadata: { priority: "P1" } });
    insertExistingInstance(db, {
      id: "existing",
      templateId: "operation-1",
      itemId: "item-1",
      sourceType: "generated",
      status: "pending",
      generationKey: "operation-1:item-1:2026-05-01T08:00:00.000+08:00",
      content: "old content"
    });

    const skipped = generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-01" });
    const updated = generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-01", refreshPending: true });

    expect(skipped).toEqual({ inserted: 0, updated: 0, skipped: 1 });
    expect(updated).toEqual({ inserted: 0, updated: 1, skipped: 0 });
    expect(readInstances(db)[0]).toEqual(expect.objectContaining({ content: "new content" }));
    expect(JSON.parse(readInstances(db)[0].ext_data_json)).toEqual({ priority: "P1" });
  });

  it("refreshes generated pending instances when item timing changes", () => {
    const db = createTestDatabase();
    insertTemplate(db, { id: "operation-1", startAt: "2026-05-01T08:00:00+08:00", endAt: "2026-05-01T10:00:00+08:00" });
    insertItem(db, { id: "item-1", templateId: "operation-1", offsetMinutes: 0, durationMinutes: 30, content: "old timing" });
    generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-01" });

    db.prepare("update task_template_items set offset_minutes = 60, duration_minutes = 45, content = ? where id = ?").run("new timing", "item-1");
    const result = generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-01", refreshPending: true });

    expect(result).toEqual({ inserted: 0, updated: 1, skipped: 0 });
    expect(readInstances(db)).toEqual([
      expect.objectContaining({
        generation_key: "operation-1:item-1:2026-05-01T08:00:00.000+08:00",
        start_at: "2026-05-01T09:00:00.000+08:00",
        end_at: "2026-05-01T09:45:00.000+08:00",
        content: "new timing"
      })
    ]);
  });

  it("refreshes generated pending patrol instances when timeTag changes", () => {
    const db = createTestDatabase();
    insertTemplate(db, { id: "patrol-1", type: "patrol", startAt: "2026-05-01T00:00:00+08:00", endAt: "2026-05-01T23:59:59+08:00" });
    insertItem(db, { id: "day-1", templateId: "patrol-1", content: "巡视", metadata: { cycleDay: 1, timeTag: "上午" } });
    generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-01", types: ["patrol"] });

    db.prepare("update task_template_items set ext_data_json = ? where id = ?").run(JSON.stringify({ cycleDay: 1, timeTag: "下午" }), "day-1");
    const result = generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-01", types: ["patrol"], refreshPending: true });

    expect(result).toEqual({ inserted: 0, updated: 1, skipped: 0 });
    expect(readInstances(db)).toEqual([
      expect.objectContaining({
        generation_key: "patrol-1:day-1:2026-05-01T00:00:00+08:00",
        start_at: "2026-05-01T12:00:00+08:00",
        end_at: "2026-05-01T17:00:00+08:00"
      })
    ]);
  });

  it("reruns without creating duplicate generated instances", () => {
    const db = createTestDatabase();
    insertTemplate(db, { id: "operation-1", startAt: "2026-05-01T08:00:00+08:00", endAt: "2026-05-01T09:00:00+08:00" });
    insertItem(db, { id: "item-1", templateId: "operation-1", content: "检查" });

    const first = generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-01" });
    const second = generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-01" });

    expect(first).toEqual({ inserted: 1, updated: 0, skipped: 0 });
    expect(second).toEqual({ inserted: 0, updated: 0, skipped: 1 });
    expect(readInstances(db)).toHaveLength(1);
  });

  it("does not generate disabled templates", () => {
    const db = createTestDatabase();
    insertTemplate(db, { id: "operation-1", enabled: false });
    insertItem(db, { id: "item-1", templateId: "operation-1" });

    const result = generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-01" });

    expect(result).toEqual({ inserted: 0, updated: 0, skipped: 0 });
    expect(readInstances(db)).toEqual([]);
  });

  it("does not generate patrol dates with no matching cycleDay item", () => {
    const db = createTestDatabase();
    insertTemplate(db, { id: "patrol-1", type: "patrol", startAt: "2026-05-01T00:00:00+08:00", endAt: "2026-05-01T23:59:59+08:00" });
    insertItem(db, { id: "day-2", templateId: "patrol-1", metadata: { cycleDay: 2 } });

    generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-01", types: ["patrol"] });

    expect(readInstances(db)).toEqual([]);
  });

  it("derives patrol cycle length from the largest cycle item day", () => {
    const db = createTestDatabase();
    insertTemplate(db, {
      id: "patrol-1",
      type: "patrol",
      startAt: "2026-05-01T00:00:00+08:00",
      endAt: "2026-05-01T23:59:59+08:00",
      metadata: { cycleLength: "0" }
    });
    insertItem(db, { id: "day-2", templateId: "patrol-1", content: "第二天", metadata: { cycleDay: 2 } });

    generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-03", types: ["patrol"] });

    expect(readInstances(db).map((row) => `${row.occurrence_date}:${row.content}`)).toEqual(["2026-05-02:第二天"]);
  });

  it("does not generate when template start_at is after windowEndDate", () => {
    const db = createTestDatabase();
    insertTemplate(db, { id: "operation-1", startAt: "2026-05-02T08:00:00+08:00", endAt: "2026-05-02T09:00:00+08:00" });
    insertItem(db, { id: "item-1", templateId: "operation-1" });

    const result = generateTaskInstances(db, { windowStartDate: "2026-05-01", windowEndDate: "2026-05-01" });

    expect(result).toEqual({ inserted: 0, updated: 0, skipped: 0 });
  });

  it("generates across month and year boundaries", () => {
    const db = createTestDatabase();
    insertTemplate(db, { id: "patrol-1", type: "patrol", startAt: "2026-12-31T00:00:00+08:00", endAt: "2026-12-31T23:59:59+08:00" });
    insertItem(db, { id: "day-1", templateId: "patrol-1", content: "年末", metadata: { cycleDay: 1 } });
    insertItem(db, { id: "day-2", templateId: "patrol-1", content: "年初", metadata: { cycleDay: 2 } });

    generateTaskInstances(db, { windowStartDate: "2026-12-31", windowEndDate: "2027-01-01", types: ["patrol"] });

    expect(readInstances(db).map((row) => `${row.occurrence_date}:${row.content}`)).toEqual([
      "2026-12-31:年末",
      "2027-01-01:年初"
    ]);
  });

  it("generates operation instances from adjacent dates when the requested window overlaps them", () => {
    const db = createTestDatabase();
    insertTemplate(db, {
      id: "operation-1",
      startAt: "2026-05-01T23:30:00+08:00",
      endAt: "2026-05-02T02:00:00+08:00"
    });
    insertItem(db, { id: "item-1", templateId: "operation-1", offsetMinutes: 90, durationMinutes: 30, content: "跨日检查" });

    generateTaskInstances(db, { windowStartDate: "2026-05-02", windowEndDate: "2026-05-02", types: ["operation"] });

    expect(readInstances(db)).toEqual([
      expect.objectContaining({
        occurrence_date: "2026-05-02",
        start_at: "2026-05-02T01:00:00.000+08:00",
        content: "跨日检查"
      })
    ]);
  });
});

function insertTemplate(
  db: AppDatabase,
  input: {
    id: string;
    type?: TemplateType;
    name?: string;
    startAt?: string;
    endAt?: string;
    recurrenceType?: RecurrenceType;
    recurrenceIntervalMinutes?: number | null;
    recurrenceCount?: number | null;
    skipWeekends?: boolean;
    skipHolidays?: boolean;
    enabled?: boolean;
    metadata?: Record<string, unknown>;
  }
): void {
  const now = "2026-05-01T00:00:00.000Z";
  db.prepare(
    `insert into task_templates
     (id, type, name, description, start_at, end_at, recurrence_type, recurrence_interval_minutes,
      recurrence_count, skip_weekends, skip_holidays, enabled, ext_data_json, created_at, updated_at)
     values (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.type ?? "operation",
    input.name ?? input.id,
    input.startAt ?? "2026-05-01T08:00:00+08:00",
    input.endAt ?? "2026-05-01T09:00:00+08:00",
    input.recurrenceType ?? "once",
    input.recurrenceIntervalMinutes ?? null,
    input.recurrenceCount ?? null,
    input.skipWeekends ? 1 : 0,
    input.skipHolidays ? 1 : 0,
    input.enabled === false ? 0 : 1,
    JSON.stringify(input.metadata ?? {}),
    now,
    now
  );
}

function insertItem(
  db: AppDatabase,
  input: {
    id: string;
    templateId: string;
    offsetMinutes?: number;
    durationMinutes?: number;
    content?: string;
    metadata?: Record<string, unknown>;
    sortOrder?: number;
  }
): void {
  db.prepare(
    `insert into task_template_items
     (id, template_id, offset_minutes, duration_minutes, content, ext_data_json, sort_order)
     values (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.templateId,
    input.offsetMinutes ?? 0,
    input.durationMinutes ?? 60,
    input.content ?? input.id,
    JSON.stringify(input.metadata ?? {}),
    input.sortOrder ?? 0
  );
}

function insertHoliday(db: AppDatabase, date: string, type: "holiday" | "adjusted_workday"): void {
  db.prepare("insert into holidays (id, date, name, type) values (?, ?, ?, ?)").run(`holiday-${date}`, date, date, type);
}

function insertExistingInstance(
  db: AppDatabase,
  input: {
    id: string;
    templateId: string;
    itemId: string;
    sourceType: string;
    status: string;
    generationKey: string;
    content: string;
  }
): void {
  db.prepare(
    `insert into task_instances
     (id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
      start_at, end_at, content, ext_data_json, status, generated_at, updated_at)
     values (?, 'operation', ?, ?, ?, ?, '2026-05-01', '2026-05-01T00:00:00+08:00',
             '2026-05-01T01:00:00+08:00', ?, '{}', ?, '2026-05-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z')`
  ).run(input.id, input.templateId, input.itemId, input.sourceType, input.generationKey, input.content, input.status);
}

function readInstances(db: AppDatabase): InstanceRow[] {
  return db
    .prepare<[], InstanceRow>(
      `select id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
              start_at, end_at, content, ext_data_json, status
       from task_instances
       order by start_at, content, id`
    )
    .all();
}
