<template>
  <section class="list-panel holiday-panel">
    <div class="form-heading">
      <h2>节假日</h2>
      <p>节假日用于周期任务的跳过规则，导入会全量覆盖现有节假日数据。</p>
    </div>
    <div class="holiday-toolbar">
      <label class="holiday-year-field">
        年度
        <input
          name="holidayYear"
          min="1900"
          max="2100"
          type="number"
          :value="year"
          @input="emit('update:year', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <button class="primary-action" type="button" aria-label="导入 chinese-days" @click="emit('import')">
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
</template>

<script setup lang="ts">
import type { HolidayRecord } from "../../api/client";

defineProps<{
  year: number;
  holidayRows: HolidayRecord[];
  adjustedWorkdayRows: HolidayRecord[];
}>();

const emit = defineEmits<{
  "update:year": [value: number];
  import: [];
}>();
</script>

<style scoped src="./managerStyles.css"></style>

<style scoped>
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

.holiday-year-field input {
  width: 100%;
  min-height: 40px;
  padding: 9px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  box-sizing: border-box;
  font: inherit;
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

.primary-action {
  min-height: 40px;
  padding: 0 18px;
  border: 1px solid #1e293b;
  border-radius: 6px;
  background: #1e293b;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}
</style>
