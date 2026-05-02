import { afterEach, describe, expect, it, vi } from "vitest";
import { createPermit, fetchLeavePeople, fetchOtherArrangements, fetchPatrolArrangements, fetchPermitArrangements } from "../src/api/client";

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
        permit: "动火许可",
        personnel: "",
        area: "",
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
    await fetchPatrolArrangements("2026-05-01", "all");
    await fetchOtherArrangements("2026-05-01", "date");
    await fetchLeavePeople("2026-05-01", "all");

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining("/api/admin/permit-arrangements?scope=all"));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining("/api/admin/patrol-arrangements?scope=all"));
    expect(fetchMock).toHaveBeenNthCalledWith(3, expect.stringContaining("/api/admin/other-arrangements?scope=date&date=2026-05-01"));
    expect(fetchMock).toHaveBeenNthCalledWith(4, expect.stringContaining("/api/admin/leave-people?scope=all"));
  });
});
