<template>
  <section class="list-panel task-instance-panel">
    <ListHeader title="任务实例" />
    <DateToolbar
      :model-value="selectedDate"
      :show-all="false"
      :allow-show-all="false"
      :today="today"
      :yesterday="yesterday"
      add-label="新增实例"
      @add="emit('add')"
      @today="emit('today')"
      @yesterday="emit('yesterday')"
      @update:model-value="emit('update:selectedDate', $event)"
    />
    <div class="manager-actions">
      <label>
        生成至
        <input
          :value="generationEndDate"
          type="date"
          name="taskInstanceGenerationEndDate"
          :min="selectedDate"
          @input="emit('update:generationEndDate', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <button type="button" class="secondary-action" @click="emit('regenerate')">重新生成</button>
      <span v-if="generationSummary">{{ generationSummary }}</span>
    </div>
    <div class="table-shell">
      <table>
        <thead>
          <tr>
            <th>类型</th>
            <th>来源</th>
            <th>时间</th>
            <th>内容</th>
            <th>状态</th>
            <th class="actions-column">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in rows" :key="record.id" :class="{ disabled: record.status === 'cancelled' }">
            <td>{{ typeText(record.type) }}</td>
            <td>{{ sourceText(record.sourceType) }}</td>
            <td>{{ formatTime(record.startAt) }} - {{ formatTime(record.endAt) }}</td>
            <td>{{ record.content || "-" }}</td>
            <td>{{ statusText(record.status) }}</td>
            <td class="row-actions">
              <button v-if="canEdit(record)" type="button" @click="emit('edit', record)">修改</button>
              <button v-if="record.status !== 'cancelled'" type="button" @click="emit('cancel', record)">取消</button>
              <button type="button" class="danger" @click="emit('delete', record)">删除</button>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td class="empty-cell" colspan="6">当前日期暂无实例</td>
          </tr>
        </tbody>
      </table>
    </div>

    <form v-if="formOpen" class="modal-form inline-admin-form" @submit.prevent="emit('save')">
      <div class="modal-heading">
        <div>
          <h2>{{ editingId ? "编辑实例" : "新增实例" }}</h2>
        </div>
        <button type="button" aria-label="关闭实例表单" @click="emit('close')">×</button>
      </div>
      <div class="form-grid">
        <label>
          类型
          <select v-model="form.type" name="taskInstanceType">
            <option value="operation">操作</option>
            <option value="permit">许可</option>
            <option value="patrol">巡视</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label>
          内容
          <input v-model="form.content" name="taskInstanceContent" required />
        </label>
        <label>
          开始时间
          <input v-model="form.startAt" name="taskInstanceStartAt" required />
        </label>
        <label>
          结束时间
          <input v-model="form.endAt" name="taskInstanceEndAt" required />
        </label>
        <label class="wide-field">
          元数据 JSON
          <textarea v-model="form.metadataJson" name="taskInstanceMetadata" />
        </label>
      </div>
      <div class="modal-actions">
        <button type="button" class="secondary-action" @click="emit('close')">取消</button>
        <button type="submit" class="primary-action">保存</button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import type { TaskInstanceRecord } from "../../api/client";
import type { TaskInstanceStatus } from "../../api/types";
import type { TaskInstanceForm } from "../../composables/admin/useTaskInstanceAdmin";
import DateToolbar from "./DateToolbar.vue";
import ListHeader from "./ListHeader.vue";

defineProps<{
  selectedDate: string;
  today: string;
  yesterday: string;
  rows: TaskInstanceRecord[];
  form: TaskInstanceForm;
  formOpen: boolean;
  editingId: string | null;
  generationEndDate: string;
  generationSummary: string;
}>();

const emit = defineEmits<{
  "update:selectedDate": [value: string];
  "update:generationEndDate": [value: string];
  add: [];
  today: [];
  yesterday: [];
  edit: [record: TaskInstanceRecord];
  cancel: [record: TaskInstanceRecord];
  delete: [record: TaskInstanceRecord];
  regenerate: [];
  save: [];
  close: [];
}>();

function canEdit(record: TaskInstanceRecord): boolean {
  return record.sourceType === "manual" && record.status === "pending";
}

function typeText(type: TaskInstanceRecord["type"]): string {
  return { operation: "操作", permit: "许可", patrol: "巡视", other: "其他" }[type];
}

function sourceText(source: TaskInstanceRecord["sourceType"]): string {
  return { generated: "生成", manual: "手动", override: "覆盖" }[source];
}

function statusText(status: TaskInstanceStatus): string {
  return { pending: "待处理", in_progress: "进行中", done: "完成", cancelled: "取消" }[status];
}

function formatTime(value: string): string {
  return value.replace("T", " ").replace("+08:00", "");
}
</script>

<style scoped src="./managerStyles.css"></style>
<style scoped src="./modalStyles.css"></style>
<style scoped>
.task-instance-panel {
  border-bottom: 1px solid #d8dee8;
}

.manager-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.inline-admin-form {
  width: 100%;
  box-shadow: none;
}
</style>
