<template>
  <div class="date-toolbar">
    <div class="date-shortcuts">
      <label class="date-field">
        <span>日期:</span>
        <input
          type="date"
          :value="modelValue"
          :disabled="disabled"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <button class="yesterday-button secondary-action" type="button" :disabled="disabled" @click="emit('yesterday')">昨日</button>
      <button class="today-button secondary-action" type="button" :disabled="disabled" @click="emit('today')">今天</button>
      <label v-if="allowShowAll" class="show-all-field">
        <input
          name="operationShowAll"
          type="checkbox"
          :checked="showAll"
          @change="emit('update:showAll', ($event.target as HTMLInputElement).checked)"
        />
        <span>显示全部</span>
      </label>
    </div>
    <button class="icon-action toolbar-add-action" type="button" :aria-label="addLabel" :title="addLabel" @click="emit('add')">
      +
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
  today: string;
  yesterday: string;
  addLabel: string;
  disabled?: boolean;
  allowShowAll?: boolean;
  showAll?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:showAll": [value: boolean];
  today: [];
  yesterday: [];
  add: [];
}>();
</script>

<style scoped>
.date-toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid #d8dee8;
  background: #f8fafc;
}

.date-shortcuts {
  display: flex;
  align-items: end;
  gap: 12px;
}

.date-field {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
}

.show-all-field {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  color: #334155;
  font-size: 14px;
  font-weight: 700;
}

.show-all-field input {
  width: 15px;
  height: 15px;
  min-height: 15px;
}

.date-field input {
  width: 170px;
  height: 32px;
  min-height: 32px;
  padding: 0 8px;
  box-sizing: border-box;
}

button {
  height: 32px;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid #1e293b;
  border-radius: 6px;
  box-sizing: border-box;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

input:disabled,
button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.secondary-action {
  background: #fff;
  color: #172033;
}

.toolbar-add-action {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  min-height: 32px;
  padding: 0;
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
  font-size: 20px;
  line-height: 1;
  box-shadow: 0 8px 18px rgb(37 99 235 / 24%);
}

@media (max-width: 900px) {
  .date-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
