// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BoardView from "../src/views/BoardView.vue";
import { fetchBoard, subscribeBoardUpdates } from "../src/api/client";
import type { BoardSnapshot } from "../src/api/types";

vi.mock("../src/api/client", () => ({
  fetchBoard: vi.fn(),
  subscribeBoardUpdates: vi.fn()
}));

const mockedFetchBoard = vi.mocked(fetchBoard);
const mockedSubscribeBoardUpdates = vi.mocked(subscribeBoardUpdates);

function makeSnapshot(overrides: Partial<BoardSnapshot> = {}): BoardSnapshot {
  return {
    serverTime: "2026-05-01T09:30:00.000Z",
    operation: {
      items: [
        {
          content: "A线停电操作",
          startAt: "2026-05-01T08:30:00.000Z",
          endAt: "2026-05-01T10:30:00.000Z",
          metadata: {}
        }
      ]
    },
    permits: [
      { timeTag: "全天", permit: "动火许可", personnel: "张三", area: "A区", other: "复核" },
      { timeTag: "上午", permit: "登高许可", personnel: "李四", area: "B区", other: "监护" },
      { timeTag: "下午", permit: "受限空间", personnel: "王五", area: "C区", other: "检测" },
      { timeTag: "全天", permit: "临电许可", personnel: "赵六", area: "D区", other: "挂牌" },
      { timeTag: "上午", permit: "吊装许可", personnel: "钱七", area: "E区", other: "封控" },
      { timeTag: "下午", permit: "开挖许可", personnel: "孙八", area: "F区", other: "旁站" }
    ],
    patrols: [
      { timeTag: "全天", target: "主厂房", personnel: "周九", vehicle: "1号车", other: "正常", metadata: {} },
      { timeTag: "上午", target: "罐区", personnel: "吴十", vehicle: "2号车", other: "复查", metadata: {} }
    ],
    others: [
      { timeTag: "下午", task: "消防演练", personnel: "郑十一", vehicle: "3号车", other: "集合" }
    ],
    leavePeople: ["陈一", "刘二", "黄三"],
    ...overrides
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe("BoardView", () => {
  let close: ReturnType<typeof vi.fn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    close = vi.fn();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedFetchBoard.mockResolvedValue(makeSnapshot());
    mockedSubscribeBoardUpdates.mockReturnValue({ close } as unknown as EventSource);
  });

  afterEach(() => {
    consoleError.mockRestore();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("loads the board snapshot, subscribes to updates, and renders board modules", async () => {
    const wrapper = mount(BoardView);
    await flushPromises();

    expect(mockedFetchBoard).toHaveBeenCalledTimes(1);
    expect(mockedSubscribeBoardUpdates).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("操作");
    expect(wrapper.text()).toContain("许可");
    expect(wrapper.text()).toContain("巡视");
    expect(wrapper.text()).toContain("其他");
    expect(wrapper.text()).toContain("休假");
    expect(wrapper.text()).toContain("动火许可");
    expect(wrapper.text()).toContain("开挖许可");
    expect(wrapper.findAll("[data-testid='permit-row']")).toHaveLength(6);
    expect(wrapper.text()).toContain("陈一");
    expect(wrapper.text()).toContain("刘二");
    expect(wrapper.text()).toContain("黄三");

    const onUpdate = mockedSubscribeBoardUpdates.mock.calls[0][0];
    mockedFetchBoard.mockResolvedValue({ ...makeSnapshot(), leavePeople: ["何四"] });
    onUpdate();
    await flushPromises();
    expect(mockedFetchBoard).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("何四");

    await wrapper.unmount();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("refreshes with a fallback interval and clears it on unmount", async () => {
    const wrapper = mount(BoardView);
    await flushPromises();

    await vi.advanceTimersByTimeAsync(30_000);
    await flushPromises();
    expect(mockedFetchBoard).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(30_000);
    await flushPromises();
    expect(mockedFetchBoard).toHaveBeenCalledTimes(2);
  });

  it("keeps the newest board snapshot when an older refresh resolves later", async () => {
    const firstRefresh = deferred<BoardSnapshot>();
    const secondRefresh = deferred<BoardSnapshot>();
    mockedFetchBoard.mockReset();
    mockedFetchBoard.mockReturnValueOnce(firstRefresh.promise).mockReturnValueOnce(secondRefresh.promise);

    const wrapper = mount(BoardView);
    const onUpdate = mockedSubscribeBoardUpdates.mock.calls[0][0];
    onUpdate();

    secondRefresh.resolve(makeSnapshot({ leavePeople: ["新数据"] }));
    await flushPromises();
    expect(wrapper.text()).toContain("新数据");

    firstRefresh.resolve(makeSnapshot({ leavePeople: ["旧数据"] }));
    await flushPromises();
    expect(wrapper.text()).toContain("新数据");
    expect(wrapper.text()).not.toContain("旧数据");
  });

  it("keeps the previous snapshot when a refresh rejects", async () => {
    const initialSnapshot = makeSnapshot({ leavePeople: ["保留数据"] });
    mockedFetchBoard.mockResolvedValueOnce(initialSnapshot).mockRejectedValueOnce(new Error("network down"));

    const wrapper = mount(BoardView);
    await flushPromises();
    expect(wrapper.text()).toContain("保留数据");

    const onUpdate = mockedSubscribeBoardUpdates.mock.calls[0][0];
    onUpdate();
    await flushPromises();

    expect(wrapper.text()).toContain("保留数据");
    expect(consoleError).toHaveBeenCalledWith("Failed to refresh board", expect.any(Error));
  });

  it("does not update board state after unmount", async () => {
    const firstRefresh = deferred<BoardSnapshot>();
    mockedFetchBoard.mockReset();
    mockedFetchBoard.mockReturnValueOnce(firstRefresh.promise);

    const wrapper = mount(BoardView);
    wrapper.unmount();

    firstRefresh.resolve(makeSnapshot({ leavePeople: ["卸载后数据"] }));
    await flushPromises();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
