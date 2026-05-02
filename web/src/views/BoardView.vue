<template>
  <main class="board-page">
    <header class="board-header">
      <h1>工作任务看板</h1>
      <div class="header-time">{{ headerTime }}</div>
      <div class="status-pill" :class="statusClass">{{ statusText }}</div>
    </header>

    <section class="board-module operation-module">
      <SideLabel text="操作" />
      <OperationTimeline :items="snapshot?.operation.items ?? []" :server-time="snapshot?.serverTime ?? ''" />
    </section>

    <section class="board-module">
      <SideLabel text="许可" />
      <DenseRows :columns="permitColumns" :rows="permitRows" :visible-rows="6" row-test-id="permit-row" />
    </section>

    <section class="board-module">
      <SideLabel text="巡视" />
      <DenseRows :columns="patrolColumns" :rows="patrolRows" :visible-rows="2" />
    </section>

    <section class="board-module compact-module">
      <SideLabel text="其他" />
      <DenseRows :columns="otherColumns" :rows="otherRows" :visible-rows="3" />
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
  { key: "permit", label: "许可" },
  { key: "personnel", label: "人员" },
  { key: "area", label: "区域" },
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
const patrolRows = computed(() => snapshot.value?.patrols.map(({ metadata: _metadata, ...row }) => ({ ...row })) ?? []);
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
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto auto auto auto auto auto;
  gap: 10px;
  padding: 14px;
  background:
    linear-gradient(180deg, rgba(14, 165, 233, 0.08), transparent 240px),
    #07111f;
  color: #e2e8f0;
}

.board-header {
  min-height: 62px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  column-gap: 16px;
  padding: 10px 16px;
  border: 1px solid rgba(125, 211, 252, 0.18);
  background: rgba(8, 20, 38, 0.86);
}

.board-header h1 {
  margin: 0;
  color: #f8fafc;
  font-size: 22px;
  line-height: 1.2;
  letter-spacing: 0;
}

.header-time {
  justify-self: center;
  color: #e0f2fe;
  font-size: 26px;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  white-space: nowrap;
}

.status-pill {
  justify-self: end;
  flex: 0 0 auto;
  padding: 5px 10px;
  border: 1px solid rgba(34, 197, 94, 0.38);
  border-radius: 4px;
  background: rgba(22, 101, 52, 0.28);
  color: #bbf7d0;
  font-size: 12px;
  font-weight: 700;
}

.status-connected {
  border-color: rgba(34, 197, 94, 0.38);
  background: rgba(22, 101, 52, 0.28);
  color: #bbf7d0;
}

.status-polling {
  border-color: rgba(250, 204, 21, 0.38);
  background: rgba(113, 63, 18, 0.28);
  color: #fef08a;
}

.status-error {
  border-color: rgba(248, 113, 113, 0.42);
  background: rgba(127, 29, 29, 0.32);
  color: #fecaca;
}

.board-module {
  min-width: 0;
  display: flex;
  overflow: hidden;
  border: 1px solid rgba(125, 211, 252, 0.18);
  background: rgba(2, 6, 23, 0.58);
}

.operation-module {
  min-height: 104px;
}

.compact-module {
  max-height: 132px;
}

.leave-module {
  min-height: 52px;
}

.leave-line {
  min-width: 0;
  width: 100%;
  display: block;
  align-self: center;
  padding: 0 14px;
  overflow: hidden;
  color: #e0f2fe;
  font-size: 15px;
  font-weight: 700;
  line-height: 50px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.leave-line.empty-plan {
  justify-content: center;
  color: rgba(148, 163, 184, 0.46);
  font-size: 13px;
  font-weight: 500;
  text-align: center;
}
</style>
