<template>
  <div class="modal-backdrop operation-modal-loading" role="status" aria-live="polite">
    <div class="loading-card">
      <span class="loading-spinner" aria-hidden="true"></span>
      <strong>计划加载中</strong>
    </div>
  </div>
</template>

<style scoped src="./modalStyles.css"></style>

<style scoped>
.loading-card {
  display: grid;
  gap: 12px;
  place-items: center;
  min-width: 180px;
  padding: 24px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  box-shadow: 0 24px 60px rgb(15 23 42 / 24%);
}

.loading-card strong {
  font-size: 14px;
  font-weight: 700;
}

.loading-spinner {
  width: 34px;
  height: 34px;
  border: 3px solid #dbe4f0;
  border-top-color: #2563eb;
  border-radius: 999px;
  animation: loading-spin 0.8s linear infinite;
}

@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
