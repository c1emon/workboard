<template>
  <main class="board-page">
    <header class="board-header">
      <h1>变电运维工作日志</h1>
      <div class="header-time">{{ headerTime }}</div>
      <div class="status-pill" :class="statusClass">{{ statusText }}</div>
    </header>

    <section class="board-module operation-module">
      <SideLabel text="操作" />
      <OperationTimeline :items="snapshot?.operation.items ?? []" :server-time="snapshot?.serverTime ?? ''" />
    </section>

    <section class="board-module permit-module">
      <SideLabel text="许可" />
      <DenseRows :columns="permitColumns" :rows="permitRows" :visible-rows="6" fill-height row-test-id="permit-row" />
    </section>

    <section class="board-module">
      <SideLabel text="巡视" />
      <DenseRows :columns="patrolColumns" :rows="patrolRows" :visible-rows="2" />
    </section>

    <section class="board-module compact-module">
      <SideLabel text="其他" />
      <DenseRows :columns="otherColumns" :rows="otherRows" :visible-rows="4" fill-height />
    </section>

    <section class="board-module leave-module">
      <SideLabel text="休假" />
      <div class="leave-line" :class="{ 'empty-plan': isLeaveEmpty }" :title="leaveText">{{ leaveText }}</div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import DenseRows, { type DenseColumn } from "../components/DenseRows.vue";
import OperationTimeline from "../components/OperationTimeline.vue";
import SideLabel from "../components/SideLabel.vue";
import { fetchBoard, subscribeBoardUpdates } from "../api/client";
import type { BoardSnapshot } from "../api/types";

const snapshot = ref<BoardSnapshot | null>(null);
const connectionStatus = ref<"polling" | "connected" | "error">("polling");
let updateSource: EventSource | null = null;
let fallbackInterval: ReturnType<typeof setInterval> | null = null;
let isMounted = false;
let isEventStreamConnected = false;
let refreshSequence = 0;

const permitColumns: DenseColumn[] = [
  { key: "timeTag", label: "时间" },
  { key: "target", label: "对象" },
  { key: "task", label: "任务" },
  { key: "personnel", label: "人员" },
  { key: "vehicle", label: "车辆" },
  { key: "other", label: "其他" }
];

const patrolColumns: DenseColumn[] = [
  { key: "timeTag", label: "时间" },
  { key: "target", label: "对象" },
  { key: "personnel", label: "人员" },
  { key: "vehicle", label: "车辆" },
  { key: "other", label: "其他" }
];

const otherColumns: DenseColumn[] = [
  { key: "timeTag", label: "时间" },
  { key: "task", label: "任务" },
  { key: "personnel", label: "人员" },
  { key: "vehicle", label: "车辆" },
  { key: "other", label: "其他" }
];

const permitRows = computed(() => snapshot.value?.permits.map((row) => ({ ...row })) ?? []);
const patrolRows = computed(() => snapshot.value?.patrols.map(({ extData: _extData, ...row }) => ({ ...row })) ?? []);
const otherRows = computed(() => snapshot.value?.others.map((row) => ({ ...row })) ?? []);
const isLeaveEmpty = computed(() => (snapshot.value?.leavePeople.length ?? 0) === 0);
const leaveText = computed(() => (isLeaveEmpty.value ? "无" : snapshot.value?.leavePeople.join("、") ?? ""));
const headerTime = computed(() => formatDateTime(snapshot.value?.serverTime));
const statusText = computed(() => {
  if (connectionStatus.value === "connected") return "已连接";
  if (connectionStatus.value === "error") return "连接异常";
  return "轮询中";
});
const statusClass = computed(() => ({
  "status-connected": connectionStatus.value === "connected",
  "status-error": connectionStatus.value === "error",
  "status-polling": connectionStatus.value === "polling"
}));

async function refreshBoard() {
  const sequence = ++refreshSequence;

  try {
    const nextSnapshot = await fetchBoard();
    if (!isMounted || sequence !== refreshSequence) return;
    snapshot.value = nextSnapshot;
    connectionStatus.value = isEventStreamConnected ? "connected" : "polling";
  } catch (error) {
    if (isMounted) {
      connectionStatus.value = "error";
      console.error("Failed to refresh board", error);
    }
  }
}

