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

        <section v-else-if="activeKey === 'operation'" class="list-panel operation-panel">
          <ListHeader title="操作计划" />
          <DateToolbar
            v-model="selectedDate"
            v-model:show-all="operationShowAll"
            :allow-show-all="true"
            :disabled="operationShowAll"
            :today="today"
            :yesterday="yesterday"
            add-label="新增计划"
            @add="openOperationModal()"
            @today="jumpToToday"
            @yesterday="jumpToYesterday"
          />
          <div class="table-shell">
            <table>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>说明</th>
                  <th>类型</th>
                  <th>子任务数</th>
                  <th class="actions-column">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in operationRows" :key="record.id" :class="{ disabled: !record.enabled }">
                  <td>{{ record.name }}</td>
                  <td>{{ record.description }}</td>
                  <td>{{ recurrenceText(record) }}</td>
                  <td>{{ record.childTaskCount }}</td>
                  <td class="row-actions">
                    <button type="button" @click="openOperationModal(record, 'detail')">详情</button>
                    <button type="button" @click="toggleOperation(record)">{{ record.enabled ? "禁用" : "启用" }}</button>
                    <button type="button" @click="openOperationModal(record, 'edit')">修改</button>
                    <button type="button" class="danger" @click="removeOperation(record.id)">删除</button>
                  </td>
                </tr>
                <tr v-if="operationRows.length === 0">
                  <td class="empty-cell" colspan="5">{{ operationShowAll ? "暂无操作计划" : "当前日期暂无操作计划" }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

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

        <section v-else class="list-panel holiday-panel">
          <div class="form-heading">
            <h2>节假日</h2>
            <p>节假日用于周期任务的跳过规则，导入会全量覆盖现有节假日数据。</p>
          </div>
          <div class="holiday-toolbar">
            <label class="holiday-year-field">年度<input v-model.number="holidayYear" name="holidayYear" min="1900" max="2100" type="number" /></label>
            <button class="primary-action" type="button" aria-label="导入 chinese-days" @click="openHolidayImportModal">
              导入 chinese-days
            </button>
          </div>
          <div class="holiday-lists">
            <section class="holiday-list-block">
              <h3>休假</h3>
              <div class="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>名称</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="record in holidayRows" :key="record.id">
                      <td>{{ record.date }}</td>
                      <td>{{ record.name }}</td>
                    </tr>
                    <tr v-if="holidayRows.length === 0">
                      <td class="empty-cell" colspan="2">当前年度暂无休假记录</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
            <section class="holiday-list-block">
              <h3>调休</h3>
              <div class="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>名称</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="record in adjustedWorkdayRows" :key="record.id">
                      <td>{{ record.date }}</td>
                      <td>{{ record.name }}</td>
                    </tr>
                    <tr v-if="adjustedWorkdayRows.length === 0">
                      <td class="empty-cell" colspan="2">当前年度暂无调休记录</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
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

    <div v-if="holidayImportModalOpen" class="modal-backdrop" role="presentation" @click.self="closeHolidayImportModal">
      <form class="modal-form holiday-import-modal" @submit.prevent="submitHolidayImport">
        <div class="modal-heading">
          <h2>导入 chinese-days</h2>
          <button type="button" aria-label="关闭导入弹窗" @click="closeHolidayImportModal">×</button>
        </div>
        <div class="import-source-options">
          <label>
            <input v-model="holidayImportForm.source" name="holidayImportSource" type="radio" value="remote" />
            远程导入
          </label>
          <label>
            <input v-model="holidayImportForm.source" name="holidayImportSource" type="radio" value="local" />
            本地文件
          </label>
        </div>
        <label v-if="holidayImportForm.source === 'remote'">
          远程地址
          <input v-model="holidayImportForm.url" name="holidayImportUrl" required type="url" />
        </label>
        <label v-else>
          JSON 文件
          <input name="holidayImportFile" accept="application/json,.json" required type="file" @change="selectHolidayImportFile" />
        </label>
        <p class="danger-note">导入会全量覆盖系统内所有节假日数据，不保留历史节假日数据。</p>
        <div class="modal-actions">
          <button type="button" class="secondary-action" @click="closeHolidayImportModal">取消</button>
          <button type="submit" class="primary-action">开始导入</button>
        </div>
      </form>
    </div>

    <div v-if="operationModalOpen" class="modal-backdrop" role="presentation" @click.self="closeOperationModal">
      <form class="modal-form operation-modal" @submit.prevent="saveOperation">
        <div class="modal-heading">
          <h2>{{ operationModalTitle }}</h2>
          <button type="button" aria-label="关闭弹窗" @click="closeOperationModal">×</button>
        </div>
        <div class="form-grid">
          <label>计划名称<input v-model="operationForm.name" name="operationName" required :disabled="operationReadOnly" /></label>
          <label>说明<input v-model="operationForm.description" :disabled="operationReadOnly" /></label>
          <div class="operation-schedule-row">
            <label>
              循环类型
              <select v-model="operationForm.recurrenceType" :disabled="operationReadOnly">
                <option value="once">一次性</option>
                <option value="finite">有限循环</option>
                <option value="infinite">无限循环</option>
              </select>
            </label>
            <label>开始时间<input v-model="operationForm.startAt" required type="datetime-local" :disabled="operationReadOnly" /></label>
          </div>
          <label v-if="operationHasEndAt">结束时间<input :value="operationComputedEndAt" name="operationEndAt" type="datetime-local" disabled /></label>
          <label v-if="operationReadOnly && operationForm.recurrenceType !== 'once'">
            循环间隔（分钟）
            <input :value="operationDerivedRecurrenceIntervalMinutes" name="operationRecurrenceInterval" type="number" disabled />
          </label>
          <label v-if="operationReadOnly && operationForm.recurrenceType === 'finite'">
            循环次数
            <input :value="operationDerivedRecurrenceCount" name="operationRecurrenceCount" type="number" disabled />
          </label>
        </div>
        <div class="checkbox-row">
          <label><input v-model="operationForm.skipWeekends" type="checkbox" :disabled="operationReadOnly" /> 跳过周末</label>
          <label><input v-model="operationForm.skipHolidays" type="checkbox" :disabled="operationReadOnly" /> 跳过节假日</label>
        </div>
        <OperationTaskTimeline
          v-if="operationModalMode !== 'create'"
          :allow-add="!operationReadOnly && !!operationRecordId"
          :duration-minutes="operationDurationMinutes"
          :items="operationDetailItems"
          :readonly="operationReadOnly"
          :selected-item-id="operationSelectedItemId"
          :start-at="operationForm.startAt"
          @add="openOperationItemCreate"
          @select="selectOperationItem"
        />
        <div class="modal-actions">
          <button type="button" class="secondary-action" @click="closeOperationModal">{{ operationReadOnly ? "关闭" : "取消" }}</button>
          <button v-if="!operationReadOnly" type="submit" class="primary-action">保存</button>
        </div>
      </form>
    </div>

    <div v-if="operationDetailLoading" class="modal-backdrop operation-modal-loading" role="status" aria-live="polite">
      <div class="loading-card">
        <span class="loading-spinner" aria-hidden="true"></span>
        <strong>计划加载中</strong>
      </div>
    </div>

    <div v-if="operationItemModalOpen" class="modal-backdrop item-modal-backdrop" role="presentation" @click.self="closeOperationItemModal">
      <form class="modal-form operation-item-modal" @submit.prevent="saveOperationItem">
        <div class="modal-heading">
          <h2>{{ operationItemModalTitle }}</h2>
          <button type="button" aria-label="关闭子任务弹窗" @click="closeOperationItemModal">×</button>
        </div>
        <div class="form-grid">
          <label>
            开始时间点 (分)
            <input
              v-model.number="operationItemForm.offsetMinutes"
              name="operationItemOffset"
              min="0"
              required
              type="number"
              :disabled="operationReadOnly"
            />
          </label>
          <label>
            任务时长 (分)
            <input
              v-model.number="operationItemForm.durationMinutes"
              name="operationItemDuration"
              min="1"
              required
              type="number"
              :disabled="operationReadOnly"
            />
          </label>
          <label class="wide-field">
            任务内容
            <input
              v-model="operationItemForm.content"
              name="operationItemContent"
              placeholder="A、B 操作"
              required
              :disabled="operationReadOnly"
            />
          </label>
        </div>
        <label>
          JSON
          <textarea v-model="operationItemForm.metadataJson" name="operationItemMetadata" rows="5" :disabled="operationReadOnly"></textarea>
        </label>
        <div class="modal-actions">
          <button
            v-if="!operationReadOnly && operationItemModalMode === 'edit'"
            type="button"
            class="danger-action operation-item-delete"
            @click="removeOperationItem"
          >
            删除
          </button>
          <button type="button" class="secondary-action" @click="closeOperationItemModal">{{ operationReadOnly ? "关闭" : "取消" }}</button>
          <button v-if="!operationReadOnly" type="submit" class="primary-action">保存</button>
        </div>
      </form>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import OperationTaskTimeline from "../components/OperationTaskTimeline.vue";
import {
  createLeavePerson,
  createOperationPlan,
  createOtherArrangement,
  createPatrolArrangement,
  createPermit,
  createTaskItem,
  deleteLeavePerson,
  deleteOperationPlan,
  deleteOtherArrangement,
  deletePatrolArrangement,
  deletePermitArrangement,
  deleteTaskItem,
  fetchHolidays,
  fetchLeavePeople,
  fetchOperationPlan,
  fetchOperationPlans,
  fetchOtherArrangements,
  fetchPatrolArrangements,
  fetchPermitArrangements,
  importChineseDaysHolidays,
  type ChineseDaysPayload,
  type HolidayRecord,
  updateLeavePerson,
  updateOperationPlan,
  updateOperationPlanEnabled,
  updateOtherArrangement,
  updateOtherArrangementEnabled,
  updatePatrolArrangement,
  updatePatrolArrangementEnabled,
  updatePermitArrangement,
  updatePermitArrangementEnabled,
  type LeavePersonRecord,
  type OperationPlanItemRecord,
  type OperationPlanInput,
  type OperationPlanRecord,
  type OtherArrangementRecord,
  type PatrolArrangementRecord,
  type PermitArrangementRecord
} from "../api/client";
import type { TimeTag } from "../api/types";

type SectionKey = "operation" | "permit" | "patrol" | "other" | "leave" | "holiday";
type RecurrenceType = "once" | "finite" | "infinite";
type ModalKind = "permit" | "patrol" | "other" | "leave";
type OperationModalMode = "create" | "edit" | "detail";
type OperationItemModalMode = "create" | "edit";
type HolidayImportSource = "remote" | "local";

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
    addLabel: { type: String, required: true },
    disabled: { type: Boolean, default: false },
    allowShowAll: { type: Boolean, default: false },
    showAll: { type: Boolean, default: false }
  },
  emits: ["update:modelValue", "update:showAll", "today", "yesterday", "add"],
  setup(props, { emit }) {
    return () =>
      h("div", { class: "date-toolbar" }, [
        h("div", { class: "date-shortcuts" }, [
          h("label", { class: "date-field" }, [
            h("span", "日期:"),
            h("input", {
              type: "date",
              value: props.modelValue,
              disabled: props.disabled,
              onInput: (event: Event) => emit("update:modelValue", (event.target as HTMLInputElement).value)
            })
          ]),
          h(
            "button",
            {
              class: "yesterday-button secondary-action",
              type: "button",
              disabled: props.disabled,
              onClick: () => emit("yesterday")
            },
            "昨日"
          ),
          h(
            "button",
            {
              class: "today-button secondary-action",
              type: "button",
              disabled: props.disabled,
              onClick: () => emit("today")
            },
            "今天"
          ),
          props.allowShowAll
            ? h("label", { class: "show-all-field" }, [
                h("input", {
                  name: "operationShowAll",
                  type: "checkbox",
                  checked: props.showAll,
                  onChange: (event: Event) => emit("update:showAll", (event.target as HTMLInputElement).checked)
                }),
                h("span", "显示全部")
              ])
            : null
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
const OPERATION_DETAIL_LOADING_MIN_MS = 300;
const CHINESE_DAYS_DEFAULT_URL = "https://cdn.jsdelivr.net/npm/chinese-days/dist/chinese-days.json";
const activeKey = ref<SectionKey>("operation");
const selectedDate = ref(today);
const statusText = ref("待保存");
const permitRows = ref<PermitArrangementRecord[]>([]);
const patrolRows = ref<PatrolArrangementRecord[]>([]);
const otherRows = ref<OtherArrangementRecord[]>([]);
const leaveRows = ref<LeavePersonRecord[]>([]);
const operationRows = ref<OperationPlanRecord[]>([]);
const operationDetailItems = ref<OperationPlanItemRecord[]>([]);
const operationSelectedItemId = ref<string | null>(null);
const operationShowAll = ref(false);
const holidayYear = ref(Number(today.slice(0, 4)));
const holidayRecords = ref<HolidayRecord[]>([]);
const holidayImportModalOpen = ref(false);
const holidayImportFile = ref<File | null>(null);
const modalKind = ref<ModalKind | null>(null);
const modalRecordId = ref<string | null>(null);
const operationModalOpen = ref(false);
const operationModalMode = ref<OperationModalMode>("create");
const operationRecordId = ref<string | null>(null);
const operationItemModalOpen = ref(false);
const operationItemModalMode = ref<OperationItemModalMode>("edit");
const operationDetailLoading = ref(false);
const activeSection = computed(() => sections.find((section) => section.key === activeKey.value) ?? sections[0]);
const modalTitle = computed(() => `${modalRecordId.value ? "修改" : "新增"}${activeSection.value.label}`);
const operationReadOnly = computed(() => operationModalMode.value === "detail");
const operationModalTitle = computed(() => {
  if (operationModalMode.value === "detail") return "详情计划";
  return `${operationModalMode.value === "edit" ? "修改" : "新增"}计划`;
});
const operationItemModalTitle = computed(() => {
  if (operationReadOnly.value) return "子任务详情";
  return operationItemModalMode.value === "create" ? "新增子任务" : "编辑子任务";
});
const operationStoredDurationMinutes = computed(() => {
  const start = new Date(normalizeDateTime(operationForm.startAt)).getTime();
  const end = new Date(normalizeDateTime(operationForm.endAt)).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 1;
  return Math.max(1, Math.floor((end - start) / 60_000));
});
const operationCycleDurationMinutes = computed(() => {
  return cycleDurationForItems(operationDetailItems.value);
});
const operationDurationMinutes = computed(() => operationCycleDurationMinutes.value);
const operationHasEndAt = computed(() => operationForm.recurrenceType !== "infinite");
const operationDerivedRecurrenceIntervalMinutes = computed(() => operationCycleDurationMinutes.value);
const operationDerivedRecurrenceCount = computed(() => recurrenceCountForItems(operationDetailItems.value));
const operationComputedEndAt = computed(() => computedEndAtForItems(operationDetailItems.value));
const holidayRows = computed(() => holidayRecords.value.filter((record) => record.type === "holiday"));
const adjustedWorkdayRows = computed(() => holidayRecords.value.filter((record) => record.type === "adjusted_workday"));

const operationForm = reactive({
  name: "操作",
  description: "操作安排",
  startAt: `${today}T08:00`,
  endAt: `${today}T20:00`,
  recurrenceType: "once" as RecurrenceType,
  recurrenceIntervalMinutes: 1440,
  recurrenceCount: 7,
  skipWeekends: false,
  skipHolidays: false
});

const operationItemForm = reactive({
  id: "",
  offsetMinutes: 0,
  durationMinutes: 60,
  content: "",
  metadataJson: "{}",
  sortOrder: 0
});

const holidayImportForm = reactive({
  source: "remote" as HolidayImportSource,
  url: CHINESE_DAYS_DEFAULT_URL
});

const modalForm = reactive({
  date: today,
  timeTag: "全天" as TimeTag,
  primary: "",
  personnel: "",
  secondary: "",
  other: ""
});

onMounted(loadActiveList);
watch([activeKey, selectedDate, operationShowAll], loadActiveList);
watch(holidayYear, () => {
  if (activeKey.value === "holiday") void loadActiveList();
});

function toChinaDate(date = new Date()): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function normalizeDateTime(value: string): string {
  return value.length === 16 ? `${value}:00+08:00` : value;
}

function toDateTimeLocal(value: string): string {
  return value.slice(0, 16);
}

function addMinutesToDateTimeLocal(value: string, minutes: number): string {
  const start = new Date(normalizeDateTime(value)).getTime();
  if (Number.isNaN(start)) return value;
  const shifted = new Date(start + Math.max(1, Math.round(minutes)) * 60_000 + 8 * 60 * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function waitForOperationDetailLoadingMinimum(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  const remaining = OPERATION_DETAIL_LOADING_MIN_MS - elapsed;
  if (remaining <= 0) return Promise.resolve();
  return new Promise((resolve) => globalThis.setTimeout(resolve, remaining));
}

function cycleDurationForItems(items: OperationPlanItemRecord[]): number {
  const latestItemEnd = items.reduce((latest, item) => Math.max(latest, item.offsetMinutes + item.durationMinutes), 0);
  return Math.max(1, latestItemEnd || operationStoredDurationMinutes.value);
}

function recurrenceCountForItems(items: OperationPlanItemRecord[]): number {
  return Math.max(1, Math.ceil(operationStoredDurationMinutes.value / cycleDurationForItems(items)));
}

function computedEndAtForItems(items: OperationPlanItemRecord[]): string {
  const cycleDuration = cycleDurationForItems(items);
  const totalDuration = operationForm.recurrenceType === "finite" ? cycleDuration * recurrenceCountForItems(items) : cycleDuration;
  return addMinutesToDateTimeLocal(operationForm.startAt, totalDuration);
}

function recurrencePayloadForItems(form: { recurrenceType: RecurrenceType }, items: OperationPlanItemRecord[]) {
  return {
    recurrenceType: form.recurrenceType,
    recurrenceIntervalMinutes: form.recurrenceType === "once" ? null : cycleDurationForItems(items),
    recurrenceCount: form.recurrenceType === "finite" ? recurrenceCountForItems(items) : null
  };
}

function operationPayloadForItems(items: OperationPlanItemRecord[], item?: OperationPlanInput["item"]): OperationPlanInput {
  return {
    name: operationForm.name,
    description: operationForm.description,
    startAt: normalizeDateTime(operationForm.startAt),
    endAt: normalizeDateTime(computedEndAtForItems(items)),
    ...recurrencePayloadForItems(operationForm, items),
    skipWeekends: operationForm.skipWeekends,
    skipHolidays: operationForm.skipHolidays,
    ...(item ? { item } : {})
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
  if (activeKey.value === "operation") {
    await withStatus(async () => {
      operationRows.value = await fetchOperationPlans(selectedDate.value, operationShowAll.value ? "all" : "date");
    });
  } else if (activeKey.value === "permit") {
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
  } else if (activeKey.value === "holiday") {
    await withStatus(async () => {
      holidayRecords.value = await fetchHolidays(holidayYear.value);
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

function formatDateTimeRange(startAt: string, endAt: string): string {
  return `${startAt.slice(0, 16).replace("T", " ")} - ${endAt.slice(0, 16).replace("T", " ")}`;
}

function recurrenceText(record: OperationPlanRecord): string {
  if (record.recurrenceType === "once") return "一次性";
  if (record.recurrenceType === "finite") return "有限循环";
  return "无限循环";
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

function resetOperationForm(): void {
  operationForm.name = "操作";
  operationForm.description = "操作安排";
  operationForm.startAt = `${selectedDate.value || today}T08:00`;
  operationForm.endAt = `${selectedDate.value || today}T20:00`;
  operationForm.recurrenceType = "once";
  operationForm.recurrenceIntervalMinutes = 1440;
  operationForm.recurrenceCount = 7;
  operationForm.skipWeekends = false;
  operationForm.skipHolidays = false;
  operationDetailItems.value = [];
  operationSelectedItemId.value = null;
  resetOperationItemForm();
}

function resetOperationItemForm(): void {
  operationItemModalOpen.value = false;
  operationItemModalMode.value = "edit";
  operationItemForm.id = "";
  operationItemForm.offsetMinutes = 0;
  operationItemForm.durationMinutes = 60;
  operationItemForm.content = "";
  operationItemForm.metadataJson = "{}";
  operationItemForm.sortOrder = 0;
}

async function openOperationModal(record?: OperationPlanRecord, mode?: OperationModalMode): Promise<void> {
  resetOperationForm();
  operationRecordId.value = record?.id ?? null;
  operationModalMode.value = mode ?? (record ? "edit" : "create");
  if (!record) {
    operationModalOpen.value = true;
    return;
  }

  operationDetailLoading.value = true;
  const loadingStartedAt = Date.now();
  await withStatus(async () => {
    let shouldOpenModal = false;
    try {
      const detail = await fetchOperationPlan(record.id);
      const firstItem = detail.items[0];
      operationDetailItems.value = detail.items;
      operationSelectedItemId.value = firstItem?.id ?? null;
      operationForm.name = detail.name;
      operationForm.description = detail.description;
      operationForm.startAt = toDateTimeLocal(detail.startAt);
      operationForm.endAt = toDateTimeLocal(detail.endAt);
      operationForm.recurrenceType = detail.recurrenceType;
      operationForm.recurrenceIntervalMinutes = detail.recurrenceIntervalMinutes ?? 1440;
      operationForm.recurrenceCount = detail.recurrenceCount ?? 7;
      operationForm.skipWeekends = detail.skipWeekends;
      operationForm.skipHolidays = detail.skipHolidays;
      shouldOpenModal = true;
    } finally {
      await waitForOperationDetailLoadingMinimum(loadingStartedAt);
      operationDetailLoading.value = false;
      if (shouldOpenModal) operationModalOpen.value = true;
    }
  });
}

function selectOperationItem(item: OperationPlanItemRecord): void {
  operationSelectedItemId.value = item.id;
  operationItemModalMode.value = "edit";
  operationItemForm.id = item.id;
  operationItemForm.offsetMinutes = item.offsetMinutes;
  operationItemForm.durationMinutes = item.durationMinutes;
  operationItemForm.content = item.content;
  operationItemForm.metadataJson = JSON.stringify(item.metadata, null, 2);
  operationItemForm.sortOrder = item.sortOrder;
  operationItemModalOpen.value = true;
}

function openOperationItemCreate(): void {
  if (operationReadOnly.value || !operationRecordId.value) return;
  operationSelectedItemId.value = null;
  operationItemModalMode.value = "create";
  operationItemForm.id = "";
  operationItemForm.offsetMinutes = 0;
  operationItemForm.durationMinutes = 60;
  operationItemForm.content = "";
  operationItemForm.metadataJson = "{}";
  operationItemForm.sortOrder = operationDetailItems.value.length;
  operationItemModalOpen.value = true;
}

function closeModal(): void {
  modalKind.value = null;
  modalRecordId.value = null;
}

function openHolidayImportModal(): void {
  holidayImportForm.source = "remote";
  holidayImportForm.url = CHINESE_DAYS_DEFAULT_URL;
  holidayImportFile.value = null;
  holidayImportModalOpen.value = true;
}

function closeHolidayImportModal(): void {
  holidayImportModalOpen.value = false;
  holidayImportFile.value = null;
}

function selectHolidayImportFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  holidayImportFile.value = input.files?.[0] ?? null;
}

function closeOperationModal(): void {
  operationModalOpen.value = false;
  operationModalMode.value = "create";
  operationRecordId.value = null;
  operationDetailLoading.value = false;
  operationDetailItems.value = [];
  operationSelectedItemId.value = null;
  resetOperationItemForm();
}

function closeOperationItemModal(): void {
  operationItemModalOpen.value = false;
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

async function toggleOperation(record: OperationPlanRecord): Promise<void> {
  await withStatus(async () => {
    await updateOperationPlanEnabled(record.id, !record.enabled);
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

async function removeOperation(id: string): Promise<void> {
  if (!window.confirm("确认删除这个操作计划吗？")) return;
  await withStatus(async () => {
    await deleteOperationPlan(id);
    await loadActiveList();
  });
}

async function saveOperation(): Promise<void> {
  if (operationReadOnly.value) return;
  await withStatus(async () => {
    const payload = operationPayloadForItems(operationDetailItems.value);
    if (operationRecordId.value) await updateOperationPlan(operationRecordId.value, payload);
    else await createOperationPlan(payload);
    closeOperationModal();
    await loadActiveList();
  });
}

async function saveOperationItem(): Promise<void> {
  if (operationReadOnly.value || !operationRecordId.value) return;
  const recordId = operationRecordId.value;
  await withStatus(async () => {
    const itemMetadata = parseMetadata(operationItemForm.metadataJson);
    const itemPayload = {
      offsetMinutes: Number(operationItemForm.offsetMinutes),
      durationMinutes: Number(operationItemForm.durationMinutes),
      content: operationItemForm.content,
      metadata: itemMetadata,
      sortOrder: operationItemForm.sortOrder
    };
    if (operationItemModalMode.value === "create") {
      const created = await createTaskItem({
        containerId: recordId,
        ...itemPayload,
        target: "",
        personnel: "",
        vehicle: "",
        other: ""
      });
      const newItem = { id: created.id, ...itemPayload };
      const nextItems = [...operationDetailItems.value, newItem].sort((a, b) => a.sortOrder - b.sortOrder || a.offsetMinutes - b.offsetMinutes);
      await updateOperationPlan(recordId, operationPayloadForItems(nextItems));
      operationDetailItems.value = nextItems;
      closeOperationItemModal();
      await loadActiveList();
      return;
    }

    if (!operationItemForm.id) return;
    const updatedItem = {
      id: operationItemForm.id,
      ...itemPayload
    };
    const nextItems = operationDetailItems.value.map((item) => (item.id === operationItemForm.id ? { ...item, ...updatedItem } : item));
    const payload = operationPayloadForItems(nextItems, updatedItem);
    await updateOperationPlan(recordId, payload);
    operationDetailItems.value = nextItems;
    closeOperationItemModal();
    await loadActiveList();
  });
}

async function removeOperationItem(): Promise<void> {
  if (operationReadOnly.value || operationItemModalMode.value !== "edit" || !operationRecordId.value || !operationItemForm.id) return;
  if (!window.confirm("确认删除这个子任务吗？")) return;

  const recordId = operationRecordId.value;
  const itemId = operationItemForm.id;
  await withStatus(async () => {
    await deleteTaskItem(itemId);
    const nextItems = operationDetailItems.value.filter((item) => item.id !== itemId);
    await updateOperationPlan(recordId, operationPayloadForItems(nextItems));
    operationDetailItems.value = nextItems;
    operationSelectedItemId.value = null;
    closeOperationItemModal();
    await loadActiveList();
  });
}

async function submitHolidayImport(): Promise<void> {
  if (!window.confirm("导入会清空并覆盖全部历史节假日数据，确认继续吗？")) return;
  if (!window.confirm("请再次确认：当前系统内所有节假日数据都会被删除并替换为 chinese-days 数据。")) return;

  statusText.value = "同步中";
  try {
    const payload =
      holidayImportForm.source === "remote" ? await loadHolidayImportRemotePayload() : await loadHolidayImportLocalPayload();
    const result = await importChineseDaysHolidays(payload);
    await loadActiveList();
    closeHolidayImportModal();
    statusText.value = `已导入 ${result.imported} 条`;
  } catch (error) {
    statusText.value = error instanceof Error ? error.message : "导入失败";
  }
}

async function loadHolidayImportRemotePayload(): Promise<ChineseDaysPayload> {
  const response = await fetch(holidayImportForm.url);
  if (!response.ok) throw new Error(`节假日数据下载失败: ${response.status}`);
  return normalizeChineseDaysPayload((await response.json()) as Partial<ChineseDaysPayload>);
}

async function loadHolidayImportLocalPayload(): Promise<ChineseDaysPayload> {
  if (!holidayImportFile.value) throw new Error("请选择本地 JSON 文件");
  const raw = await readHolidayImportFile(holidayImportFile.value);
  return normalizeChineseDaysPayload(JSON.parse(raw) as Partial<ChineseDaysPayload>);
}

function normalizeChineseDaysPayload(payload: Partial<ChineseDaysPayload>): ChineseDaysPayload {
  return {
    holidays: payload.holidays ?? {},
    workdays: payload.workdays ?? {},
    inLieuDays: payload.inLieuDays ?? {}
  };
}

function readHolidayImportFile(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(new Error("本地 JSON 文件读取失败")));
    reader.readAsText(file);
  });
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
.danger-action,
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

.date-toolbar :deep(.show-all-field) {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  color: #334155;
  font-size: 14px;
  font-weight: 700;
}

.date-toolbar :deep(.show-all-field input) {
  width: 15px;
  height: 15px;
  min-height: 15px;
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

.date-toolbar :deep(input:disabled),
.date-toolbar :deep(button:disabled) {
  cursor: not-allowed;
  opacity: 0.55;
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

.holiday-toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid #d8dee8;
  background: #f8fafc;
}

.holiday-year-field {
  width: 180px;
}

.holiday-lists {
  display: grid;
  gap: 18px;
}

.holiday-list-block {
  display: grid;
  gap: 10px;
}

.holiday-list-block h3 {
  margin: 0;
  color: #0f172a;
  font-size: 17px;
}

.import-source-options {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}

.import-source-options label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.import-source-options input {
  width: auto;
  min-height: auto;
}

.danger-note {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-radius: 6px;
  background: #fef2f2;
  color: #991b1b;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.wide-field {
  grid-column: 1 / -1;
}

.operation-schedule-row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

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

.muted-cell {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
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
.secondary-action,
.danger-action {
  min-height: 40px;
  padding: 0 18px;
}

.primary-action {
  justify-self: start;
}

.danger-action {
  border-color: #b91c1c;
  background: #fff;
  color: #b91c1c;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgb(15 23 42 / 48%);
}

.item-modal-backdrop {
  z-index: 2;
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
