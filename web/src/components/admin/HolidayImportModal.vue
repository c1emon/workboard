<template>
  <div class="modal-backdrop" role="presentation" @click.self="emit('close')">
    <form class="modal-form holiday-import-modal" @submit.prevent="emit('submit')">
      <div class="modal-heading">
        <h2>导入 chinese-days</h2>
        <button type="button" aria-label="关闭导入弹窗" @click="emit('close')">×</button>
      </div>
      <div class="import-source-options">
        <label>
          <input v-model="form.source" name="holidayImportSource" type="radio" value="remote" />
          远程导入
        </label>
        <label>
          <input v-model="form.source" name="holidayImportSource" type="radio" value="local" />
          本地文件
        </label>
      </div>
      <label v-if="form.source === 'remote'">
        远程地址
        <input v-model="form.url" name="holidayImportUrl" required type="url" />
      </label>
      <label v-else>
        JSON 文件
        <input name="holidayImportFile" accept="application/json,.json" required type="file" @change="emit('select-file', $event)" />
      </label>
      <p class="danger-note">导入会全量覆盖系统内所有节假日数据，不保留历史节假日数据。</p>
      <div class="modal-actions">
        <button type="button" class="secondary-action" @click="emit('close')">取消</button>
        <button type="submit" class="primary-action">开始导入</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
export type HolidayImportSource = "remote" | "local";

export interface HolidayImportForm {
  source: HolidayImportSource;
  url: string;
}

defineProps<{
  form: HolidayImportForm;
}>();

const emit = defineEmits<{
  close: [];
  submit: [];
  "select-file": [event: Event];
}>();
</script>

<style scoped src="./modalStyles.css"></style>

<style scoped>
.import-source-options {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}

.import-source-options label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.import-source-options input {
  width: auto;
  min-height: auto;
}

.danger-note {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-radius: 6px;
  background: #fef2f2;
  color: #991b1b;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
}
</style>
