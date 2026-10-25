<template>
  <section class="list-panel operation-panel">
    <ListHeader title="操作计划" />
    <div class="selection-summary" aria-live="polite">
      <p v-if="selectionLoading">正在读取大屏选择…</p>
      <template v-else>
        <p>当前大屏计划：<strong>{{ selection?.exists ? selection.name : selection?.planId ? '所选计划已删除' : '未选择' }}</strong>　{{ selection?.exists ? selection.enabled ? '已启用' : '已禁用' : '' }}</p>
        <p v-if="selection?.exists && !selection.enabled">计划已禁用，大屏显示无可展示计划</p>
        <p v-if="selection?.exists && !rows.some(row => row.id === selection?.planId)">当前展示计划不在本次筛选结果中</p>
      </template>
      <p v-if="selectionMessage">{{ selectionMessage }}</p>
    </div>
    <DateToolbar :model-value="selectedDate" :show-all="showAll" :allow-show-all="true" :disabled="showAll" :today="today" :yesterday="yesterday" add-label="新增计划"
      @add="emit('add')" @today="emit('today')" @yesterday="emit('yesterday')" @update:model-value="emit('update:selectedDate', $event)" @update:show-all="emit('update:showAll', $event)" />
    <p v-if="generationSummary" role="status">{{ generationSummary }}</p>
    <p v-if="fileSummary" role="status">{{ fileSummary }}</p>
    <div class="table-shell"><table aria-label="操作计划与大屏展示计划">
      <thead><tr><th>大屏</th><th>计划（名称 / 说明）</th><th>类型</th><th>子任务数</th><th>状态</th><th class="actions-column">操作</th></tr></thead>
      <tbody><tr v-for="record in rows" :key="record.id">
        <td><input type="radio" name="operation-board-plan" :aria-label="`大屏展示计划：${record.name}`" :checked="selection?.planId === record.id" :disabled="selectionLoading || !selection || !!selectionSavingId" @change="emit('select-board', record.id)" /><span v-if="selectionSavingId === record.id">切换中…</span></td>
        <td :class="{ 'muted-text': !record.enabled }"><strong>{{ record.name }}</strong><p class="description">{{ record.description }}</p></td>
        <td>{{ recurrenceText(record) }}</td><td>{{ record.childTaskCount }}</td><td>{{ record.enabled ? '已启用' : '已禁用' }}</td>
        <td class="row-actions"><button type="button" :disabled="busy" @click="emit('detail', record)">详情</button><button type="button" :disabled="busy" @click="emit('edit', record)">修改</button>
          <PlanActionsMenu :name="record.name" :disabled="busy" :actions="actions(record)" @action="action($event, record)" />
        </td>
      </tr><tr v-if="!rows.length"><td class="empty-cell" colspan="6">{{ showAll ? '暂无操作计划' : '当前日期暂无操作计划' }}</td></tr></tbody>
    </table></div>
  </section>
</template>
<script setup lang="ts">
import type { OperationBoardSelection, OperationPlanRecord } from "../../api/client";
import DateToolbar from "./DateToolbar.vue";
import ListHeader from "./ListHeader.vue";
import PlanActionsMenu from "./PlanActionsMenu.vue";
const props = defineProps<{ selectedDate: string; today: string; yesterday: string; showAll: boolean; rows: OperationPlanRecord[]; generationSummary: string;
  selection?: OperationBoardSelection | null; selectionLoading?: boolean; selectionSavingId?: string | null; selectionMessage?: string; busy?: boolean; exportingId?: string | null; fileSummary?: string }>();
const emit = defineEmits<{ 'update:selectedDate': [value: string]; 'update:showAll': [value: boolean]; add: []; today: []; yesterday: []; detail: [record: OperationPlanRecord]; toggle: [record: OperationPlanRecord]; edit: [record: OperationPlanRecord]; delete: [id: string]; 'open-refresh': [record?: OperationPlanRecord]; 'select-board': [id: string]; import: [record: OperationPlanRecord]; export: [record: OperationPlanRecord] }>();
function recurrenceText(record: OperationPlanRecord) { return record.recurrenceType === 'once' ? '一次性' : record.recurrenceType === 'finite' ? '有限循环' : '无限循环'; }
function actions(record: OperationPlanRecord) { return [
  { key: 'generate', label: '重新生成实例' }, { key: 'import', label: '导入子任务' },
  { key: 'export', label: props.exportingId === record.id ? '导出中…' : '导出计划 XLSX', disabled: !!props.exportingId },
  { key: 'toggle', label: record.enabled ? '禁用' : '启用', separator: true }, { key: 'delete', label: '删除计划', danger: true }
]; }
function action(key: string, record: OperationPlanRecord) {
  if (key === 'generate') emit('open-refresh', record);
  else if (key === 'import') emit('import', record);
  else if (key === 'export') emit('export', record);
  else if (key === 'toggle') emit('toggle', record);
  else if (key === 'delete') emit('delete', record.id);
}
</script>
<style scoped src="./managerStyles.css"></style>
<style scoped src="./modalStyles.css"></style>
<style scoped>
.operation-panel, .table-shell { min-width: 0; }
:deep(.date-shortcuts) { flex-wrap: wrap; }
.description { margin: 4px 0 0; white-space: normal; max-width: 240px; overflow-wrap: anywhere; }
.muted-text { color: #64748b; }
.selection-summary { overflow-wrap: anywhere; }
.selection-summary p { margin: 4px 0 10px; }
.actions-column { width: 210px; }
input[type="radio"] { width: 18px; min-height: 18px; }
</style>
