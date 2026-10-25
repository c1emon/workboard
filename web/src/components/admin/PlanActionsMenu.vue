<template>
  <button ref="trigger" type="button" aria-haspopup="menu" :aria-expanded="open" :aria-label="`${name} 更多操作`" :disabled="disabled" @click="toggle" @keydown.down.prevent="show">更多▾</button>
  <Teleport to="body"><div v-if="open" ref="menu" class="plan-menu" role="menu" :style="position" :aria-label="`${name} 操作`" @keydown="keydown">
    <template v-for="(action, index) in actions" :key="action.key">
      <hr v-if="action.separator" />
      <button type="button" role="menuitem" :class="{ danger: action.danger }" :disabled="action.disabled" @click="choose(action.key)">{{ action.label }}</button>
    </template>
  </div></Teleport>
</template>
<script setup lang="ts">
import { nextTick, onUnmounted, ref } from "vue";
const props = defineProps<{ name: string; disabled?: boolean; actions: Array<{ key: string; label: string; separator?: boolean; danger?: boolean; disabled?: boolean }> }>();
const emit = defineEmits<{ action: [key: string] }>();
const open = ref(false), trigger = ref<HTMLButtonElement>(), menu = ref<HTMLElement>();
const position = ref({ top: '0px', left: '0px' });
function close(restore = false) { open.value = false; document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true); if (restore) trigger.value?.focus(); }
function outside(event: Event) { if (!menu.value?.contains(event.target as Node) && !trigger.value?.contains(event.target as Node)) close(); }
function reposition() { const rect = trigger.value?.getBoundingClientRect(); if (!rect) return; const height = menu.value?.offsetHeight ?? 260; position.value = { left: `${Math.max(8, Math.min(rect.right - 208, window.innerWidth - 216))}px`, top: `${Math.max(8, rect.bottom + height > window.innerHeight - 8 ? rect.top - height : rect.bottom + 4)}px` }; }
async function show() { if (props.disabled) return; open.value = true; await nextTick(); reposition(); menu.value?.querySelector<HTMLElement>('button:not(:disabled)')?.focus(); document.addEventListener('pointerdown', outside); window.addEventListener('resize', reposition); window.addEventListener('scroll', reposition, true); }
function toggle() { if (open.value) close(true); else void show(); }
function choose(key: string) { close(true); emit('action', key); }
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape' || event.key === 'Tab') { if (event.key === 'Escape') event.preventDefault(); close(true); return; }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault(); const buttons = [...menu.value!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next]?.focus();
}
onUnmounted(() => close());
</script>
<style scoped>
.plan-menu { position: fixed; z-index: 20; width: 208px; padding: 6px; border: 1px solid #d8dee8; border-radius: 8px; box-shadow: 0 8px 24px #0f172a26; background: white; box-sizing: border-box; }
.plan-menu button { display: block; width: 100%; min-height: 40px; padding: 8px 10px; text-align: left; border: 0; border-radius: 4px; background: white; color: #172033; cursor: pointer; font: inherit; }
.plan-menu button:hover, .plan-menu button:focus-visible { background: #f1f5f9; }
.plan-menu button.danger { color: #b91c1c; }
.plan-menu hr { border: 0; border-top: 1px solid #d8dee8; margin: 4px 0; }
</style>
