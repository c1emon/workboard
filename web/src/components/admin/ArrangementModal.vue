<template>
  <div class="modal-backdrop" role="presentation" @click.self="emit('close')">
    <form class="modal-form" @submit.prevent="emit('save')">
      <div class="modal-heading">
        <h2>{{ title }}</h2>
        <button type="button" aria-label="关闭弹窗" @click="emit('close')">×</button>
      </div>
      <div class="form-grid">
        <label>日期<input v-model="form.date" required type="date" /></label>
        <label v-if="kind !== 'leave'">时间标记<TimeTagSelect v-model="form.timeTag" /></label>
        <template v-if="kind === 'permit'">
          <label>对象<input v-model="form.primary" name="target" /></label>
          <label>任务<input v-model="form.secondary" name="task" required /></label>
          <label>人员<input v-model="form.personnel" name="personnel" /></label>
          <label>车辆<input v-model="form.tertiary" name="vehicle" /></label>
          <label>其他<input v-model="form.other" name="other" /></label>
        </template>
        <template v-else-if="kind === 'patrol'">
          <label>巡视目标<input v-model="form.primary" name="target" required /></label>
          <label>人员<input v-model="form.personnel" name="personnel" /></label>
          <label>车辆<input v-model="form.secondary" name="vehicle" /></label>
          <label>其他<input v-model="form.other" name="other" /></label>
        </template>
        <template v-else-if="kind === 'leave'">
          <label>姓名<input v-model="form.primary" name="leaveName" required /></label>
        </template>
        <template v-else>
          <label>任务<input v-model="form.primary" name="task" required /></label>
          <label>人员<input v-model="form.personnel" name="personnel" /></label>
          <label>车辆<input v-model="form.secondary" name="vehicle" /></label>
          <label>其他<input v-model="form.other" name="other" /></label>
        </template>
      </div>
      <div class="modal-actions">
        <button type="button" class="secondary-action" @click="emit('close')">取消</button>
        <button type="submit" class="primary-action">保存</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { TimeTag } from "../../api/types";
import TimeTagSelect from "./TimeTagSelect.vue";

export type ArrangementKind = "permit" | "patrol" | "other" | "leave";

export interface ArrangementForm {
  date: string;
  timeTag: TimeTag;
  primary: string;
  personnel: string;
  secondary: string;
  tertiary: string;
  other: string;
}

defineProps<{
  kind: ArrangementKind;
  title: string;
  form: ArrangementForm;
}>();

const emit = defineEmits<{
  close: [];
  save: [];
}>();
</script>

<style scoped src="./modalStyles.css"></style>
