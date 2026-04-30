<template>
  <div class="timeline">
    <div class="timeline-axis">
      <div class="current-marker">
        <span>{{ currentTime }}</span>
      </div>
      <div
        v-for="(item, index) in positionedItems"
        :key="`${item.content}-${index}`"
        class="timeline-item"
        :style="{ left: `${item.left}%`, width: `${item.width}%` }"
        :title="item.content"
      >
        <span>{{ item.content }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface OperationItem {
  content: string;
  startAt: string;
  endAt: string;
  metadata: Record<string, unknown>;
}

const props = defineProps<{
  items: OperationItem[];
  serverTime: string;
}>();

const currentMs = computed(() => new Date(props.serverTime).getTime());
const currentTime = computed(() => {
  const date = new Date(props.serverTime);
  return Number.isNaN(date.getTime())
    ? "--:--"
    : date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
});

const positionedItems = computed(() => {
  const center = currentMs.value;
  const windowMs = 6 * 60 * 60 * 1000;
  const startWindow = center - windowMs / 2;

  return props.items.map((item) => {
    const start = new Date(item.startAt).getTime();
    const end = new Date(item.endAt).getTime();
    const safeStart = Number.isNaN(start) ? center : start;
    const safeEnd = Number.isNaN(end) ? safeStart + 30 * 60 * 1000 : Math.max(end, safeStart + 5 * 60 * 1000);
    const left = clamp(((safeStart - startWindow) / windowMs) * 100, 0, 96);
    const right = clamp(((safeEnd - startWindow) / windowMs) * 100, 4, 100);

    return {
      content: item.content,
      left,
      width: Math.max(right - left, 4)
    };
  });
});

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
</script>

<style scoped>
.timeline {
  min-width: 0;
  width: 100%;
  padding: 12px 14px;
}

.timeline-axis {
  position: relative;
  height: 76px;
  overflow: hidden;
  border: 1px solid rgba(125, 211, 252, 0.16);
  background:
    linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px) 0 0 / 12.5% 100%,
    linear-gradient(180deg, rgba(8, 47, 73, 0.52), rgba(15, 23, 42, 0.84));
}

.timeline-axis::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  border-top: 1px solid rgba(125, 211, 252, 0.24);
}

.current-marker {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-1px);
  background: #f8fafc;
  box-shadow: 0 0 14px rgba(125, 211, 252, 0.7);
  z-index: 2;
}

.current-marker span {
  position: absolute;
  top: 6px;
  left: 8px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(248, 250, 252, 0.94);
  color: #020617;
  font-size: 11px;
  font-weight: 700;
}

.timeline-item {
  position: absolute;
  top: 38px;
  height: 24px;
  display: flex;
  align-items: center;
  min-width: 42px;
  padding: 0 8px;
  overflow: hidden;
  border: 1px solid rgba(56, 189, 248, 0.55);
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(14, 165, 233, 0.86), rgba(20, 184, 166, 0.78));
  color: #ecfeff;
  font-size: 12px;
  font-weight: 700;
}

.timeline-item span {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
