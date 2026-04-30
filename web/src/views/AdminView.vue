<template>
  <main class="admin-page">
    <header class="admin-header">
      <div>
        <p class="admin-kicker">后台管理</p>
        <h1>任务看板管理</h1>
      </div>
      <RouterLink class="board-link" to="/board">查看看板</RouterLink>
    </header>

    <section class="admin-toolbar" aria-label="管理概览">
      <span>当前模块</span>
      <strong>{{ activeSection.label }}</strong>
      <span>同步状态</span>
      <strong>{{ statusText }}</strong>
    </section>

    <section class="admin-layout">
      <nav class="section-nav" aria-label="管理模块">
        <button
          v-for="section in sections"
          :key="section.key"
          type="button"
          :class="{ active: activeKey === section.key }"
          @click="activeKey = section.key"
        >
          <strong>{{ section.label }}</strong>
          <span>{{ section.description }}</span>
        </button>
      </nav>

      <section class="editor-panel">
        <form v-if="activeKey === 'operation'" class="admin-form" @submit.prevent="saveOperation">
          <div class="form-heading">
            <h2>操作计划</h2>
            <p>主任务固定为“操作”，子任务代表具体时间段。</p>
          </div>
          <div class="form-grid">
            <label>
              开始时间
              <input v-model="operationForm.startAt" required type="datetime-local" />
            </label>
            <label>
              结束时间
              <input v-model="operationForm.endAt" required type="datetime-local" />
            </label>
            <label>
              循环类型
              <select v-model="operationForm.recurrenceType">
                <option value="once">一次性</option>
                <option value="finite">有限循环</option>
                <option value="infinite">无限循环</option>
              </select>
            </label>
            <label>
              循环间隔（分钟）
              <input v-model.number="operationForm.recurrenceIntervalMinutes" min="1" type="number" />
            </label>
            <label>
              循环次数
              <input v-model.number="operationForm.recurrenceCount" min="1" type="number" />
            </label>
            <label>
              子任务 offset（分钟）
              <input v-model.number="operationForm.offsetMinutes" min="0" required type="number" />
            </label>
            <label>
              子任务时长（分钟）
              <input v-model.number="operationForm.durationMinutes" min="1" required type="number" />
            </label>
            <label>
              展示内容
              <input v-model="operationForm.content" placeholder="A、B 操作" required />
            </label>
          </div>
          <div class="checkbox-row">
            <label><input v-model="operationForm.skipWeekends" type="checkbox" /> 跳过周末</label>
            <label><input v-model="operationForm.skipHolidays" type="checkbox" /> 跳过节假日</label>
          </div>
          <label>
            子任务 JSON
            <textarea v-model="operationForm.metadataJson" rows="5"></textarea>
          </label>
          <button class="primary-action" type="submit">保存操作</button>
        </form>

        <form v-else-if="activeKey === 'permit'" class="admin-form" @submit.prevent="savePermit">
          <div class="form-heading">
            <h2>许可</h2>
            <p>用于看板许可模块，按全天、上午、下午排序展示。</p>
          </div>
          <div class="form-grid">
            <label>日期<input v-model="permitForm.date" required type="date" /></label>
            <label>时间标记<TimeTagSelect v-model="permitForm.timeTag" /></label>
            <label>许可<input v-model="permitForm.permit" required /></label>
            <label>人员<input v-model="permitForm.personnel" /></label>
            <label>区域<input v-model="permitForm.area" /></label>
            <label>其他<input v-model="permitForm.other" /></label>
          </div>
          <button class="primary-action" type="submit">保存许可</button>
        </form>

        <form v-else-if="activeKey === 'patrol'" class="admin-form" @submit.prevent="savePatrol">
          <div class="form-heading">
            <h2>巡视计划</h2>
            <p>巡视为周期任务，子任务可重叠并携带 JSON 元数据。</p>
          </div>
          <div class="form-grid">
            <label>开始时间<input v-model="patrolForm.startAt" required type="datetime-local" /></label>
            <label>结束时间<input v-model="patrolForm.endAt" required type="datetime-local" /></label>
            <label>
              循环类型
              <select v-model="patrolForm.recurrenceType">
                <option value="once">一次性</option>
                <option value="finite">有限循环</option>
                <option value="infinite">无限循环</option>
              </select>
            </label>
            <label>循环间隔（分钟）<input v-model.number="patrolForm.recurrenceIntervalMinutes" min="1" type="number" /></label>
            <label>循环次数<input v-model.number="patrolForm.recurrenceCount" min="1" type="number" /></label>
            <label>时间标记<TimeTagSelect v-model="patrolForm.timeTag" /></label>
            <label>巡视目标<input v-model="patrolForm.target" required /></label>
            <label>人员<input v-model="patrolForm.personnel" /></label>
            <label>车辆<input v-model="patrolForm.vehicle" /></label>
            <label>其他<input v-model="patrolForm.other" /></label>
            <label>offset（分钟）<input v-model.number="patrolForm.offsetMinutes" min="0" required type="number" /></label>
            <label>持续时长（分钟）<input v-model.number="patrolForm.durationMinutes" min="1" required type="number" /></label>
          </div>
          <div class="checkbox-row">
            <label><input v-model="patrolForm.skipWeekends" type="checkbox" /> 跳过周末</label>
            <label><input v-model="patrolForm.skipHolidays" type="checkbox" /> 跳过节假日</label>
          </div>
          <label>
            子任务 JSON
            <textarea v-model="patrolForm.metadataJson" rows="5"></textarea>
          </label>
          <button class="primary-action" type="submit">保存巡视</button>
        </form>

        <form v-else-if="activeKey === 'other'" class="admin-form" @submit.prevent="saveOther">
          <div class="form-heading">
            <h2>其他</h2>
            <p>用于临时任务、跨班组配合和非周期展示内容。</p>
          </div>
          <div class="form-grid">
            <label>日期<input v-model="otherForm.date" required type="date" /></label>
            <label>时间标记<TimeTagSelect v-model="otherForm.timeTag" /></label>
            <label>任务<input v-model="otherForm.task" required /></label>
            <label>人员<input v-model="otherForm.personnel" /></label>
            <label>车辆<input v-model="otherForm.vehicle" /></label>
            <label>其他<input v-model="otherForm.other" /></label>
          </div>
          <button class="primary-action" type="submit">保存其他</button>
        </form>

        <form v-else-if="activeKey === 'leave'" class="admin-form" @submit.prevent="saveLeave">
          <div class="form-heading">
            <h2>休假</h2>
            <p>休假人员仅在看板底部一行展示姓名。</p>
          </div>
          <div class="form-grid">
            <label>日期<input v-model="leaveForm.date" required type="date" /></label>
            <label>姓名<input v-model="leaveForm.name" required /></label>
          </div>
          <button class="primary-action" type="submit">保存休假</button>
        </form>

        <form v-else class="admin-form" @submit.prevent="saveHoliday">
          <div class="form-heading">
            <h2>节假日</h2>
            <p>节假日用于周期任务的跳过规则。</p>
          </div>
          <div class="form-grid">
            <label>日期<input v-model="holidayForm.date" required type="date" /></label>
            <label>名称<input v-model="holidayForm.name" /></label>
          </div>
          <button class="primary-action" type="submit">保存节假日</button>
        </form>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  createHoliday,
  createLeavePerson,
  createOtherArrangement,
  createPermit,
  createTaskContainer,
  createTaskItem
} from "../api/client";
import type { TimeTag } from "../api/types";

