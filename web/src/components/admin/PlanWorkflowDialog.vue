<template>
  <Teleport to="body">
    <div class="workflow-backdrop" @click.self="dismiss">
      <section v-modal-focus="{ close: dismiss, busy }" class="workflow-dialog" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
        <header><h2>{{ title }}</h2><button type="button" :disabled="busy" aria-label="关闭弹窗" @click="dismiss">×</button></header>
        <div class="workflow-body"><slot /></div>
        <footer><slot name="actions" /></footer>
      </section>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { vModalFocus } from "../../utils/modalFocus";
const props = defineProps<{ title: string; busy?: boolean }>();
const emit = defineEmits<{ close: [] }>();
function dismiss() { if (!props.busy) emit("close"); }
</script>
<style scoped>
.workflow-backdrop { position: fixed; inset: 0; z-index: 30; background: rgb(15 23 42 / 48%); display: grid; place-items: center; padding: 18px; }
.workflow-dialog { box-sizing: border-box; width: min(640px, 100%); max-height: calc(100dvh - 36px); display: flex; flex-direction: column; gap: 18px; padding: 22px; border-radius: 8px; border: 1px solid #d8dee8; background: white; color: #172033; min-width: 0; }
header { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
h2 { margin: 0; font-size: 22px; }
header button { width: 34px; height: 34px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 22px; cursor: pointer; }
.workflow-body { overflow: auto; min-height: 0; overflow-wrap: anywhere; }
footer { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; }
</style>
