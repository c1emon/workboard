<template>
  <div class="dense-table" :class="{ 'fill-height': fillHeight }" :style="tableStyle">
    <div class="dense-head">
      <span v-for="column in columns" :key="column.key">{{ column.label }}</span>
    </div>

    <div ref="bodyElement" class="dense-body" :class="{ 'auto-scroll': shouldLoopRows }">
      <div v-if="rows.length === 0" class="empty-plan">无计划安排</div>

      <div v-else class="scroll-track" :class="{ looping: shouldLoopRows }" :style="trackStyle">
        <div
          v-for="(row, index) in displayRows"
          :key="index"
          class="dense-row"
          :class="{ 'even-row': originalRowIndex(index) % 2 === 1 }"
          :data-testid="rowTestId"
        >
          <span
            v-for="column in columns"
            :key="column.key"
            class="dense-cell"
            :class="{ 'time-cell': column.key === 'timeTag', 'task-cell': isTaskColumn(column), 'muted-cell': isEmptyValue(row[column.key]) }"
            :title="cellValue(row, column.key)"
          >
            <span v-if="column.key === 'timeTag' && !isEmptyValue(row[column.key])" class="time-tag" :class="timeTagClass(cellValue(row, column.key))">
              {{ cellValue(row, column.key) }}
            </span>
            <template v-else>{{ displayValue(row[column.key]) }}</template>
          </span>
        </div>

        <div v-for="index in emptyRows" v-if="!shouldLoopRows" :key="`empty-${index}`" class="dense-row empty-row" aria-hidden="true">
          <span v-for="column in columns" :key="column.key" class="dense-cell">&nbsp;</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

export interface DenseColumn {
  key: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    columns: DenseColumn[];
    rows: Array<Record<string, string>>;
    visibleRows: number;
    fillHeight?: boolean;
    rowTestId?: string;
  }>(),
  {
    fillHeight: false,
    rowTestId: undefined
  }
);

const bodyElement = ref<HTMLElement | null>(null);
const visibleRowCapacity = ref(props.visibleRows);
let bodyResizeObserver: ResizeObserver | null = null;

const emptyRows = computed(() => (shouldLoopRows.value ? 0 : Math.max(visibleRowCapacity.value - props.rows.length, 0)));
const fillHeight = computed(() => props.fillHeight);
const shouldLoopRows = computed(() => props.rows.length > visibleRowCapacity.value);
const displayRows = computed(() => (shouldLoopRows.value ? [...props.rows, ...props.rows] : props.rows));
const tableStyle = computed(() => ({
  "--visible-rows": String(props.visibleRows),
  "--grid-template-columns": props.columns.map(columnWidth).join(" ")
}));
const trackStyle = computed(() => ({
  "--row-count": String(props.rows.length),
  "--scroll-duration": `${Math.max(props.rows.length * 2.4, 12)}s`
}));

function originalRowIndex(index: number) {
  return props.rows.length === 0 ? index : index % props.rows.length;
}

function cellValue(row: Record<string, string>, key: string): string {
  return String(row[key] ?? "");
}

function isEmptyValue(value: unknown): boolean {
  return String(value ?? "").trim() === "";
}

function displayValue(value: unknown): string {
  return isEmptyValue(value) ? "-" : String(value);
}

function timeTagClass(value: string) {
  return {
    "tag-all": value === "全天",
    "tag-am": value === "上午",
    "tag-pm": value === "下午"
  };
}

function isTaskColumn(column: DenseColumn): boolean {
  return column.key === "task" || column.label === "任务";
}

function columnWidth(column: DenseColumn): string {
  if (column.key === "timeTag") return "58px";
  if (isTaskColumn(column)) return "minmax(220px, 2.6fr)";
  if (column.key === "target") return "minmax(112px, 1.15fr)";
  if (column.key === "personnel" || column.key === "vehicle") return "minmax(72px, 0.72fr)";
  if (column.key === "other") return "minmax(78px, 0.78fr)";
  return "minmax(76px, 0.8fr)";
}