type SectionKey = "operation" | "permit" | "patrol" | "other" | "leave" | "holiday";
type RecurrenceType = "once" | "finite" | "infinite";

const TimeTagSelect = defineComponent({
  props: {
    modelValue: { type: String, required: true }
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () =>
      h(
        "select",
        {
          value: props.modelValue,
          onChange: (event: Event) => emit("update:modelValue", (event.target as HTMLSelectElement).value)
        },
        ["全天", "上午", "下午"].map((value) => h("option", { value }, value))
      );
  }
});

const sections: Array<{ key: SectionKey; label: string; description: string }> = [
  { key: "operation", label: "操作", description: "主任务与时间段子任务" },
  { key: "permit", label: "许可", description: "许可事项与执行区域" },
  { key: "patrol", label: "巡视", description: "目标、人员、车辆与备注" },
  { key: "other", label: "其他", description: "临时任务与协同事项" },
  { key: "leave", label: "休假", description: "休假人员名单" },
  { key: "holiday", label: "节假日", description: "跳过规则基础数据" }
];

const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
const activeKey = ref<SectionKey>("operation");
const statusText = ref("待保存");
const activeSection = computed(() => sections.find((section) => section.key === activeKey.value) ?? sections[0]);

const operationForm = reactive({
  startAt: `${today}T08:00`,
  endAt: `${today}T20:00`,
  recurrenceType: "once" as RecurrenceType,
  recurrenceIntervalMinutes: 1440,
  recurrenceCount: 7,
  skipWeekends: false,
  skipHolidays: false,
  offsetMinutes: 0,
  durationMinutes: 480,
  content: "A、B 操作",
  metadataJson: "{}"
});

const permitForm = reactive({
  date: today,
  timeTag: "全天" as TimeTag,
  permit: "",
  personnel: "",
  area: "",
  other: ""
});

const patrolForm = reactive({
  startAt: `${today}T00:00`,
  endAt: `${today}T23:59`,
  recurrenceType: "once" as RecurrenceType,
  recurrenceIntervalMinutes: 1440,
  recurrenceCount: 7,
  skipWeekends: false,
  skipHolidays: false,
  timeTag: "全天" as TimeTag,
  target: "",
  personnel: "",
  vehicle: "",
  other: "",
  offsetMinutes: 0,
  durationMinutes: 600,
  metadataJson: "{}"
});

const otherForm = reactive({
  date: today,
  timeTag: "全天" as TimeTag,
  task: "",
  personnel: "",
  vehicle: "",
  other: ""
});

const leaveForm = reactive({ date: today, name: "" });
const holidayForm = reactive({ date: today, name: "" });

function normalizeDateTime(value: string): string {
  return value.length === 16 ? `${value}:00+08:00` : value;
}

