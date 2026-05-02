<template>
  <div class="list-heading">
    <div>
      <h2>{{ title }}</h2>
      <p>默认展示当天，可以切换日期查看历史或未来安排</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<style scoped>
.list-heading {
  display: flex;
  align-items: center;
}

.list-heading h2 {
  margin: 0 0 6px;
  color: #0f172a;
  font-size: 22px;
}

.list-heading p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}
</style>
