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
  border-right: 1px solid rgba(125, 211, 252, 0.2);
  background: linear-gradient(180deg, rgba(14, 165, 233, 0.16), rgba(15, 23, 42, 0.3));
  color: #bae6fd;
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}
</style>
