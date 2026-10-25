<template>
  <PlanWorkflowDialog :title="step === 'form' ? '重新生成实例' : '确认重新生成'" :busy="busy" @close="emit('close')">
    <p v-if="loading" role="status">正在读取计划…</p>
    <div v-if="step === 'form'" class="form-grid">
      <label class="wide-field">操作计划 *
        <span v-if="locked">{{ plan?.name ?? '正在读取…' }}</span>
        <select v-else :value="form.templateId" :disabled="loading || busy" name="generationPlan" @change="emit('plan', ($event.target as HTMLSelectElement).value)">
          <option value="">请选择计划</option><option v-for="record in plans" :key="record.id" :value="record.id">{{ record.name }} · {{ typeText(record.recurrenceType) }}</option>
        </select>
      </label>
      <template v-if="plan">
        <p v-if="plan.recurrenceType === 'once'" class="wide-field">生成起点：周期零点（整轮开始）</p>
        <label v-else class="wide-field">起始子任务 *
          <select v-model="form.startItemId" name="generationStartItem" :disabled="busy"><option value="">请选择起始子任务</option>
            <option v-for="(item, i) in sortedItems" :key="item.id" :value="item.id">{{ i + 1 }}. {{ item.content }} · 时长 {{ item.durationMinutes }} 分钟</option>
          </select>
        </label>
        <label>{{ plan.recurrenceType === 'once' ? '整轮开始时间' : '子任务开始时间' }} *（北京时间）
          <input v-model="form.startAt" name="generationStartAt" type="datetime-local" required :disabled="busy" />
        </label>
        <label>生成截止时间 *（北京时间）<input v-model="form.cutoffAt" name="generationCutoffAt" type="datetime-local" required :disabled="busy" />
          <span v-if="form.startAt && form.cutoffAt && form.cutoffAt <= form.startAt" class="error">生成截止时间必须晚于开始时间</span>
        </label>
        <p class="wide-field">日历规则：{{ calendarText }}</p>
        <p class="wide-field">{{ plan.recurrenceType === 'once' ? '按计划定义从整轮起点生成，不修改计划原始开始时间。' : '从所选子任务开始，保留任务间空档。' }}<br />只生成开始时间早于截止时间的任务，任务可能在截止后结束。</p>
      </template>
    </div>
    <dl v-else-if="plan">
      <dt>操作计划</dt><dd>{{ plan.name }} · {{ typeText(plan.recurrenceType) }}</dd>
      <dt>生成起点</dt><dd>{{ plan.recurrenceType === 'once' ? '周期零点' : sortedItems.find(item => item.id === form.startItemId)?.content }}</dd>
      <dt>实际开始时间（北京时间）</dt><dd>{{ form.startAt.replace('T', ' ') }}</dd>
      <dt>截止时间（北京时间）</dt><dd>{{ form.cutoffAt.replace('T', ' ') }}</dd>
      <dt>日历规则</dt><dd>{{ calendarText }}</dd>
    </dl>
    <p class="notice">将替换计划「{{ plan?.name ?? '所选计划' }}」全部未开始的自动安排，包括本次生成范围之外的旧安排。进行中、已完成、已取消及人工维护的实例会保留。</p>
    <p v-if="step === 'form' && validation" class="error">{{ validation }}</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <template #actions>
      <button v-if="step === 'form'" type="button" class="secondary-action" :disabled="busy" @click="emit('close')">取消</button>
      <button v-else ref="backButton" type="button" class="secondary-action" :disabled="busy" @click="emit('back')">返回修改</button>
      <button v-if="step === 'form'" type="button" class="primary-action" :disabled="!!validation || busy || loading" @click="emit('confirm')">下一步</button>
      <button v-else type="button" class="danger-action" :disabled="busy" @click="emit('submit')">{{ busy ? '正在重新生成…' : '确认替换并生成' }}</button>
    </template>
  </PlanWorkflowDialog>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { OperationPlanDetailRecord, OperationPlanRecord } from "../../api/client";
import type { OperationRefreshForm } from "../../composables/admin/useOperationAdmin";
import PlanWorkflowDialog from "./PlanWorkflowDialog.vue";
const props = defineProps<{ plans: OperationPlanRecord[]; plan: OperationPlanDetailRecord | null; locked: boolean; form: OperationRefreshForm; step: 'form' | 'confirm'; busy: boolean; loading: boolean; error: string; validation: string }>();
const emit = defineEmits<{ close: []; plan: [id: string]; confirm: []; back: []; submit: [] }>();
const sortedItems = computed(() => (props.plan?.items ?? []).slice().sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.sortOrder - b.sortOrder));
const calendarText = computed(() => [props.plan?.skipWeekends ? '跳过周末' : '不跳过周末', props.plan?.skipHolidays ? '跳过节假日' : '不跳过节假日'].join(' / '));
const backButton = ref<HTMLButtonElement>();
watch(() => props.step, async (step) => { await nextTick(); if (step === 'confirm') backButton.value?.focus(); else document.querySelector<HTMLElement>('.workflow-dialog select:not(:disabled), .workflow-dialog input:not(:disabled)')?.focus(); });
function typeText(type: string) { return type === 'once' ? '一次性' : type === 'finite' ? '有限循环' : '无限循环'; }
</script>
<style scoped src="./modalStyles.css"></style>
<style scoped>
.error { color: #b91c1c; }
.notice { background: #fff7ed; border: 1px solid #fed7aa; padding: 12px; border-radius: 6px; line-height: 1.6; }
dt { color: #64748b; margin-top: 12px; } dd { margin: 4px 0; }
</style>