onMounted(() => {
  updateVisibleRowCapacity();
  if (typeof ResizeObserver === "undefined") return;
  bodyResizeObserver = new ResizeObserver(updateVisibleRowCapacity);
  if (bodyElement.value) bodyResizeObserver.observe(bodyElement.value);
});

onBeforeUnmount(() => {
  bodyResizeObserver?.disconnect();
  bodyResizeObserver = null;
});

watch(
  () => [props.visibleRows, props.fillHeight] as const,
  async () => {
    await nextTick();
    updateVisibleRowCapacity();
  }
);

function updateVisibleRowCapacity(): void {
  const body = bodyElement.value;
  if (!body) {
    visibleRowCapacity.value = props.visibleRows;
    return;
  }
  const rowHeight = Number.parseFloat(getComputedStyle(body).getPropertyValue("--row-height"));
  if (!Number.isFinite(rowHeight) || rowHeight <= 0) {
    visibleRowCapacity.value = props.visibleRows;
    return;
  }
  visibleRowCapacity.value = Math.max(1, Math.floor(body.clientHeight / rowHeight));
}
</script>

<style scoped>
.dense-table {
  --row-height: var(--board-row-height, 44px);
  --head-height: var(--dense-head-height, 26px);
  height: calc(var(--head-height) + var(--row-height) * var(--visible-rows));
  display: grid;
  grid-template-rows: var(--head-height) minmax(0, 1fr);
  min-width: 0;
  width: 100%;
}

.dense-table.fill-height {
  height: 100%;
}

.dense-head,
.dense-row {
  display: grid;
  grid-template-columns: var(--grid-template-columns);
}

.dense-head {
  align-items: center;
  color: #1d4ed8;
  font-size: 14px;
  font-weight: 700;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  background: #eff6ff;
}

.dense-head span,
.dense-cell {
  min-width: 0;
  padding: 0 10px;
  overflow: hidden;
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
  border-right: 1px solid rgba(148, 163, 184, 0.16);
}

.task-cell {
  box-sizing: border-box;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  align-self: center;
  max-height: calc(1.25em * 2 + 4px);
  padding-top: 2px;
  padding-bottom: 2px;
  overflow: hidden;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  text-overflow: ellipsis;
  line-height: 1.25;
}

.dense-head span:last-child,
.dense-cell:last-child {
  border-right: 0;
}

.dense-body {
  min-height: 0;
  overflow: hidden;
  background:
    repeating-linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.86) 0,
      rgba(255, 255, 255, 0.86) calc(var(--row-height) - 1px),
      rgba(148, 163, 184, 0.16) calc(var(--row-height) - 1px),
      rgba(148, 163, 184, 0.16) var(--row-height)
    );
}

.dense-body:not(.auto-scroll) {
  overflow-y: auto;
}

.scroll-track {
  min-height: 100%;
}

.scroll-track.looping {
  animation: dense-scroll var(--scroll-duration) linear infinite;
}

@keyframes dense-scroll {
  from {
    transform: translateY(0);
  }

  to {
    transform: translateY(calc(var(--row-height) * var(--row-count) * -1));
  }
}

.empty-plan {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 500;
}

.dense-row {
  height: var(--row-height);
  align-items: center;
  color: #1e293b;
  font-size: 15px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.86);
}

.dense-row.even-row {
  background: rgba(248, 250, 252, 0.9);
}

.empty-row {
  color: rgba(148, 163, 184, 0.45);
}

.time-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.muted-cell {
  color: #94a3b8;
}

.time-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  color: #0f172a;
  font-size: 14px;
  font-weight: 700;
}

.tag-all {
  background: #bbf7d0;
}

.tag-am {
  background: #bae6fd;
}

.tag-pm {
  background: #fde68a;
}
</style>
