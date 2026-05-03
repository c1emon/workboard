<template>
  <section class="list-panel task-instance-panel">
    <ListHeader title="任务实例" />
    <DateToolbar
      :model-value="selectedDate"
      :show-all="showAll"
      :allow-show-all="true"
      :disabled="showAll"
      :today="today"
      :yesterday="yesterday"
      add-label="新增实例"
      @add="emit('add')"
      @today="emit('today')"
      @yesterday="emit('yesterday')"
      @update:model-value="emit('update:selectedDate', $event)"
      @update:show-all="emit('update:showAll', $event)"
    />
    <div class="manager-actions">
      <button type="button" class="secondary-action refresh-action" @click="emit('open-refresh')">刷新实例</button>
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
            <th class="actions-column">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in rows" :key="record.id" :class="{ disabled: record.status === 'cancelled' }">
            <td>{{ typeText(record.type) }}</td>
            <td>{{ sourceText(record.sourceType) }}</td>
            <td>{{ displayTimeTag(record) }}</td>
            <td>{{ record.content || "-" }}</td>
            <td class="row-actions">
              <button v-if="canEdit(record)" type="button" @click="emit('edit', record)">修改</button>
              <button v-if="record.status !== 'cancelled'" type="button" @click="emit('cancel', record)">取消</button>
              <button type="button" class="danger" @click="emit('delete', record)">删除</button>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td class="empty-cell" colspan="5">{{ showAll ? "暂无实例" : "当前日期暂无实例" }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="formOpen" class="modal-backdrop" role="presentation" @click.self="emit('close')">
      <form class="modal-form task-instance-modal" @submit.prevent="emit('save')">
        <div class="modal-heading">
          <div>
            <h2>{{ editingId ? "编辑实例" : "新增实例" }}</h2>
          </div>
          <button type="button" aria-label="关闭实例表单" @click="emit('close')">×</button>
        </div>
        <div class="form-grid">
          <div class="task-instance-date-time-row wide-field">
            <label>
              日期
              <input v-model="form.date" name="taskInstanceDate" type="date" required />
            </label>
            <label>
              时间
              <select v-model="form.timeTag" name="taskInstanceTimeTag">
                <option value="全天">全天</option>
                <option value="上午">上午</option>
                <option value="下午">下午</option>
              </select>
            </label>
          </div>
          <label>
            目标
            <input v-model="form.target" name="taskInstanceTarget" required />
          </label>
          <label>
            人员
            <input v-model="form.personnel" name="taskInstancePersonnel" />
          </label>
          <label>
            车辆
            <input v-model="form.vehicle" name="taskInstanceVehicle" />
          </label>
          <label class="wide-field">
            其他
            <input v-model="form.other" name="taskInstanceOther" />
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="secondary-action" @click="emit('close')">取消</button>
          <button type="submit" class="primary-action">保存</button>
        </div>
      </form>
    </div>

    <div v-if="refreshOpen" class="modal-backdrop" role="presentation" @click.self="emit('close-refresh')">
      <form class="modal-form task-instance-modal" @submit.prevent="emit('refresh')">
        <div class="modal-heading">
          <div>
            <h2>刷新实例</h2>
          </div>
          <button type="button" aria-label="关闭刷新实例弹窗" @click="emit('close-refresh')">×</button>
        </div>
        <div class="form-grid">
          <label class="wide-field">
            巡视模板
            <select v-model="refreshForm.templateId" name="taskInstanceRefreshTemplate">
              <option value="">全部巡视模板</option>
              <option v-for="plan in patrolPlans" :key="plan.id" :value="plan.id">{{ plan.name }}</option>
            </select>
          </label>
          <label>
            开始日期
            <input v-model="refreshForm.windowStartDate" name="taskInstanceRefreshStartDate" type="date" required />
          </label>
          <label>
            结束日期
            <input
              v-model="refreshForm.windowEndDate"
              name="taskInstanceRefreshEndDate"
              type="date"
              :min="refreshForm.windowStartDate"
              required
            />
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="secondary-action" @click="emit('close-refresh')">取消</button>
          <button type="submit" class="primary-action">执行</button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PatrolPlanRecord, TaskInstanceRecord } from "../../api/client";
import type { TaskInstanceForm, TaskInstanceRefreshForm } from "../../composables/admin/useTaskInstanceAdmin";
import DateToolbar from "./DateToolbar.vue";
import ListHeader from "./ListHeader.vue";

defineProps<{
  selectedDate: string;
  today: string;
  yesterday: string;
  showAll: boolean;
  rows: TaskInstanceRecord[];
  patrolPlans: PatrolPlanRecord[];
  form: TaskInstanceForm;
  formOpen: boolean;
  refreshForm: TaskInstanceRefreshForm;
  refreshOpen: boolean;
  editingId: string | null;
  generationSummary: string;
}>();

const emit = defineEmits<{
  "update:selectedDate": [value: string];
  "update:showAll": [value: boolean];
  add: [];
  today: [];
  yesterday: [];
  edit: [record: TaskInstanceRecord];
  cancel: [record: TaskInstanceRecord];
  delete: [record: TaskInstanceRecord];
  "open-refresh": [];
  "close-refresh": [];
  refresh: [];
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

function displayTimeTag(record: TaskInstanceRecord): string {
  const metadataTag = record.metadata.timeTag;
  if (metadataTag === "全天" || metadataTag === "上午" || metadataTag === "下午") return metadataTag;
  if (record.startAt.includes("T00:00:00") && record.endAt.includes("T23:59:59")) return "全天";
  if (record.startAt.includes("T12:00:00") && record.endAt.includes("T17:00:00")) return "下午";
  return "上午";
}
</script>

<style scoped src="./managerStyles.css"></style>
<style scoped src="./modalStyles.css"></style>
<style scoped>
.manager-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.refresh-action {
  margin-left: auto;
}

.task-instance-modal {
  width: min(560px, 100%);
}

.task-instance-date-time-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.task-instance-date-time-row label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-instance-date-time-row label:last-child {
  width: min(180px, 100%);
}
</style>
