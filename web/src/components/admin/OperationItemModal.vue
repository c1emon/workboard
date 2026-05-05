<template>
  <div class="modal-backdrop item-modal-backdrop" role="presentation" @click.self="emit('close')">
    <form class="modal-form operation-item-modal" @submit.prevent="emit('save')">
      <div class="modal-heading">
        <h2>{{ title }}</h2>
        <button type="button" aria-label="关闭子任务弹窗" @click="emit('close')">×</button>
      </div>
      <div class="form-grid">
        <div class="operation-item-start-row wide-field">
          <label>
            开始基准
            <select v-model="form.baseItemId" name="operationItemBaseItem" :disabled="readOnly">
              <option value="">计划开始时间点</option>
              <option v-for="item in baseOptions" :key="item.id" :value="item.id">
                {{ formatBaseOption(item) }}
              </option>
            </select>
          </label>
          <div class="operation-item-offset-group">
            <span class="operation-item-offset-title">相对基准偏移时间</span>
            <div class="operation-item-offset-controls">
              <label class="operation-item-offset-field" aria-label="Offset 小时">
                <input
                  v-model.number="form.offsetHours"
                  name="operationItemOffsetHours"
                  required
                  step="1"
                  type="number"
                  :disabled="readOnly"
                  @blur="emit('normalize-offset')"
                  @change="emit('normalize-offset')"
                  @keydown.enter="emit('normalize-offset')"
                />
                <span class="duration-unit">时</span>
              </label>
              <label class="operation-item-offset-field" aria-label="Offset 分钟">
                <input
                  v-model.number="form.offsetMinutes"
                  name="operationItemOffsetMinutes"
                  required
                  step="1"
                  type="number"
                  :disabled="readOnly"
                  @blur="emit('normalize-offset')"
                  @change="emit('normalize-offset')"
                  @keydown.enter="emit('normalize-offset')"
                />
                <span class="duration-unit">分</span>
              </label>
            </div>
          </div>
        </div>
        <div class="operation-item-duration-row wide-field">
          <span>任务时长</span>
          <div class="operation-item-duration-controls">
            <label class="operation-item-duration-field" aria-label="任务时长小时">
              <input
                v-model.number="form.durationHours"
                name="operationItemDurationHours"
                min="0"
                required
                step="1"
                type="number"
                :disabled="readOnly"
                @blur="emit('normalize-duration')"
                @change="emit('normalize-duration')"
                @keydown.enter="emit('normalize-duration')"
              />
              <span class="duration-unit">时</span>
            </label>
            <label class="operation-item-duration-field" aria-label="任务时长分钟">
              <input
                v-model.number="form.durationMinutes"
                name="operationItemDurationMinutes"
                min="0"
                required
                step="1"
                type="number"
                :disabled="readOnly"
                @blur="emit('normalize-duration')"
                @change="emit('normalize-duration')"
                @keydown.enter="emit('normalize-duration')"
              />
              <span class="duration-unit">分</span>
            </label>
          </div>
        </div>
        <label class="wide-field">
          任务内容
          <input
            v-model="form.content"
            name="operationItemContent"
            placeholder="A、B 操作"
            required
            :disabled="readOnly"
          />
        </label>
      </div>
      <div class="modal-actions">
        <button v-if="!readOnly && mode === 'edit'" type="button" class="danger-action operation-item-delete" @click="emit('delete')">
          删除
        </button>
        <button type="button" class="secondary-action" @click="emit('close')">{{ readOnly ? "关闭" : "取消" }}</button>
        <button v-if="!readOnly" type="submit" class="primary-action">保存</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { OperationPlanItemRecord } from "../../api/client";

export type OperationItemModalMode = "create" | "edit";

export interface OperationItemForm {
  id: string;
  baseItemId: string;
  offsetHours: number;
  offsetMinutes: number;
  durationHours: number;
  durationMinutes: number;
  content: string;
  extData: Record<string, unknown>;
  sortOrder: number;
}

const props = defineProps<{
  title: string;
  mode: OperationItemModalMode;
  form: OperationItemForm;
  readOnly: boolean;
  baseOptions: OperationPlanItemRecord[];
}>();

const emit = defineEmits<{
  close: [];
  save: [];
  delete: [];
  "normalize-offset": [];
  "normalize-duration": [];
}>();

function formatMinutesAsHoursMinutes(totalMinutes: number): string {
  const safeTotal = Math.max(0, Math.trunc(totalMinutes));
  return `${Math.floor(safeTotal / 60)}时${safeTotal % 60}分`;
}

function formatBaseOption(item: OperationPlanItemRecord): string {
  const content = item.content || "未命名子任务";
  return `${content} · 结束 ${formatMinutesAsHoursMinutes(item.offsetMinutes + item.durationMinutes)}`;
}
</script>

<style scoped src="./modalStyles.css"></style>

<style scoped>
.operation-item-start-row,
.operation-item-duration-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 280px);
  gap: 14px;
  align-items: end;
}

.operation-item-duration-row > span {
  align-self: center;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
}

.operation-item-offset-group {
  display: grid;
  gap: 7px;
}

.operation-item-offset-title {
  color: #334155;
  font-size: 13px;
  font-weight: 700;
}

.operation-item-offset-controls,
.operation-item-duration-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.operation-item-offset-field,
.operation-item-duration-field {
  display: grid;
  grid-template-columns: minmax(72px, 1fr) auto;
  align-items: center;
  gap: 6px;
}

.operation-item-offset-field input,
.operation-item-duration-field input {
  min-width: 0;
  text-align: center;
}

.duration-unit {
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 900px) {
  .operation-item-start-row,
  .operation-item-duration-row,
  .operation-item-offset-group {
    grid-template-columns: 1fr;
  }
}
</style>
