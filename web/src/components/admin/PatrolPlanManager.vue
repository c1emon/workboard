<template>
  <section class="list-panel patrol-plan-panel">
    <ListHeader title="巡视模板" />
    <div class="manager-actions">
      <button type="button" class="primary-action" aria-label="新增巡视模板" @click="emit('add-plan')">新增模板</button>
    </div>
    <div class="table-shell">
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>周期</th>
            <th>跳过</th>
            <th>状态</th>
            <th class="actions-column">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in rows" :key="record.id" :class="{ disabled: !record.enabled }">
            <td>{{ record.name }}</td>
            <td>{{ record.cycleLength }} 天</td>
            <td>{{ skipText(record) }}</td>
            <td>{{ record.enabled ? "启用" : "禁用" }}</td>
            <td class="row-actions">
              <button type="button" @click="emit('select-plan', record)">详情</button>
              <button type="button" @click="emit('toggle-plan', record)">{{ record.enabled ? "禁用" : "启用" }}</button>
              <button type="button" @click="emit('edit-plan', record)">修改</button>
              <button type="button" class="danger" @click="emit('delete-plan', record)">删除</button>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td class="empty-cell" colspan="5">暂无巡视模板</td>
          </tr>
        </tbody>
      </table>
    </div>

    <form v-if="planFormOpen" class="modal-form inline-admin-form" @submit.prevent="emit('save-plan')">
      <div class="modal-heading">
        <div>
          <h2>{{ planEditingId ? "编辑巡视模板" : "新增巡视模板" }}</h2>
        </div>
        <button type="button" aria-label="关闭巡视模板表单" @click="emit('close-plan')">×</button>
      </div>
      <div class="form-grid">
        <label>
          名称
          <input v-model="planForm.name" name="patrolPlanName" required />
        </label>
        <label>
          周期天数
          <input v-model.number="planForm.cycleLength" name="patrolPlanCycleLength" type="number" min="1" required />
        </label>
        <label>
          开始时间
          <input v-model="planForm.startAt" name="patrolPlanStartAt" required />
        </label>
        <label>
          结束时间
          <input v-model="planForm.endAt" name="patrolPlanEndAt" required />
        </label>
        <label class="wide-field">
          说明
          <input v-model="planForm.description" name="patrolPlanDescription" />
        </label>
      </div>
      <div class="checkbox-row">
        <label><input v-model="planForm.skipWeekends" name="patrolPlanSkipWeekends" type="checkbox" /> 跳过周末</label>
        <label><input v-model="planForm.skipHolidays" name="patrolPlanSkipHolidays" type="checkbox" /> 跳过节假日</label>
      </div>
      <div class="modal-actions">
        <button type="button" class="secondary-action" @click="emit('close-plan')">取消</button>
        <button type="submit" class="primary-action">保存模板</button>
      </div>
    </form>

    <section v-if="detail" class="cycle-detail">
      <div class="detail-heading">
        <div>
          <h3>{{ detail.name }} 周期项</h3>
          <p>{{ detail.items.length }} 项</p>
        </div>
        <button type="button" class="secondary-action" @click="emit('add-item')">新增周期项</button>
      </div>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>天</th>
              <th>时间</th>
              <th>目标</th>
              <th>人员</th>
              <th>车辆</th>
              <th>其他</th>
              <th class="actions-column">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in detail.items" :key="item.id">
              <td>{{ item.cycleDay }}</td>
              <td>{{ item.timeTag }}</td>
              <td>{{ item.target }}</td>
              <td>{{ item.personnel || "-" }}</td>
              <td>{{ item.vehicle || "-" }}</td>
              <td>{{ item.other || "-" }}</td>
              <td class="row-actions">
                <button type="button" @click="emit('edit-item', item)">修改</button>
                <button type="button" class="danger" @click="emit('delete-item', item)">删除</button>
              </td>
            </tr>
            <tr v-if="detail.items.length === 0">
              <td class="empty-cell" colspan="7">暂无周期项</td>
            </tr>
          </tbody>
        </table>
      </div>
      <form class="modal-form inline-admin-form" @submit.prevent="emit('save-item')">
        <div class="form-grid">
          <label>
            周期第几天
            <input v-model.number="itemForm.cycleDay" name="patrolCycleDay" type="number" min="1" required />
          </label>
          <label>
            时间
            <select v-model="itemForm.timeTag" name="patrolCycleTimeTag">
              <option value="全天">全天</option>
              <option value="上午">上午</option>
              <option value="下午">下午</option>
            </select>
          </label>
          <label>
            目标
            <input v-model="itemForm.target" name="patrolCycleTarget" required />
          </label>
          <label>
            排序
            <input v-model.number="itemForm.sortOrder" name="patrolCycleSortOrder" type="number" />
          </label>
          <label>
            人员
            <input v-model="itemForm.personnel" name="patrolCyclePersonnel" />
          </label>
          <label>
            车辆
            <input v-model="itemForm.vehicle" name="patrolCycleVehicle" />
          </label>
          <label class="wide-field">
            其他
            <input v-model="itemForm.other" name="patrolCycleOther" />
          </label>
        </div>
        <div class="modal-actions">
          <button type="submit" class="primary-action">{{ itemEditingId ? "保存周期项" : "新增周期项" }}</button>
        </div>
      </form>
    </section>
  </section>
</template>

<script setup lang="ts">
import type { PatrolCycleItemRecord, PatrolPlanDetail, PatrolPlanRecord } from "../../api/client";
import type { PatrolCycleItemForm, PatrolPlanForm } from "../../composables/admin/usePatrolPlanAdmin";
import ListHeader from "./ListHeader.vue";

defineProps<{
  rows: PatrolPlanRecord[];
  detail: PatrolPlanDetail | null;
  planForm: PatrolPlanForm;
  planFormOpen: boolean;
  planEditingId: string | null;
  itemForm: PatrolCycleItemForm;
  itemEditingId: string | null;
}>();

const emit = defineEmits<{
  "add-plan": [];
  "edit-plan": [record: PatrolPlanRecord];
  "select-plan": [record: PatrolPlanRecord];
  "toggle-plan": [record: PatrolPlanRecord];
  "delete-plan": [record: PatrolPlanRecord];
  "close-plan": [];
  "save-plan": [];
  "add-item": [];
  "edit-item": [item: PatrolCycleItemRecord];
  "delete-item": [item: PatrolCycleItemRecord];
  "save-item": [];
}>();

function skipText(record: PatrolPlanRecord): string {
  const parts = [];
  if (record.skipWeekends) parts.push("周末");
  if (record.skipHolidays) parts.push("节假日");
  return parts.length > 0 ? parts.join("、") : "-";
}
</script>

<style scoped src="./managerStyles.css"></style>
<style scoped src="./modalStyles.css"></style>
<style scoped>
.patrol-plan-panel {
  padding-top: 18px;
}

.manager-actions,
.detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.detail-heading h3,
.detail-heading p {
  margin: 0;
}

.detail-heading p {
  color: #64748b;
  font-size: 13px;
}

.cycle-detail {
  display: grid;
  gap: 14px;
}

.inline-admin-form {
  width: 100%;
  box-shadow: none;
}
</style>
