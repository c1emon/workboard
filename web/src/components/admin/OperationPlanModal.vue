<template>
  <div class="modal-backdrop" role="presentation" @click.self="emit('close')">
    <form class="modal-form operation-modal" @submit.prevent="emit('save')">
      <div class="modal-heading">
        <h2>{{ title }}</h2>
        <button type="button" aria-label="关闭弹窗" @click="emit('close')">×</button>
      </div>
      <div class="form-grid">
        <label>计划名称<input v-model="form.name" name="operationName" required :disabled="readOnly" /></label>
        <label>说明<input v-model="form.description" :disabled="readOnly" /></label>
        <div class="operation-schedule-row">
          <label>
            循环类型
            <select v-model="form.recurrenceType" :disabled="readOnly">
              <option value="once">一次性</option>
              <option value="finite">有限循环</option>
              <option value="infinite">无限循环</option>
            </select>
          </label>
          <label>开始时间<input v-model="form.startAt" required type="datetime-local" :disabled="readOnly" /></label>
        </div>
        <label v-if="form.recurrenceType === 'finite'">结束时间<input v-model="form.endAt" name="operationEndAt" required type="datetime-local" :disabled="readOnly" /></label>
        <label v-if="readOnly && form.recurrenceType !== 'once'">
          循环间隔（分钟）
          <input :value="derivedRecurrenceIntervalMinutes" name="operationRecurrenceInterval" type="number" disabled />
        </label>
        <label v-if="readOnly && form.recurrenceType === 'finite'">
          循环次数
          <input :value="derivedRecurrenceCount" name="operationRecurrenceCount" type="number" disabled />
        </label>
      </div>
      <div class="checkbox-row">
        <label><input v-model="form.skipWeekends" type="checkbox" :disabled="readOnly" /> 跳过周末</label>
        <label><input v-model="form.skipHolidays" type="checkbox" :disabled="readOnly" /> 跳过节假日</label>
      </div>
      <OperationTaskTimeline
        v-if="mode !== 'create'"
        :allow-add="canAddItems"
        :duration-minutes="durationMinutes"
        :items="items"
        :readonly="readOnly"
        :selected-item-id="selectedItemId"
        :start-at="form.startAt"
        @add="emit('add-item')"
        @select="emit('select-item', $event)"
      />
      <div class="modal-actions">
        <button type="button" class="secondary-action" @click="emit('close')">{{ readOnly ? "关闭" : "取消" }}</button>
        <button v-if="!readOnly" type="submit" class="primary-action">保存</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { OperationPlanItemRecord } from "../../api/client";
import OperationTaskTimeline from "../OperationTaskTimeline.vue";

export type OperationModalMode = "create" | "edit" | "detail";
export type RecurrenceType = "once" | "finite" | "infinite";

export interface OperationPlanForm {
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  recurrenceType: RecurrenceType;
  recurrenceIntervalMinutes: number;
  recurrenceCount: number;
  skipWeekends: boolean;
  skipHolidays: boolean;
}

defineProps<{
  title: string;
  mode: OperationModalMode;
  form: OperationPlanForm;
  readOnly: boolean;
  hasEndAt: boolean;
  computedEndAt: string;
  derivedRecurrenceIntervalMinutes: number;
  derivedRecurrenceCount: number;
  durationMinutes: number;
  items: OperationPlanItemRecord[];
  selectedItemId: string | null;
  canAddItems: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [];
  "add-item": [];
  "select-item": [item: OperationPlanItemRecord];
}>();
</script>

<style scoped src="./modalStyles.css"></style>

<style scoped>
.operation-schedule-row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

@media (max-width: 900px) {
  .operation-schedule-row {
    grid-template-columns: 1fr;
  }
}
</style>
