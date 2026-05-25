<template>
  <div class="side-label" :aria-label="text">
    <span v-for="character in characters" :key="character">{{ character }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  text: string;
}>();

const characters = computed(() => Array.from(props.text));
</script>

<style scoped>
.side-label {
  width: 34px;
  min-width: 34px;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  border-right: 1px solid rgba(59, 130, 246, 0.18);
  background: linear-gradient(180deg, #eff6ff, #dbeafe);
  color: #1d4ed8;
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}
</style>
