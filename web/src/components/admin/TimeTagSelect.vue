<template>
  <select :value="modelValue" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value as TimeTag)">
    <option v-for="tag in timeTags" :key="tag" :value="tag">{{ tag }}</option>
  </select>
</template>

<script setup lang="ts">
import type { TimeTag } from "../../api/types";

defineProps<{
  modelValue: TimeTag;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: TimeTag];
}>();

const timeTags: TimeTag[] = ["全天", "上午", "下午"];
</script>
