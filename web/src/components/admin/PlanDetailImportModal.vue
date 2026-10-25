<template>
  <PlanWorkflowDialog :title="target.kind === 'operation' ? '导入操作子任务' : '导入巡视周期项'" :busy="busy" @close="emit('close')">
    <p>目标计划：{{ target.name }}　当前 {{ target.count }} 项</p>
    <div class="file-actions">
      <button type="button" class="secondary-action" :disabled="busy" @click="downloadTemplate">下载导入模板</button>
      <label>选择 XLSX 文件<input type="file" accept=".xlsx" :disabled="busy" @change="chooseFile" /></label>
    </div>
    <p v-if="fileName">已选：{{ fileName }}</p>
    <p v-if="reading" role="status">正在校验全部明细…</p>
    <p v-if="localError || error" role="alert">{{ localError || error }}</p>
    <template v-if="items.length">
      <p>校验通过：共 {{ items.length }} 项，以下预览前 5 项</p>
      <div class="import-preview"><table><thead><tr><th v-for="header in headers" :key="header">{{ header }}</th></tr></thead>
        <tbody><tr v-for="(row, i) in preview" :key="i"><td v-for="(cell, j) in row" :key="j">{{ cell }}</td></tr></tbody>
      </table></div>
      <p>将用文件中的 {{ items.length }} 项覆盖当前全部 {{ target.count }} 项。</p>
      <p>计划基本信息及已生成实例保持不变。</p>
    </template>
    <template #actions>
      <button type="button" class="secondary-action" :disabled="busy" data-initial-focus @click="emit('close')">取消</button>
      <button type="button" class="danger-action" :disabled="busy || reading || !items.length" @click="emit('submit')">{{ busy ? '正在覆盖…' : '确认覆盖' }}</button>
    </template>
  </PlanWorkflowDialog>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import type { OperationPlanItemInput, PatrolCycleItemImportInput } from "../../api/client";
import type { PlanImportTarget } from "../../composables/admin/usePlanFileExchange";
import { downloadDetailTemplate, operationHeaders, patrolHeaders } from "../../utils/planExcel";
import PlanWorkflowDialog from "./PlanWorkflowDialog.vue";
const props = defineProps<{ target: PlanImportTarget; fileName: string; items: OperationPlanItemInput[] | PatrolCycleItemImportInput['items']; error: string; busy: boolean; reading: boolean }>();
const emit = defineEmits<{ close: []; file: [file: File]; submit: [] }>();
const localError = ref("");
const headers = computed(() => props.target.kind === "operation" ? operationHeaders : patrolHeaders);
const preview = computed(() => props.items.slice(0, 5).map((item, i) => 'offsetMinutes' in item
  ? [i + 1, item.content, item.offsetMinutes, item.durationMinutes]
  : [item.cycleDay, item.timeTag, item.target, item.personnel, item.vehicle, item.other]));
function chooseFile(event: Event) { const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ""; localError.value = ""; if (file) emit("file", file); }
async function downloadTemplate() { try { await downloadDetailTemplate(props.target.kind); } catch { localError.value = "模板下载失败，请重试"; } }
</script>
<style scoped src="./modalStyles.css"></style>
<style scoped>
.file-actions { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }
.file-actions label { min-width: 0; flex: 1; }
.import-preview { max-height: 240px; overflow: auto; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { padding: 8px; border: 1px solid #d8dee8; text-align: left; }
[role="alert"] { color: #b91c1c; }
</style>
