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
        <section v-if="activeKey === 'permit'" class="list-panel">
          <ListHeader title="许可列表" />
          <DateToolbar
            v-model="selectedDate"
            :today="today"
            :yesterday="yesterday"
            add-label="新增许可"
            @add="openPermitModal()"
            @today="jumpToToday"
            @yesterday="jumpToYesterday"
          />
          <div class="table-shell">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>许可</th>
                  <th>人员</th>
                  <th>区域</th>
                  <th>其他</th>
                  <th class="actions-column">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in permitRows" :key="record.id" :class="{ disabled: !record.enabled }">
                  <td>{{ record.timeTag }}</td>
                  <td>{{ record.permit }}</td>
                  <td>{{ record.personnel || "-" }}</td>
                  <td>{{ record.area || "-" }}</td>
                  <td>{{ record.other || "-" }}</td>
                  <td class="row-actions">
                    <button
                      type="button"
                      :aria-label="record.enabled ? '禁用许可' : '启用许可'"
                      @click="togglePermit(record)"
                    >
                      {{ record.enabled ? "禁用" : "启用" }}
                    </button>
                    <button type="button" @click="openPermitModal(record)">修改</button>
                    <button type="button" class="danger" @click="removePermit(record.id)">删除</button>
                  </td>
                </tr>
                <tr v-if="permitRows.length === 0">
                  <td class="empty-cell" colspan="6">当前日期暂无许可</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-else-if="activeKey === 'patrol'" class="list-panel">
          <ListHeader title="巡视列表" />
          <DateToolbar
            v-model="selectedDate"
            :today="today"
            :yesterday="yesterday"
            add-label="新增巡视"
            @add="openPatrolModal()"
            @today="jumpToToday"
            @yesterday="jumpToYesterday"
          />
          <div class="table-shell">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>巡视目标</th>
                  <th>人员</th>
                  <th>车辆</th>
                  <th>其他</th>
                  <th class="actions-column">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in patrolRows" :key="record.id" :class="{ disabled: !record.enabled }">
                  <td>{{ record.timeTag }}</td>
                  <td>{{ record.target }}</td>
                  <td>{{ record.personnel || "-" }}</td>
                  <td>{{ record.vehicle || "-" }}</td>
                  <td>{{ record.other || "-" }}</td>
                  <td class="row-actions">
                    <button type="button" @click="togglePatrol(record)">{{ record.enabled ? "禁用" : "启用" }}</button>
                    <button type="button" @click="openPatrolModal(record)">修改</button>
                    <button type="button" class="danger" @click="removePatrol(record.id)">删除</button>
                  </td>
                </tr>
                <tr v-if="patrolRows.length === 0">
                  <td class="empty-cell" colspan="6">当前日期暂无巡视</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-else-if="activeKey === 'other'" class="list-panel">
          <ListHeader title="其他列表" />
          <DateToolbar
            v-model="selectedDate"
            :today="today"
            :yesterday="yesterday"
            add-label="新增其他"
            @add="openOtherModal()"
            @today="jumpToToday"
            @yesterday="jumpToYesterday"
          />
          <div class="table-shell">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>任务</th>
                  <th>人员</th>
                  <th>车辆</th>
                  <th>其他</th>
                  <th class="actions-column">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in otherRows" :key="record.id" :class="{ disabled: !record.enabled }">
                  <td>{{ record.timeTag }}</td>
                  <td>{{ record.task }}</td>
                  <td>{{ record.personnel || "-" }}</td>
                  <td>{{ record.vehicle || "-" }}</td>
                  <td>{{ record.other || "-" }}</td>
                  <td class="row-actions">
                    <button type="button" @click="toggleOther(record)">{{ record.enabled ? "禁用" : "启用" }}</button>
                    <button type="button" @click="openOtherModal(record)">修改</button>
                    <button type="button" class="danger" @click="removeOther(record.id)">删除</button>
                  </td>
                </tr>
                <tr v-if="otherRows.length === 0">
                  <td class="empty-cell" colspan="6">当前日期暂无其他事项</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <form v-else-if="activeKey === 'operation'" class="admin-form" @submit.prevent="saveOperation">
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

        <section v-else-if="activeKey === 'leave'" class="list-panel">
          <ListHeader title="休假列表" />
          <DateToolbar
            v-model="selectedDate"
            :today="today"
            :yesterday="yesterday"
            add-label="新增休假"
            @add="openLeaveModal()"
            @today="jumpToToday"
            @yesterday="jumpToYesterday"
          />
          <div class="table-shell leave-table-shell">
            <table class="leave-table">
              <thead>
                <tr>
                  <th class="leave-name-column">姓名</th>
                  <th class="actions-column">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in leaveRows" :key="record.id" :class="{ disabled: !record.enabled }">
                  <td class="leave-name-column">{{ record.name }}</td>
                  <td class="row-actions">
                    <button type="button" class="danger" @click="removeLeave(record.id)">删除</button>
                  </td>
                </tr>
                <tr v-if="leaveRows.length === 0">
                  <td class="empty-cell" colspan="2">当前日期暂无休假人员</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

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

    <div v-if="modalKind" class="modal-backdrop" role="presentation" @click.self="closeModal">
      <form class="modal-form" @submit.prevent="saveModal">
        <div class="modal-heading">
          <h2>{{ modalTitle }}</h2>
          <button type="button" aria-label="关闭弹窗" @click="closeModal">×</button>
        </div>
        <div class="form-grid">
          <label>日期<input v-model="modalForm.date" required type="date" /></label>
          <label v-if="modalKind !== 'leave'">时间标记<TimeTagSelect v-model="modalForm.timeTag" /></label>
          <template v-if="modalKind === 'permit'">
            <label>许可<input v-model="modalForm.primary" name="permit" required /></label>
            <label>人员<input v-model="modalForm.personnel" name="personnel" /></label>
            <label>区域<input v-model="modalForm.secondary" name="area" /></label>
            <label>其他<input v-model="modalForm.other" name="other" /></label>
          </template>
          <template v-else-if="modalKind === 'patrol'">
            <label>巡视目标<input v-model="modalForm.primary" name="target" required /></label>
            <label>人员<input v-model="modalForm.personnel" name="personnel" /></label>
            <label>车辆<input v-model="modalForm.secondary" name="vehicle" /></label>
            <label>其他<input v-model="modalForm.other" name="other" /></label>
          </template>
          <template v-else-if="modalKind === 'leave'">
            <label>姓名<input v-model="modalForm.primary" name="leaveName" required /></label>
          </template>
          <template v-else>
            <label>任务<input v-model="modalForm.primary" name="task" required /></label>
            <label>人员<input v-model="modalForm.personnel" name="personnel" /></label>
            <label>车辆<input v-model="modalForm.secondary" name="vehicle" /></label>
            <label>其他<input v-model="modalForm.other" name="other" /></label>
          </template>
        </div>
        <div class="modal-actions">
          <button type="button" class="secondary-action" @click="closeModal">取消</button>
          <button type="submit" class="primary-action">保存</button>
        </div>
      </form>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import {
  createHoliday,
  createLeavePerson,
  createOtherArrangement,
  createPatrolArrangement,
  createPermit,
  createTaskContainer,
  createTaskItem,
  deleteLeavePerson,
  deleteOtherArrangement,
  deletePatrolArrangement,
  deletePermitArrangement,
  fetchLeavePeople,
  fetchOtherArrangements,
  fetchPatrolArrangements,
  fetchPermitArrangements,
  updateLeavePerson,
  updateOtherArrangement,
  updateOtherArrangementEnabled,
  updatePatrolArrangement,
  updatePatrolArrangementEnabled,
  updatePermitArrangement,
  updatePermitArrangementEnabled,
  type LeavePersonRecord,
  type OtherArrangementRecord,
  type PatrolArrangementRecord,
  type PermitArrangementRecord
} from "../api/client";
import type { TimeTag } from "../api/types";

