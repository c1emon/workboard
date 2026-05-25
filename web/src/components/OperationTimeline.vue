<template>
  <div class="timeline">
    <div ref="timelineElement" class="vis-operation-timeline" data-testid="board-operation-timeline"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { DataItem, TimelineOptions } from "vis-timeline/standalone";

interface OperationItem {
  content: string;
  startAt: string;
  endAt: string;
  extData: Record<string, unknown>;
}

const props = defineProps<{
  items: OperationItem[];
  serverTime: string;
}>();

const timelineElement = ref<HTMLElement | null>(null);
type VisTimelineModule = typeof import("vis-timeline/standalone");
type TimelineInstance = InstanceType<VisTimelineModule["Timeline"]>;
type TimelineWithCustomMarker = TimelineInstance & {
  setCustomTimeMarker?: (title: string, id?: string, editable?: boolean) => void;
};

let timeline: TimelineInstance | null = null;
let visTimelineModule: VisTimelineModule | null = null;
let isUnmounted = false;
let hasServerTimeMarker = false;

const timelineColorCount = 6;
const dayMs = 24 * 60 * 60 * 1000;
const centerTime = computed(() => {
  const parsed = new Date(props.serverTime);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
});
const windowStart = computed(() => new Date(centerTime.value.getTime() - dayMs / 2));
const windowEnd = computed(() => new Date(centerTime.value.getTime() + dayMs / 2));

onMounted(async () => {
  await nextTick();
  const element = timelineElement.value;
  if (!element) return;
  const { DataSet, Timeline } = await loadVisTimeline();
  if (isUnmounted || timelineElement.value !== element) return;
  timeline = new Timeline(element, new DataSet(toTimelineItems()), timelineOptions());
  syncServerTimeMarker();
  scheduleRedraw();
});

onBeforeUnmount(() => {
  isUnmounted = true;
  timeline?.destroy();
  timeline = null;
});

watch(
  () => [props.items, props.serverTime] as const,
  () => {
    if (!timeline || !visTimelineModule) return;
    const { DataSet } = visTimelineModule;
    timeline.setItems(new DataSet(toTimelineItems()));
    timeline.setOptions(timelineOptions());
    syncServerTimeMarker();
    scheduleRedraw();
  },
  { deep: true }
);

function toTimelineItems(): DataItem[] {
  return props.items.map((item, index) => {
    const start = parseItemDate(item.startAt, centerTime.value);
    const endFallback = new Date(start.getTime() + 30 * 60_000);
    const end = parseItemDate(item.endAt, endFallback);
    const safeEnd = end.getTime() <= start.getTime() ? endFallback : end;

    return {
      id: `${index}-${item.content}`,
      content: item.content,
      start,
      end: safeEnd,
      title: item.content,
      className: `board-operation-item board-operation-color-${index % timelineColorCount}`
    };
  });
}

async function loadVisTimeline(): Promise<VisTimelineModule> {
  if (!visTimelineModule) {
    const [module] = await Promise.all([
      import("vis-timeline/standalone"),
      import("vis-timeline/styles/vis-timeline-graph2d.css")
    ]);
    visTimelineModule = module;
  }
  return visTimelineModule;
}

function timelineOptions(): TimelineOptions {
  return {
    stack: false,
    editable: false,
    selectable: false,
    zoomable: false,
    moveable: false,
    showCurrentTime: false,
    start: windowStart.value,
    end: windowEnd.value,
    min: windowStart.value,
    max: windowEnd.value,
    zoomMin: dayMs,
    zoomMax: dayMs,
    margin: { item: 4, axis: 2 },
    orientation: "top",
    format: {
      minorLabels: {
        millisecond: "HH:mm",
        second: "HH:mm",
        minute: "HH:mm",
        hour: "HH:mm",
        weekday: "HH:mm",
        day: "HH:mm",
        week: "HH:mm",
        month: "HH:mm",
        year: "HH:mm"
      },
      majorLabels: {
        millisecond: "",
        second: "",
        minute: "",
        hour: "",
        weekday: "",
        day: "",
        week: "",
        month: "",
        year: ""
      }
    }
  };
}

function syncServerTimeMarker(): void {
  if (!timeline) return;
  if (hasServerTimeMarker) {
    timeline.setCustomTime(centerTime.value, "server-time");
    return;
  }
  timeline.addCustomTime(centerTime.value, "server-time");
  hasServerTimeMarker = true;
}

function scheduleRedraw(): void {
  timeline?.redraw();
  const redraw = () => timeline?.redraw();
  if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
    window.requestAnimationFrame(redraw);
    return;
  }
  globalThis.setTimeout(redraw, 0);
}

function parseItemDate(value: string, fallback: Date): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}
</script>

<style scoped>
.timeline {
  min-width: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 0 4px;
}

.vis-operation-timeline {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  height: 76px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 6px;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
}

:deep(.vis-timeline) {
  border: 0;
}

:deep(.vis-time-axis .vis-text) {
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

:deep(.vis-grid.vis-vertical) {
  border-left-color: rgba(148, 163, 184, 0.22);
}

:deep(.vis-item.board-operation-item) {
  display: flex;
  align-items: center;
  height: 24px;
  overflow: hidden;
  border-radius: 4px;
  color: #ecfeff;
  font-size: 14px;
  font-weight: 700;
}

:deep(.vis-item.board-operation-item .vis-item-content) {
  display: flex;
  align-items: center;
  height: 100%;
  padding-top: 0;
  padding-bottom: 0;
}

:deep(.vis-item.board-operation-color-0) {
  border-color: rgba(2, 132, 199, 0.46);
  background: rgba(2, 132, 199, 0.82);
}

:deep(.vis-item.board-operation-color-1) {
  border-color: rgba(13, 148, 136, 0.46);
  background: rgba(13, 148, 136, 0.78);
}

:deep(.vis-item.board-operation-color-2) {
  border-color: rgba(79, 70, 229, 0.44);
  background: rgba(79, 70, 229, 0.78);
}

:deep(.vis-item.board-operation-color-3) {
  border-color: rgba(22, 163, 74, 0.44);
  background: rgba(22, 163, 74, 0.76);
}

:deep(.vis-item.board-operation-color-4) {
  border-color: rgba(217, 119, 6, 0.44);
  background: rgba(217, 119, 6, 0.76);
}

:deep(.vis-item.board-operation-color-5) {
  border-color: rgba(219, 39, 119, 0.42);
  background: rgba(219, 39, 119, 0.74);
}

:deep(.vis-custom-time.server-time) {
  width: 4px;
  cursor: default;
  pointer-events: none;
  background: #dc2626;
  box-shadow: 0 0 10px rgba(220, 38, 38, 0.35);
}

:deep(.vis-custom-time.server-time > .vis-custom-time-marker) {
  background: transparent;
  color: #b91c1c;
  font-size: 14px;
}
</style>
