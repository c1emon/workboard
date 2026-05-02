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
        <PermitManager
          v-if="activeKey === 'permit'"
          v-model:selected-date="selectedDate"
          :today="today"
          :yesterday="yesterday"
          :rows="permitRows"
          @add="openPermitModal()"
          @today="jumpToToday"
          @yesterday="jumpToYesterday"
          @toggle="togglePermit"
          @edit="openPermitModal"
          @delete="removePermit"
        />

        <PatrolManager
          v-else-if="activeKey === 'patrol'"
          v-model:selected-date="selectedDate"
          :today="today"
          :yesterday="yesterday"
          :rows="patrolRows"
          @add="openPatrolModal()"
          @today="jumpToToday"
          @yesterday="jumpToYesterday"
          @toggle="togglePatrol"
          @edit="openPatrolModal"
          @delete="removePatrol"
        />

        <OtherManager
          v-else-if="activeKey === 'other'"
          v-model:selected-date="selectedDate"
          :today="today"
          :yesterday="yesterday"
          :rows="otherRows"
          @add="openOtherModal()"
          @today="jumpToToday"
          @yesterday="jumpToYesterday"
          @toggle="toggleOther"
          @edit="openOtherModal"
          @delete="removeOther"
        />

        <OperationManager
          v-else-if="activeKey === 'operation'"
          v-model:selected-date="selectedDate"
          v-model:show-all="operationShowAll"
          :today="today"
          :yesterday="yesterday"
          :rows="operationRows"
          @add="openOperationModal()"
          @today="jumpToToday"
          @yesterday="jumpToYesterday"
          @detail="(record) => openOperationModal(record, 'detail')"
          @toggle="toggleOperation"
          @edit="(record) => openOperationModal(record, 'edit')"
          @delete="removeOperation"
        />

        <LeaveManager
          v-else-if="activeKey === 'leave'"
          v-model:selected-date="selectedDate"
          :today="today"
          :yesterday="yesterday"
          :rows="leaveRows"
          @add="openLeaveModal()"
          @today="jumpToToday"
          @yesterday="jumpToYesterday"
          @delete="removeLeave"
        />

        <HolidayManager
          v-else
          v-model:year="holidayYear"
          :holiday-rows="holidayRows"
          :adjusted-workday-rows="adjustedWorkdayRows"
          @import="openHolidayImportModal"
        />
      </section>
    </section>

    <ArrangementModal
      v-if="modalKind"
      :kind="modalKind"
      :title="modalTitle"
      :form="modalForm"
      @close="closeModal"
      @save="saveModal"
    />

    <HolidayImportModal
      v-if="holidayImportModalOpen"
      :form="holidayImportForm"
      @close="closeHolidayImportModal"
      @select-file="selectHolidayImportFile"
      @submit="submitHolidayImport"
    />

    <OperationPlanModal
      v-if="operationModalOpen"
      :title="operationModalTitle"
      :mode="operationModalMode"
      :form="operationForm"
      :read-only="operationReadOnly"
      :has-end-at="operationHasEndAt"
      :computed-end-at="operationComputedEndAt"
      :derived-recurrence-interval-minutes="operationDerivedRecurrenceIntervalMinutes"
      :derived-recurrence-count="operationDerivedRecurrenceCount"
      :duration-minutes="operationDurationMinutes"
      :items="operationDetailItems"
      :selected-item-id="operationSelectedItemId"
      :can-add-items="!operationReadOnly && !!operationRecordId"
      @add-item="openOperationItemCreate"
      @close="closeOperationModal"
      @save="saveOperation"
      @select-item="selectOperationItem"
    />

    <OperationLoadingOverlay v-if="operationDetailLoading" />

    <OperationItemModal
      v-if="operationItemModalOpen"
      :title="operationItemModalTitle"
      :mode="operationItemModalMode"
      :form="operationItemForm"
      :read-only="operationReadOnly"
      :base-options="operationItemBaseOptions"
      @close="closeOperationItemModal"
      @delete="removeOperationItem"
      @normalize-duration="normalizeOperationItemDuration"
      @normalize-offset="normalizeOperationItemOffset"
      @save="saveOperationItem"
      @sync-metadata-open="syncOperationItemMetadataOpen"
    />

    <ConfirmationDialog
      v-if="confirmation"
      :title="confirmation.title"
      :message="confirmation.message"
      :detail="confirmation.detail"
      :confirm-label="confirmation.confirmLabel"
      @cancel="cancelConfirmation"
      @confirm="confirmConfirmation"
    />
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
import ArrangementModal from "../components/admin/ArrangementModal.vue";
import ConfirmationDialog from "../components/admin/ConfirmationDialog.vue";
import HolidayImportModal from "../components/admin/HolidayImportModal.vue";
import HolidayManager from "../components/admin/HolidayManager.vue";
import LeaveManager from "../components/admin/LeaveManager.vue";
import OperationItemModal from "../components/admin/OperationItemModal.vue";
import OperationLoadingOverlay from "../components/admin/OperationLoadingOverlay.vue";
import OperationManager from "../components/admin/OperationManager.vue";
import OperationPlanModal from "../components/admin/OperationPlanModal.vue";
import OtherManager from "../components/admin/OtherManager.vue";
import PatrolManager from "../components/admin/PatrolManager.vue";
import PermitManager from "../components/admin/PermitManager.vue";
import { useAdminViewModel } from "../composables/admin/useAdminViewModel";

const {
  sections, today, yesterday, activeKey, selectedDate, statusText, activeSection,
  permitRows, patrolRows, otherRows, leaveRows, operationRows, operationShowAll,
  holidayYear, holidayRows, adjustedWorkdayRows, holidayImportModalOpen, holidayImportForm,
  modalKind, modalTitle, modalForm, operationModalOpen, operationModalMode, operationRecordId,
  operationForm, operationReadOnly, operationModalTitle, operationDurationMinutes, operationHasEndAt,
  operationDerivedRecurrenceIntervalMinutes, operationDerivedRecurrenceCount, operationComputedEndAt,
  operationDetailItems, operationSelectedItemId, operationDetailLoading, operationItemModalOpen,
  operationItemModalMode, operationItemModalTitle, operationItemForm, operationItemBaseOptions,
  confirmation, jumpToToday, jumpToYesterday, openPermitModal, openPatrolModal, openOtherModal,
  openLeaveModal, openOperationModal, selectOperationItem, openOperationItemCreate, closeModal,
  openHolidayImportModal, closeHolidayImportModal, selectHolidayImportFile, closeOperationModal,
  closeOperationItemModal, saveModal, togglePermit, togglePatrol, toggleOther, toggleOperation,
  confirmConfirmation, cancelConfirmation, removePermit, removePatrol, removeOther, removeLeave,
  removeOperation, saveOperation, saveOperationItem, removeOperationItem, submitHolidayImport,
  normalizeOperationItemOffset, normalizeOperationItemDuration, syncOperationItemMetadataOpen
} = useAdminViewModel();
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

.board-link {
  border: 1px solid #1e293b;
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  text-decoration: none;
  background: #1e293b;
  color: #fff;
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

@media (max-width: 900px) {
  .admin-page {
    padding: 18px;
  }

  .admin-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .admin-layout {
    grid-template-columns: 1fr;
  }

  .admin-toolbar {
    align-items: flex-start;
    flex-direction: column;
    padding: 12px 16px;
  }
}
</style>
