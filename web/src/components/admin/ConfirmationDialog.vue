<template>
  <div class="modal-backdrop confirmation-backdrop" role="presentation" @click.self="emit('cancel')">
    <section class="modal-form confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
      <div class="modal-heading">
        <h2 id="confirmation-title">{{ title }}</h2>
        <button type="button" aria-label="关闭确认弹窗" @click="emit('cancel')">×</button>
      </div>
      <div class="confirmation-copy">
        <p>{{ message }}</p>
        <p v-if="detail" class="confirmation-detail">{{ detail }}</p>
      </div>
      <div class="modal-actions">
        <button type="button" class="secondary-action confirmation-cancel" @click="emit('cancel')">取消</button>
        <button type="button" class="danger-action confirmation-confirm" @click="emit('confirm')">
          {{ confirmLabel }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
}>();

const emit = defineEmits<{
  cancel: [];
  confirm: [];
}>();
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgb(15 23 42 / 48%);
}

.confirmation-backdrop {
  z-index: 3;
}

.modal-form {
  display: grid;
  gap: 18px;
  width: min(460px, 100%);
  padding: 22px;
  border: 1px solid #d8dee8;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 24px 60px rgb(15 23 42 / 24%);
}

.modal-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.modal-heading h2 {
  margin: 0 0 6px;
  color: #0f172a;
  font-size: 22px;
}

.modal-heading button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  color: #0f172a;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
}

.confirmation-copy {
  display: grid;
  gap: 8px;
}

.confirmation-copy p {
  margin: 0;
  color: #334155;
  line-height: 1.6;
}

.confirmation-detail {
  color: #64748b;
  font-size: 14px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.secondary-action,
.danger-action {
  min-height: 40px;
  padding: 0 18px;
  border: 1px solid #1e293b;
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.secondary-action {
  background: #fff;
  color: #172033;
}

.danger-action {
  border-color: #b91c1c;
  background: #b91c1c;
  color: #fff;
}
</style>
