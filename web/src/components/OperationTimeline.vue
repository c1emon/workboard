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
  metadata: Record<string, unknown>;
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
    margin: { item: 8, axis: 8 },
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
  (timeline as TimelineWithCustomMarker).setCustomTimeMarker?.("现在", "server-time", false);
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
  padding: 12px 14px;
}

.vis-operation-timeline {
  height: 92px;
  border: 1px solid rgba(125, 211, 252, 0.16);
  background: linear-gradient(180deg, rgba(8, 47, 73, 0.52), rgba(15, 23, 42, 0.84));
}

:deep(.vis-timeline) {
  border: 0;
}

:deep(.vis-time-axis .vis-text) {
  color: rgba(226, 232, 240, 0.82);
  font-size: 11px;
  font-weight: 700;
}

:deep(.vis-grid.vis-vertical) {
  border-left-color: rgba(148, 163, 184, 0.14);
}

:deep(.vis-item.board-operation-item) {
  height: 24px;
  overflow: hidden;
  border-radius: 4px;
  color: #ecfeff;
  font-size: 12px;
  font-weight: 700;
}

:deep(.vis-item.board-operation-color-0) {
  border-color: rgba(56, 189, 248, 0.62);
  background: rgba(14, 165, 233, 0.88);
}

:deep(.vis-item.board-operation-color-1) {
  border-color: rgba(45, 212, 191, 0.62);
  background: rgba(20, 184, 166, 0.8);
}

:deep(.vis-item.board-operation-color-2) {
  border-color: rgba(129, 140, 248, 0.62);
  background: rgba(99, 102, 241, 0.82);
}

:deep(.vis-item.board-operation-color-3) {
  border-color: rgba(74, 222, 128, 0.62);
  background: rgba(22, 163, 74, 0.78);
}

:deep(.vis-item.board-operation-color-4) {
  border-color: rgba(251, 146, 60, 0.68);
  background: rgba(234, 88, 12, 0.78);
}

:deep(.vis-item.board-operation-color-5) {
  border-color: rgba(244, 114, 182, 0.64);
  background: rgba(219, 39, 119, 0.78);
}

:deep(.vis-custom-time.server-time) {
  width: 2px;
  cursor: default;
  pointer-events: none;
  background: #f8fafc;
  box-shadow: 0 0 14px rgba(125, 211, 252, 0.75);
}

:deep(.vis-custom-time.server-time > .vis-custom-time-marker) {
  background: transparent;
  font-size: 14px;
}
</style>