type SectionKey = "operation" | "permit" | "patrol" | "other" | "leave" | "holiday";
type RecurrenceType = "once" | "finite" | "infinite";
type ModalKind = "permit" | "patrol" | "other" | "leave";

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

const ListHeader = defineComponent({
  props: {
    title: { type: String, required: true }
  },
  setup(props) {
    return () =>
      h("div", { class: "list-heading" }, [
        h("div", [h("h2", props.title), h("p", "默认展示当天，可以切换日期查看历史或未来安排")])
      ]);
  }
});

const DateToolbar = defineComponent({
  props: {
    modelValue: { type: String, required: true },
    today: { type: String, required: true },
    yesterday: { type: String, required: true },
    addLabel: { type: String, required: true }
  },
  emits: ["update:modelValue", "today", "yesterday", "add"],
  setup(props, { emit }) {
    return () =>
      h("div", { class: "date-toolbar" }, [
        h("div", { class: "date-shortcuts" }, [
          h("label", { class: "date-field" }, [
            h("span", "日期:"),
            h("input", {
              type: "date",
              value: props.modelValue,
              onInput: (event: Event) => emit("update:modelValue", (event.target as HTMLInputElement).value)
            })
          ]),
          h(
            "button",
            {
              class: "yesterday-button secondary-action",
              type: "button",
              onClick: () => emit("yesterday")
            },
            "昨日"
          ),
          h(
            "button",
            {
              class: "today-button secondary-action",
              type: "button",
              onClick: () => emit("today")
            },
            "今天"
          )
        ]),
        h(
          "button",
          {
            class: "icon-action toolbar-add-action",
            type: "button",
            "aria-label": props.addLabel,
            title: props.addLabel,
            onClick: () => emit("add")
          },
          "+"
        )
      ]);
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

const today = toChinaDate();
const yesterday = toChinaDate(new Date(Date.now() - 24 * 60 * 60_000));
const activeKey = ref<SectionKey>("operation");
const selectedDate = ref(today);
const statusText = ref("待保存");
const permitRows = ref<PermitArrangementRecord[]>([]);
const patrolRows = ref<PatrolArrangementRecord[]>([]);
const otherRows = ref<OtherArrangementRecord[]>([]);
const leaveRows = ref<LeavePersonRecord[]>([]);
const modalKind = ref<ModalKind | null>(null);
const modalRecordId = ref<string | null>(null);
const activeSection = computed(() => sections.find((section) => section.key === activeKey.value) ?? sections[0]);
const modalTitle = computed(() => `${modalRecordId.value ? "修改" : "新增"}${activeSection.value.label}`);

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

const holidayForm = reactive({ date: today, name: "" });
const modalForm = reactive({
  date: today,
  timeTag: "全天" as TimeTag,
  primary: "",
  personnel: "",
  secondary: "",
  other: ""
});

onMounted(loadActiveList);
watch([activeKey, selectedDate], loadActiveList);

function toChinaDate(date = new Date()): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

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
  statusText.value = "同步中";
  try {
    await action();
    statusText.value = "已同步";
  } catch (error) {
    statusText.value = error instanceof Error ? error.message : "操作失败";
  }
}

async function loadActiveList(): Promise<void> {
  if (activeKey.value === "permit") {
    await withStatus(async () => {
      permitRows.value = await fetchPermitArrangements(selectedDate.value);
    });
  } else if (activeKey.value === "patrol") {
    await withStatus(async () => {
      patrolRows.value = await fetchPatrolArrangements(selectedDate.value);
    });
  } else if (activeKey.value === "other") {
    await withStatus(async () => {
      otherRows.value = await fetchOtherArrangements(selectedDate.value);
    });
  } else if (activeKey.value === "leave") {
    await withStatus(async () => {
      leaveRows.value = await fetchLeavePeople(selectedDate.value);
    });
  }
}

function jumpToToday(): void {
  selectedDate.value = today;
}

function jumpToYesterday(): void {
  selectedDate.value = shiftDate(selectedDate.value || today, -1);
}

function shiftDate(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resetModal(kind: ModalKind, recordId: string | null): void {
  modalKind.value = kind;
  modalRecordId.value = recordId;
  modalForm.date = selectedDate.value || today;
  modalForm.timeTag = "全天";
  modalForm.primary = "";
  modalForm.personnel = "";
  modalForm.secondary = "";
  modalForm.other = "";
}

function openPermitModal(record?: PermitArrangementRecord): void {
  resetModal("permit", record?.id ?? null);
  if (record) {
    modalForm.date = record.date;
    modalForm.timeTag = record.timeTag;
    modalForm.primary = record.permit;
    modalForm.personnel = record.personnel;
    modalForm.secondary = record.area;
    modalForm.other = record.other;
  }
}

function openPatrolModal(record?: PatrolArrangementRecord): void {
  resetModal("patrol", record?.id ?? null);
  if (record) {
    modalForm.date = record.date;
    modalForm.timeTag = record.timeTag;
    modalForm.primary = record.target;
    modalForm.personnel = record.personnel;
    modalForm.secondary = record.vehicle;
    modalForm.other = record.other;
  }
}

function openOtherModal(record?: OtherArrangementRecord): void {
  resetModal("other", record?.id ?? null);
  if (record) {
    modalForm.date = record.date;
    modalForm.timeTag = record.timeTag;
    modalForm.primary = record.task;
    modalForm.personnel = record.personnel;
    modalForm.secondary = record.vehicle;
    modalForm.other = record.other;
  }
}

function openLeaveModal(record?: LeavePersonRecord): void {
  resetModal("leave", record?.id ?? null);
  if (record) {
    modalForm.date = record.date;
    modalForm.primary = record.name;
  }
}

function closeModal(): void {
  modalKind.value = null;
  modalRecordId.value = null;
}

async function saveModal(): Promise<void> {
  if (!modalKind.value) return;
  await withStatus(async () => {
    if (modalKind.value === "permit") {
      const payload = {
        date: modalForm.date,
        timeTag: modalForm.timeTag,
        permit: modalForm.primary,
        personnel: modalForm.personnel,
        area: modalForm.secondary,
        other: modalForm.other
      };
      if (modalRecordId.value) await updatePermitArrangement(modalRecordId.value, payload);
      else await createPermit(payload);
    } else if (modalKind.value === "patrol") {
      const payload = {
        date: modalForm.date,
        timeTag: modalForm.timeTag,
        target: modalForm.primary,
        personnel: modalForm.personnel,
        vehicle: modalForm.secondary,
        other: modalForm.other
      };
      if (modalRecordId.value) await updatePatrolArrangement(modalRecordId.value, payload);
      else await createPatrolArrangement(payload);
    } else if (modalKind.value === "leave") {
      const payload = {
        date: modalForm.date,
        name: modalForm.primary
      };
      if (modalRecordId.value) await updateLeavePerson(modalRecordId.value, payload);
      else await createLeavePerson(payload);
    } else {
      const payload = {
        date: modalForm.date,
        timeTag: modalForm.timeTag,
        task: modalForm.primary,
        personnel: modalForm.personnel,
        vehicle: modalForm.secondary,
        other: modalForm.other
      };
      if (modalRecordId.value) await updateOtherArrangement(modalRecordId.value, payload);
      else await createOtherArrangement(payload);
    }
    closeModal();
    selectedDate.value = modalForm.date;
    await loadActiveList();
  });
}

async function togglePermit(record: PermitArrangementRecord): Promise<void> {
  await withStatus(async () => {
    await updatePermitArrangementEnabled(record.id, !record.enabled);
    await loadActiveList();
  });
}

async function togglePatrol(record: PatrolArrangementRecord): Promise<void> {
  await withStatus(async () => {
    await updatePatrolArrangementEnabled(record.id, !record.enabled);
    await loadActiveList();
  });
}

async function toggleOther(record: OtherArrangementRecord): Promise<void> {
  await withStatus(async () => {
    await updateOtherArrangementEnabled(record.id, !record.enabled);
    await loadActiveList();
  });
}

async function removePermit(id: string): Promise<void> {
  if (!window.confirm("确认删除这条许可吗？")) return;
  await withStatus(async () => {
    await deletePermitArrangement(id);
    await loadActiveList();
  });
}

async function removePatrol(id: string): Promise<void> {
  if (!window.confirm("确认删除这条巡视吗？")) return;
  await withStatus(async () => {
    await deletePatrolArrangement(id);
    await loadActiveList();
  });
}

async function removeOther(id: string): Promise<void> {
  if (!window.confirm("确认删除这条其他事项吗？")) return;
  await withStatus(async () => {
    await deleteOtherArrangement(id);
    await loadActiveList();
  });
}

async function removeLeave(id: string): Promise<void> {
  if (!window.confirm("确认删除这条休假吗？")) return;
  await withStatus(async () => {
    await deleteLeavePerson(id);
    await loadActiveList();
  });
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
.primary-action,
.secondary-action,
.icon-action,
.row-actions button {
  border: 1px solid #1e293b;
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  text-decoration: none;
}

.board-link,
.primary-action,
.icon-action {
  background: #1e293b;
  color: #fff;
}

.board-link {
  padding: 10px 16px;
}

.secondary-action,
.row-actions button {
  background: #fff;
  color: #172033;
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

.list-panel,
.admin-form {
  display: grid;
  gap: 18px;
  padding: 22px;
}

.list-heading {
  display: flex;
  align-items: center;
}

.list-heading h2,
.form-heading h2,
.modal-heading h2 {
  margin: 0 0 6px;
  color: #0f172a;
  font-size: 22px;
}

.list-heading p,
.form-heading p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.icon-action {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  font-size: 25px;
  line-height: 1;
}

.date-toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid #d8dee8;
  background: #f8fafc;
}

.date-toolbar :deep(.date-shortcuts) {
  display: flex;
  align-items: end;
  gap: 12px;
}

.date-toolbar :deep(.date-field) {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
}

.date-toolbar :deep(.date-field input) {
  width: 170px;
  height: 32px;
  min-height: 32px;
  padding: 0 8px;
  box-sizing: border-box;
}

.date-toolbar :deep(button) {
  height: 32px;
  min-height: 32px;
  padding: 0 12px;
  box-sizing: border-box;
}

.date-toolbar :deep(.toolbar-add-action) {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  min-height: 32px;
  padding: 0;
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
  font-size: 20px;
  line-height: 1;
  box-shadow: 0 8px 18px rgb(37 99 235 / 24%);
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

.table-shell {
  overflow-x: auto;
  border: 1px solid #d8dee8;
}

table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
}

.leave-table-shell {
  width: 100%;
}

.leave-table {
  width: 100%;
  min-width: 0;
  table-layout: fixed;
}

.leave-name-column {
  width: 120px;
}

th,
td {
  color: #0f172a;
  padding: 12px;
  border-bottom: 1px solid #e5eaf2;
  text-align: left;
  vertical-align: middle;
}

th {
  background: #f1f5f9;
  color: #334155;
  font-size: 13px;
}

tr.disabled td:not(.row-actions) {
  color: #94a3b8;
}

.actions-column {
  width: 196px;
}

.row-actions {
  display: flex;
  gap: 8px;
  white-space: nowrap;
}

.row-actions button {
  min-height: 32px;
  padding: 0 10px;
}

.row-actions .danger {
  border-color: #b91c1c;
  color: #b91c1c;
}

.empty-cell {
  color: #64748b;
  text-align: center;
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

.primary-action,
.secondary-action {
  min-height: 40px;
  padding: 0 18px;
}

.primary-action {
  justify-self: start;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgb(15 23 42 / 48%);
}

.modal-form {
  display: grid;
  gap: 18px;
  width: min(640px, 100%);
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

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
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

  .date-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
