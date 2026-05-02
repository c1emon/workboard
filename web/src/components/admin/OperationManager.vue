<template>
  <section class="list-panel operation-panel">
    <ListHeader title="操作计划" />
    <DateToolbar
      :model-value="selectedDate"
      :show-all="showAll"
      :allow-show-all="true"
      :disabled="showAll"
      :today="today"
      :yesterday="yesterday"
      add-label="新增计划"
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
            <th>名称</th>
            <th>说明</th>
            <th>类型</th>
            <th>子任务数</th>
            <th class="actions-column">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in rows" :key="record.id" :class="{ disabled: !record.enabled }">
            <td>{{ record.name }}</td>
            <td>{{ record.description }}</td>
            <td>{{ recurrenceText(record) }}</td>
            <td>{{ record.childTaskCount }}</td>
            <td class="row-actions">
              <button type="button" @click="emit('detail', record)">详情</button>
              <button type="button" @click="emit('toggle', record)">{{ record.enabled ? "禁用" : "启用" }}</button>
              <button type="button" @click="emit('edit', record)">修改</button>
              <button type="button" class="danger" @click="emit('delete', record.id)">删除</button>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td class="empty-cell" colspan="5">{{ showAll ? "暂无操作计划" : "当前日期暂无操作计划" }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { OperationPlanRecord } from "../../api/client";
import DateToolbar from "./DateToolbar.vue";
import ListHeader from "./ListHeader.vue";

defineProps<{
  selectedDate: string;
  today: string;
  yesterday: string;
  showAll: boolean;
  rows: OperationPlanRecord[];
}>();

const emit = defineEmits<{
  "update:selectedDate": [value: string];
  "update:showAll": [value: boolean];
  add: [];
  today: [];
  yesterday: [];
  detail: [record: OperationPlanRecord];
  toggle: [record: OperationPlanRecord];
  edit: [record: OperationPlanRecord];
  delete: [id: string];
}>();

function recurrenceText(record: OperationPlanRecord): string {
  if (record.recurrenceType === "once") return "一次性";
  if (record.recurrenceType === "finite") return "有限循环";
  return "无限循环";
}
</script>

<style scoped src="./managerStyles.css"></style>
