import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOperationPlanItem,
  createPatrolPlan,
  createPatrolPlanItem,
  createPermit,
  createTaskInstance,
  deleteOperationPlanItem,
  deletePatrolPlan,
  deletePatrolPlanItem,
  deleteTaskInstance,
  fetchLeavePeople,
  fetchOtherArrangements,
  fetchPatrolPlan,
  fetchPatrolPlans,
  fetchPermitArrangements,
  fetchTaskInstances,
  generateTaskInstances,
  importChineseDaysHolidays,
  updateOperationPlanItem,
  updatePatrolPlan,
  updatePatrolPlanEnabled,
  updatePatrolPlanItem,
  updateTaskInstance,
  updateTaskInstanceStatus
} from "../src/api/client";

describe("api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves structured admin error details in thrown messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          error: "Invalid admin payload",
          issues: [{ path: ["timeTag"], message: "Invalid enum value" }]
        })
      })
    );

    await expect(
      createPermit({
        date: "2026-05-01",
        timeTag: "上午",
        target: "A区",
        task: "动火许可",
        personnel: "",
        vehicle: "",
        other: ""
      })
    ).rejects.toThrow("Invalid admin payload: timeTag: Invalid enum value");
  });

  it("passes list scope query params for arrangement admin lists", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([])
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchPermitArrangements("2026-05-01", "all");
    await fetchOtherArrangements("2026-05-01", "date");
    await fetchLeavePeople("2026-05-01", "all");

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining("/api/admin/permit-arrangements?scope=all"));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining("/api/admin/other-arrangements?scope=date&date=2026-05-01"));
    expect(fetchMock).toHaveBeenNthCalledWith(3, expect.stringContaining("/api/admin/leave-people?scope=all"));
  });

  it("calls task instance admin endpoints with expected URLs and payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "instance-1" })
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = {
      type: "patrol" as const,
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T12:00:00+08:00",
      content: "人工巡视",
      metadata: { target: "A区" }
    };

    await fetchTaskInstances("2026-05-01", "patrol");
    await createTaskInstance(input);
    await updateTaskInstance("instance 1", input);
    await updateTaskInstanceStatus("instance 1", "cancelled");
    await deleteTaskInstance("instance 1");
    await generateTaskInstances({ windowStartDate: "2026-05-01", windowEndDate: "2026-05-02", types: ["patrol"], refreshPending: true });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/admin/task-instances?scope=date&date=2026-05-01&type=patrol")
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining("/api/admin/task-instances"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, expect.stringContaining("/api/admin/task-instances/instance%201"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, expect.stringContaining("/api/admin/task-instances/instance%201/status"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(5, expect.stringContaining("/api/admin/task-instances/instance%201"), { method: "DELETE" });
    expect(fetchMock).toHaveBeenNthCalledWith(6, expect.stringContaining("/api/admin/task-instances/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ windowStartDate: "2026-05-01", windowEndDate: "2026-05-02", types: ["patrol"], refreshPending: true })
    });
  });

  it("calls patrol plan and patrol cycle item endpoints with expected URLs and payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "patrol-plan-1" })
    });
    vi.stubGlobal("fetch", fetchMock);

    const planInput = {
      name: "巡视计划",
      description: "90 天循环",
      startAt: "2026-05-01T00:00:00+08:00",
      endAt: "2026-05-01T23:59:59+08:00",
      recurrenceType: "infinite" as const,
      skipWeekends: true,
      skipHolidays: true,
      enabled: true
    };
    const itemInput = {
      cycleDay: 1,
      timeTag: "上午" as const,
      target: "A区",
      personnel: "张三",
      vehicle: "巡检车",
      other: "带钥匙",
      sortOrder: 0
    };

    await fetchPatrolPlans();
    await fetchPatrolPlan("patrol plan");
    await createPatrolPlan(planInput);
    await updatePatrolPlan("patrol plan", planInput);
    await updatePatrolPlanEnabled("patrol plan", false);
    await deletePatrolPlan("patrol plan");
    await createPatrolPlanItem("patrol plan", itemInput);
    await updatePatrolPlanItem("patrol plan", "item 1", itemInput);
    await deletePatrolPlanItem("patrol plan", "item 1");

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining("/api/admin/patrol-plans"));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining("/api/admin/patrol-plans/patrol%20plan"));
    expect(fetchMock).toHaveBeenNthCalledWith(3, expect.stringContaining("/api/admin/patrol-plans"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planInput)
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, expect.stringContaining("/api/admin/patrol-plans/patrol%20plan"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planInput)
    });
    expect(fetchMock).toHaveBeenNthCalledWith(5, expect.stringContaining("/api/admin/patrol-plans/patrol%20plan/enabled"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(6, expect.stringContaining("/api/admin/patrol-plans/patrol%20plan"), { method: "DELETE" });
    expect(fetchMock).toHaveBeenNthCalledWith(7, expect.stringContaining("/api/admin/patrol-plans/patrol%20plan/items"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(itemInput)
    });
    expect(fetchMock).toHaveBeenNthCalledWith(8, expect.stringContaining("/api/admin/patrol-plans/patrol%20plan/items/item%201"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(itemInput)
    });
    expect(fetchMock).toHaveBeenNthCalledWith(9, expect.stringContaining("/api/admin/patrol-plans/patrol%20plan/items/item%201"), {
      method: "DELETE"
    });
  });

  it("calls operation child item endpoints with expected URLs and payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "item-1" })
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = {
      offsetMinutes: 15,
      durationMinutes: 30,
      content: "检查闭锁",
      metadata: { priority: "P1" },
      sortOrder: 1
    };

    await createOperationPlanItem("plan 1", input);
    await updateOperationPlanItem("plan 1", "item 1", input);
    await deleteOperationPlanItem("plan 1", "item 1");

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining("/api/admin/operation-plans/plan%201/items"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining("/api/admin/operation-plans/plan%201/items/item%201"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, expect.stringContaining("/api/admin/operation-plans/plan%201/items/item%201"), {
      method: "DELETE"
    });
  });

  it("routes holiday imports through the typed admin POST helper", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ imported: 2, holidays: 1, adjustedWorkdays: 1 })
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = {
      holidays: { "2026-05-01": "劳动节" },
      workdays: { "2026-04-26": "劳动节" },
      inLieuDays: {}
    };

    await expect(importChineseDaysHolidays(input)).resolves.toEqual({ imported: 2, holidays: 1, adjustedWorkdays: 1 });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/admin/holidays/import"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
  });
});
