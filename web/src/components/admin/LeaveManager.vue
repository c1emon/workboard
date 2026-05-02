<template>
  <section class="list-panel">
    <ListHeader title="休假列表" />
    <DateToolbar
      :model-value="selectedDate"
      :show-all="showAll"
      :allow-show-all="true"
      :disabled="showAll"
      :today="today"
      :yesterday="yesterday"
      add-label="新增休假"
      @add="emit('add')"
      @today="emit('today')"
      @yesterday="emit('yesterday')"
      @update:model-value="emit('update:selectedDate', $event)"
      @update:show-all="emit('update:showAll', $event)"
    />
    <div class="table-shell leave-table-shell">
      <table class="leave-table">
        <thead>
          <tr>
            <th class="leave-name-column">姓名</th>
            <th class="actions-column">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in rows" :key="record.id" :class="{ disabled: !record.enabled }">
            <td class="leave-name-column">{{ record.name }}</td>
            <td class="row-actions">
              <button type="button" class="danger" @click="emit('delete', record.id)">删除</button>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td class="empty-cell" colspan="2">当前日期暂无休假人员</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { LeavePersonRecord } from "../../api/client";
import DateToolbar from "./DateToolbar.vue";
import ListHeader from "./ListHeader.vue";

defineProps<{
  selectedDate: string;
  today: string;
  yesterday: string;
  showAll: boolean;
  rows: LeavePersonRecord[];
}>();

const emit = defineEmits<{
  "update:selectedDate": [value: string];
  "update:showAll": [value: boolean];
  add: [];
  today: [];
  yesterday: [];
  delete: [id: string];
}>();
</script>

<style scoped>
.list-panel {
  display: grid;
  gap: 18px;
  padding: 22px;
}

.table-shell {
  overflow-x: auto;
  border: 1px solid #d8dee8;
}

.leave-table-shell {
  width: 100%;
}

.leave-table {
  width: 100%;
  min-width: 0;
  table-layout: fixed;
}

.leave-name-column {
  width: 120px;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
}

th,
td {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  vertical-align: top;
}

th {
  background: #f8fafc;
  color: #475569;
  font-size: 13px;
}

td {
  color: #0f172a;
}

tr.disabled td:not(.row-actions) {
  color: #94a3b8;
  text-decoration: line-through;
}

.actions-column {
  width: 210px;
}

.row-actions {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.row-actions button {
  border: 1px solid #1e293b;
  border-radius: 6px;
  background: #fff;
  color: #172033;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
  padding: 5px 8px;
}

.row-actions .danger {
  border-color: #b91c1c;
  color: #b91c1c;
}

.empty-cell {
  color: #64748b;
  text-align: center;
}
</style>
