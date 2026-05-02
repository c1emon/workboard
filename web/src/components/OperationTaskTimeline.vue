<template>
  <section class="operation-task-timeline">
    <div class="timeline-toolbar">
      <div>
        <div class="timeline-title-row">
          <h3>子任务预览</h3>
          <button v-if="allowAdd" type="button" aria-label="新增子任务" @click="emit('add')">新增</button>
        </div>
      </div>
      <span>{{ readonly ? "点击子任务查看" : "点击子任务编辑" }}</span>
    </div>
    <div ref="timelineElement" class="vis-timeline-host" data-testid="operation-timeline-viewport"></div>
    <ul class="timeline-accessible-items" aria-label="子任务列表">
      <li v-for="item in items" :key="item.id">{{ item.content }}</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { DataItem, TimelineOptions } from "vis-timeline/standalone";
import type { OperationPlanItemRecord } from "../api/client";

const props = defineProps<{
  items: OperationPlanItemRecord[];
  durationMinutes: number;
  startAt: string;
  allowAdd?: boolean;
  readonly: boolean;
  selectedItemId?: string | null;
}>();

const emit = defineEmits<{
  add: [];
  select: [item: OperationPlanItemRecord];
}>();

const timelineElement = ref<HTMLElement | null>(null);
type VisTimelineModule = typeof import("vis-timeline/standalone");
type TimelineInstance = InstanceType<VisTimelineModule["Timeline"]>;

let timeline: TimelineInstance | null = null;
let visTimelineModule: VisTimelineModule | null = null;
let isUnmounted = false;

const timelineColorCount = 6;
const cycleStart = computed(() => new Date(`2026-01-01T${startTimeOfDay.value}:00+08:00`));
const safeDuration = computed(() => Math.max(props.durationMinutes, 1));
const cycleEnd = computed(() => minuteToDate(safeDuration.value));
const startTimeOfDay = computed(() => {
  const match = props.startAt.match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? "00:00";
});

onMounted(async () => {
  await nextTick();
  const element = timelineElement.value;
  if (!element) return;
  const { DataSet, Timeline } = await loadVisTimeline();
  if (isUnmounted || timelineElement.value !== element) return;
  timeline = new Timeline(element, new DataSet(toTimelineItems()), timelineOptions());
  timeline.on("select", (event: { items?: string[] }) => {
    const selectedId = event.items?.[0];
    const selected = props.items.find((item) => item.id === selectedId);
    if (selected) emit("select", selected);
  });
  updateSelection();
  scheduleRedraw();
});

onBeforeUnmount(() => {
  isUnmounted = true;
  timeline?.destroy();
  timeline = null;
});

watch(
  () => [props.items, props.durationMinutes, props.readonly] as const,
  () => {
    if (!timeline || !visTimelineModule) return;
    const { DataSet } = visTimelineModule;
    timeline.setItems(new DataSet(toTimelineItems()));
    timeline.setOptions(timelineOptions());
    updateSelection();
    scheduleRedraw();
  },
  { deep: true }
);

watch(() => props.selectedItemId, () => {
  updateSelection();
  scheduleRedraw();
});

function toTimelineItems(): DataItem[] {
  return props.items.map((item, index) => ({
    id: item.id,
    content: item.content,
    start: minuteToDate(item.offsetMinutes),
    end: minuteToDate(item.offsetMinutes + item.durationMinutes),
    title: `${formatOffset(item.offsetMinutes)} / ${item.durationMinutes} 分钟`,
    className: [
      "operation-task-item",
      `operation-task-color-${index % timelineColorCount}`,
      item.id === props.selectedItemId ? "operation-task-selected" : ""
    ]
      .filter(Boolean)
      .join(" ")
  }));
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
    selectable: true,
    zoomable: true,
    moveable: true,
    showCurrentTime: false,
    start: cycleStart.value,
    end: cycleEnd.value,
    min: cycleStart.value,
    max: cycleEnd.value,
    margin: { item: 10, axis: 8 },
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

function updateSelection(): void {
  if (!timeline) return;
  timeline.setSelection(props.selectedItemId ? [props.selectedItemId] : []);
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

function minuteToDate(value: number): Date {
  return new Date(cycleStart.value.getTime() + Math.max(0, value) * 60_000);
}

function formatOffset(value: number): string {
  const total = Math.max(0, Math.round(value));
  const [startHours, startMinutes] = startTimeOfDay.value.split(":").map(Number);
  const minutesOfDay = (startHours * 60 + startMinutes + total) % (24 * 60);
  const hours = Math.floor(minutesOfDay / 60);
  const minutes = minutesOfDay % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
</script>

<style scoped>
.operation-task-timeline {
  display: grid;
  gap: 10px;
}

.timeline-toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
}

.timeline-toolbar h3 {
  margin: 0 0 4px;
  color: #0f172a;
  font-size: 16px;
}

.timeline-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.timeline-title-row h3 {
  margin: 0;
}

.timeline-title-row button {
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid #1e293b;
  border-radius: 6px;
  background: #fff;
  color: #172033;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
}

.timeline-toolbar p,
.timeline-toolbar span {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.vis-timeline-host {
  min-height: 150px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
}

.timeline-accessible-items {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

:deep(.vis-item.operation-task-item) {
  color: #fff;
  font-weight: 700;
}

:deep(.vis-item.operation-task-color-0) {
  border-color: #2563eb;
  background: #2563eb;
}

:deep(.vis-item.operation-task-color-1) {
  border-color: #16a34a;
  background: #16a34a;
}

:deep(.vis-item.operation-task-color-2) {
  border-color: #dc2626;
  background: #dc2626;
}

:deep(.vis-item.operation-task-color-3) {
  border-color: #7c3aed;
  background: #7c3aed;
}

:deep(.vis-item.operation-task-color-4) {
  border-color: #ea580c;
  background: #ea580c;
}

:deep(.vis-item.operation-task-color-5) {
  border-color: #0891b2;
  background: #0891b2;
}

:deep(.vis-item.operation-task-selected),
:deep(.vis-item.vis-selected) {
  border-color: #0f172a;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.22);
}
</style>
