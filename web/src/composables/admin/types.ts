import type { ComputedRef, Ref } from "vue";

export type SectionKey = "operation" | "permit" | "patrol" | "other" | "leave" | "holiday";
export type RecurrenceType = "once" | "finite" | "infinite";
export type ModalKind = "permit" | "other" | "leave";
export type OperationModalMode = "create" | "edit" | "detail";
export type OperationItemModalMode = "create" | "edit";
export type HolidayImportSource = "remote" | "local";

export interface AdminSection {
  key: SectionKey;
  label: string;
  description: string;
}

export interface ConfirmationRequest {
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
}

export type ConfirmationState = ConfirmationRequest & {
  resolve: (confirmed: boolean) => void;
};

export type RequestConfirmation = (request: ConfirmationRequest) => Promise<boolean>;
export type WithStatus = (action: () => Promise<void>) => Promise<void>;
export type RefreshAdminList = () => Promise<void>;

export interface ArrangementAdminContext {
  activeSection: ComputedRef<AdminSection>;
  selectedDate: Ref<string>;
  today: string;
  withStatus: WithStatus;
  refresh: RefreshAdminList;
  requestConfirmation: RequestConfirmation;
}

export interface OperationAdminContext {
  selectedDate: Ref<string>;
  today: string;
  withStatus: WithStatus;
  refresh: RefreshAdminList;
  requestConfirmation: RequestConfirmation;
}

export interface HolidayAdminContext {
  today: string;
  statusText: Ref<string>;
  refresh: RefreshAdminList;
  requestConfirmation: RequestConfirmation;
}

export interface TaskInstanceAdminContext {
  selectedDate: Ref<string>;
  today: string;
  withStatus: WithStatus;
  refresh: RefreshAdminList;
  requestConfirmation: RequestConfirmation;
}

export interface PatrolPlanAdminContext {
  withStatus: WithStatus;
  refresh: RefreshAdminList;
  requestConfirmation: RequestConfirmation;
}
