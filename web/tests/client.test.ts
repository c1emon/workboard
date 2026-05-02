import { afterEach, describe, expect, it, vi } from "vitest";
import { createPermit } from "../src/api/client";

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
});