function formatDateTime(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${valueByType.year}年${valueByType.month}月${valueByType.day}日 ${valueByType.hour}时${valueByType.minute}分`;
}

onMounted(() => {
  isMounted = true;
  void refreshBoard();
  updateSource = subscribeBoardUpdates(() => {
    void refreshBoard();
  }, {
    onOpen: () => {
      isEventStreamConnected = true;
      connectionStatus.value = "connected";
    },
    onError: () => {
      isEventStreamConnected = false;
      if (connectionStatus.value !== "error") connectionStatus.value = "polling";
    }
  });
  fallbackInterval = setInterval(() => {
    void refreshBoard();
  }, 30_000);
});

onUnmounted(() => {
  isMounted = false;
  isEventStreamConnected = false;
  updateSource?.close();
  if (fallbackInterval) clearInterval(fallbackInterval);
});
</script>

<style scoped>
.board-page {
  height: 100dvh;
  box-sizing: border-box;
  overflow: hidden;
  --board-row-height: 44px;
  --dense-row-height: var(--board-row-height);
  --dense-head-height: 26px;
  --board-header-height: 48px;
  --operation-height: 94px;
  --leave-height: 46px;
  --board-vertical-padding: 24px;
  --board-vertical-gaps: 40px;
  --permit-min-height: calc(var(--dense-head-height) + var(--dense-row-height) * 6);
  --permit-max-height: calc(var(--dense-head-height) + var(--dense-row-height) * 10);
  --patrol-height: calc(var(--dense-head-height) + var(--dense-row-height) * 2);
  --other-min-height: calc(var(--dense-head-height) + var(--dense-row-height) * 4);
  --permit-preferred-height: calc(
    100dvh - var(--board-vertical-padding) - var(--board-vertical-gaps) - var(--board-header-height) - var(--operation-height) -
      var(--patrol-height) - var(--other-min-height) - var(--leave-height)
  );
  display: grid;
  grid-template-rows: var(--board-header-height) var(--operation-height) auto var(--patrol-height) minmax(var(--other-min-height), 1fr) var(--leave-height);
  gap: 8px;
  padding: 12px;
  background:
    linear-gradient(180deg, rgba(219, 234, 254, 0.74), rgba(248, 250, 252, 0.35) 240px),
    #f6f8fb;
  color: #1e293b;
}

@media (max-height: 860px) {
  .board-page {
    --board-row-height: 38px;
    --dense-head-height: 24px;
    --board-header-height: 44px;
    --operation-height: 84px;
    --leave-height: 42px;
    --board-vertical-padding: 16px;
    --board-vertical-gaps: 30px;
    gap: 6px;
    padding: 8px;
  }

  .board-header {
    height: 44px;
    min-height: 44px;
    padding-block: 5px;
  }

  .header-time {
    font-size: 21px;
  }

  .operation-module {
    height: 84px;
  }

  .leave-module {
    min-height: 42px;
  }

  .leave-line {
    line-height: 40px;
  }
}

.board-header {
  height: var(--board-header-height);
  min-height: var(--board-header-height);
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  column-gap: 16px;
  padding: 7px 14px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.board-header h1 {
  margin: 0;
  color: #0f172a;
  font-size: 21px;
  line-height: 1.2;
  letter-spacing: 0;
}

.header-time {
  justify-self: center;
  color: #075985;
  font-size: 23px;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  white-space: nowrap;
}

.status-pill {
  justify-self: end;
  flex: 0 0 auto;
  padding: 4px 10px;
  border: 1px solid rgba(34, 197, 94, 0.28);
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  font-size: 12px;
  font-weight: 700;
}

.status-connected {
  border-color: rgba(16, 185, 129, 0.34);
  background: #ecfdf5;
  color: #047857;
}

.status-polling {
  border-color: rgba(245, 158, 11, 0.34);
  background: #fffbeb;
  color: #b45309;
}

.status-error {
  border-color: rgba(239, 68, 68, 0.34);
  background: #fef2f2;
  color: #b91c1c;
}

.board-module {
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}

.operation-module {
  height: var(--operation-height);
}

.permit-module {
  height: clamp(var(--permit-min-height), var(--permit-preferred-height), var(--permit-max-height));
}

.compact-module {
  min-height: var(--other-min-height);
}

.leave-module {
  min-height: var(--leave-height);
}

.leave-line {
  min-width: 0;
  width: 100%;
  display: block;
  align-self: center;
  padding: 0 14px;
  overflow: hidden;
  color: #1e3a8a;
  font-size: 15px;
  font-weight: 700;
  line-height: 44px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.leave-line.empty-plan {
  justify-content: center;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
}
</style>
