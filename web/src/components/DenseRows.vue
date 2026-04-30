<template>
  <div class="dense-table" :style="tableStyle">
    <div class="dense-head">
      <span v-for="column in columns" :key="column.key">{{ column.label }}</span>
    </div>

    <div class="dense-body">
      <div v-for="(row, index) in rows" :key="index" class="dense-row" :data-testid="rowTestId">
        <span
          v-for="column in columns"
          :key="column.key"
          class="dense-cell"
          :class="{ 'time-cell': column.key === 'timeTag' }"
          :title="String(row[column.key] ?? '')"
        >
          <span v-if="column.key === 'timeTag'" class="time-tag" :class="timeTagClass(String(row[column.key] ?? ''))">
            {{ row[column.key] }}
          </span>
          <template v-else>{{ row[column.key] }}</template>
        </span>
      </div>

      <div v-for="index in emptyRows" :key="`empty-${index}`" class="dense-row empty-row" aria-hidden="true">
        <span v-for="column in columns" :key="column.key" class="dense-cell">&nbsp;</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

export interface DenseColumn {
  key: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    columns: DenseColumn[];
    rows: Array<Record<string, string>>;
    visibleRows: number;
    rowTestId?: string;
  }>(),
  {
    rowTestId: undefined
  }
);

const emptyRows = computed(() => Math.max(props.visibleRows - props.rows.length, 0));
const tableStyle = computed(() => ({
  "--visible-rows": String(props.visibleRows),
  "--column-count": String(props.columns.length)
}));

function timeTagClass(value: string) {
  return {
    "tag-all": value === "全天",
    "tag-am": value === "上午",
    "tag-pm": value === "下午"
  };
}
</script>

<style scoped>
.dense-table {
  --row-height: 32px;
  display: grid;
  grid-template-rows: 26px calc(var(--row-height) * var(--visible-rows));
  min-width: 0;
  width: 100%;
}

.dense-head,
.dense-row {
  display: grid;
  grid-template-columns: repeat(var(--column-count), minmax(0, 1fr));
}

.dense-head {
  align-items: center;
  color: #7dd3fc;
  font-size: 12px;
  font-weight: 700;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.56);
}

.dense-head span,
.dense-cell {
  min-width: 0;
  padding: 0 10px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  border-right: 1px solid rgba(148, 163, 184, 0.12);
}

.dense-head span:last-child,
.dense-cell:last-child {
  border-right: 0;
}

.dense-body {
  overflow-y: auto;
}

.dense-row {
  min-height: var(--row-height);
  align-items: center;
  color: #dbeafe;
  font-size: 13px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(8, 20, 38, 0.72);
}

.dense-row:nth-child(even) {
  background: rgba(15, 31, 54, 0.72);
}

.empty-row {
  color: rgba(148, 163, 184, 0.24);
}

.time-cell {
  display: flex;
  align-items: center;
}

.time-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  height: 20px;
  padding: 0 8px;
  border-radius: 4px;
  color: #03131b;
  font-size: 12px;
  font-weight: 700;
}

.tag-all {
  background: #86efac;
}

.tag-am {
  background: #67e8f9;
}

.tag-pm {
  background: #fde047;
}
</style>