function recurrencePayload(form: {
  recurrenceType: RecurrenceType;
  recurrenceIntervalMinutes: number;
  recurrenceCount: number;
}) {
  return {
    recurrenceType: form.recurrenceType,
    recurrenceIntervalMinutes: form.recurrenceType === "once" ? null : Number(form.recurrenceIntervalMinutes),
    recurrenceCount: form.recurrenceType === "finite" ? Number(form.recurrenceCount) : null
  };
}

function parseMetadata(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON 必须是对象");
  }
  return parsed as Record<string, unknown>;
}

async function withStatus(action: () => Promise<void>): Promise<void> {
  statusText.value = "保存中";
  try {
    await action();
    statusText.value = "已同步";
  } catch (error) {
    statusText.value = error instanceof Error ? error.message : "保存失败";
  }
}

async function saveOperation(): Promise<void> {
  await withStatus(async () => {
    const container = await createTaskContainer({
      type: "operation",
      name: "操作",
      description: "操作安排",
      startAt: normalizeDateTime(operationForm.startAt),
      endAt: normalizeDateTime(operationForm.endAt),
      ...recurrencePayload(operationForm),
      skipWeekends: operationForm.skipWeekends,
      skipHolidays: operationForm.skipHolidays
    });
    await createTaskItem({
      containerId: container.id,
      offsetMinutes: Number(operationForm.offsetMinutes),
      durationMinutes: Number(operationForm.durationMinutes),
      content: operationForm.content,
      target: "",
      personnel: "",
      vehicle: "",
      other: "",
      metadata: parseMetadata(operationForm.metadataJson),
      sortOrder: 0
    });
  });
}

async function savePermit(): Promise<void> {
  await withStatus(() => createPermit(permitForm).then(() => undefined));
}

async function savePatrol(): Promise<void> {
  await withStatus(async () => {
    const container = await createTaskContainer({
      type: "patrol",
      name: "巡视",
      description: "巡视安排",
      startAt: normalizeDateTime(patrolForm.startAt),
      endAt: normalizeDateTime(patrolForm.endAt),
      ...recurrencePayload(patrolForm),
      skipWeekends: patrolForm.skipWeekends,
      skipHolidays: patrolForm.skipHolidays
    });
    await createTaskItem({
      containerId: container.id,
      offsetMinutes: Number(patrolForm.offsetMinutes),
      durationMinutes: Number(patrolForm.durationMinutes),
      content: patrolForm.target,
      timeTag: patrolForm.timeTag,
      target: patrolForm.target,
      personnel: patrolForm.personnel,
      vehicle: patrolForm.vehicle,
      other: patrolForm.other,
      metadata: parseMetadata(patrolForm.metadataJson),
      sortOrder: 0
    });
  });
}

async function saveOther(): Promise<void> {
  await withStatus(() => createOtherArrangement(otherForm).then(() => undefined));
}

async function saveLeave(): Promise<void> {
  await withStatus(() => createLeavePerson(leaveForm).then(() => undefined));
}

async function saveHoliday(): Promise<void> {
  await withStatus(() => createHoliday(holidayForm).then(() => undefined));
}
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
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
  max-width: 1180px;
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

.board-link,
.primary-action {
  border: 1px solid #1e293b;
  border-radius: 6px;
  background: #1e293b;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  text-decoration: none;
}

.board-link {
  padding: 10px 16px;
}

.admin-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 auto 18px;
  max-width: 1180px;
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

.admin-layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
  margin: 0 auto;
  max-width: 1180px;
}

.section-nav {
  display: grid;
  gap: 10px;
  align-content: start;
}

.section-nav button {
  display: grid;
  gap: 6px;
  padding: 16px;
  border: 1px solid #d8dee8;
  border-radius: 8px;
  background: #fff;
  color: #172033;
  cursor: pointer;
  text-align: left;
}

.section-nav button.active {
  border-color: #0f172a;
  box-shadow: inset 3px 0 0 #0f172a;
}

.section-nav strong {
  font-size: 17px;
}

.section-nav span {
  color: #64748b;
  font-size: 13px;
  line-height: 1.4;
}

.editor-panel {
  border: 1px solid #d8dee8;
  border-radius: 8px;
  background: #fff;
}

.admin-form {
  display: grid;
  gap: 18px;
  padding: 22px;
}

.form-heading h2 {
  margin: 0 0 6px;
  color: #0f172a;
  font-size: 22px;
}

.form-heading p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

label {
  display: grid;
  gap: 7px;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
}

input,
select,
textarea {
  width: 100%;
  min-height: 38px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  color: #0f172a;
  font: inherit;
  font-weight: 500;
  padding: 8px 10px;
}

textarea {
  min-height: 112px;
  resize: vertical;
}

.checkbox-row {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}

.checkbox-row label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-row input {
  width: auto;
  min-height: auto;
}

.primary-action {
  justify-self: start;
  min-height: 40px;
  padding: 0 18px;
}

@media (max-width: 900px) {
  .admin-page {
    padding: 18px;
  }

  .admin-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .admin-layout,
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
