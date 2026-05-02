<template>
  <section class="list-panel">
    <ListHeader title="许可列表" />
    <DateToolbar
      :model-value="selectedDate"
      :show-all="showAll"
      :allow-show-all="true"
      :disabled="showAll"
      :today="today"
      :yesterday="yesterday"
      add-label="新增许可"
      @add="emit('add')"
      @today="emit('today')"
      @yesterday="emit('yesterday')"
      @update:model-value="emit('update:selectedDate', $event)"
      @update:show-all="emit('update:showAll', $event)"
    />
    <div class="table-shell">
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>许可</th>
            <th>人员</th>
            <th>区域</th>
            <th>其他</th>
            <th class="actions-column">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in rows" :key="record.id" :class="{ disabled: !record.enabled }">
            <td>{{ record.timeTag }}</td>
            <td>{{ record.permit }}</td>
            <td>{{ record.personnel || "-" }}</td>
            <td>{{ record.area || "-" }}</td>
            <td>{{ record.other || "-" }}</td>
            <td class="row-actions">
              <button type="button" :aria-label="record.enabled ? '禁用许可' : '启用许可'" @click="emit('toggle', record)">
                {{ record.enabled ? "禁用" : "启用" }}
              </button>
              <button type="button" @click="emit('edit', record)">修改</button>
              <button type="button" class="danger" @click="emit('delete', record.id)">删除</button>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td class="empty-cell" colspan="6">当前日期暂无许可</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PermitArrangementRecord } from "../../api/client";
import DateToolbar from "./DateToolbar.vue";
import ListHeader from "./ListHeader.vue";

defineProps<{
  selectedDate: string;
  today: string;
  yesterday: string;
  showAll: boolean;
  rows: PermitArrangementRecord[];
}>();

const emit = defineEmits<{
  "update:selectedDate": [value: string];
  "update:showAll": [value: boolean];
  add: [];
  today: [];
  yesterday: [];
  toggle: [record: PermitArrangementRecord];
  edit: [record: PermitArrangementRecord];
  delete: [id: string];
}>();
</script>

<style scoped src="./managerStyles.css"></style>
