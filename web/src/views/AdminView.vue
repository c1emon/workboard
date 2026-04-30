<template>
  <main class="admin-page">
    <header class="admin-header">
      <div>
        <p class="admin-kicker">后台管理</p>
        <h1>任务看板管理</h1>
      </div>
      <button type="button" class="admin-action">保存变更</button>
    </header>

    <section class="admin-toolbar" aria-label="管理概览">
      <span>今日班次</span>
      <strong>白班</strong>
      <span>同步状态</span>
      <strong>待配置</strong>
    </section>

    <section class="admin-grid" aria-label="管理模块">
      <article v-for="section in sections" :key="section.label" class="admin-section">
        <div>
          <h2>{{ section.label }}</h2>
          <p>{{ section.description }}</p>
        </div>
        <button type="button">进入</button>
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
const sections = [
  { label: "操作", description: "维护操作任务、执行时间与现场备注。" },
  { label: "许可", description: "录入许可安排，配置人员、区域与时段。" },
  { label: "巡视", description: "管理巡视目标、车辆与责任人员。" },
  { label: "其他", description: "登记临时任务和跨班组协同事项。" },
  { label: "休假", description: "维护休假人员名单，供看板实时展示。" },
  { label: "节假日", description: "配置节假日和值班规则。" }
];
</script>

<style scoped>
.admin-page {
  padding: 28px;
  background: #f6f8fb;
  color: #172033;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 0 auto 20px;
  max-width: 1160px;
}

.admin-kicker {
  margin: 0 0 6px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.admin-header h1 {
  margin: 0;
  color: #0f172a;
  font-size: 28px;
  line-height: 1.2;
}

.admin-action,
.admin-section button {
  border: 1px solid #1e293b;
  border-radius: 6px;
  background: #1e293b;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.admin-action {
  min-height: 40px;
  padding: 0 16px;
}

.admin-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 auto 18px;
  max-width: 1160px;
  min-height: 52px;
  padding: 0 16px;
  border: 1px solid #d8dee8;
  background: #fff;
}

.admin-toolbar span {
  color: #64748b;
  font-size: 13px;
}

.admin-toolbar strong {
  margin-right: 18px;
  color: #0f172a;
  font-size: 14px;
}

.admin-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0 auto;
  max-width: 1160px;
}

.admin-section {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-height: 132px;
  padding: 18px;
  border: 1px solid #d8dee8;
  border-radius: 8px;
  background: #fff;
}

.admin-section h2 {
  margin: 0 0 10px;
  color: #0f172a;
  font-size: 18px;
  line-height: 1.2;
}

.admin-section p {
  margin: 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.55;
}

.admin-section button {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 0 12px;
  background: #fff;
  color: #1e293b;
}

@media (max-width: 800px) {
  .admin-page {
    padding: 18px;
  }

  .admin-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .admin-grid {
    grid-template-columns: 1fr;
  }

  .admin-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
    padding: 12px 16px;
  }

  .admin-toolbar strong {
    margin-right: 0;
  }
}
</style>
