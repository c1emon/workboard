import type { ComputedRef, Ref } from "vue";
import type { TimeTag } from "../../api/types";

export type SectionKey = "operation" | "permit" | "patrol" | "other" | "leave" | "holiday";
export type RecurrenceType = "once" | "finite" | "infinite";
export type ModalKind = "permit" | "patrol" | "other" | "leave";
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

export interface ArrangementForm {
  date: string;
  timeTag: TimeTag;
  primary: string;
  personnel: string;
  secondary: string;
  other: string;
}

export interface ArrangementAdminContext {
  activeSection: ComputedRef<AdminSection>;
  selectedDate: Ref<string>;
  today: string;
  withStatus: WithStatus;
  refresh: RefreshAdminList;
  requestConfirmation: RequestConfirmation;
}

export interface OperationPlanForm {
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  recurrenceType: RecurrenceType;
  recurrenceIntervalMinutes: number;
  recurrenceCount: number;
  skipWeekends: boolean;
  skipHolidays: boolean;
}

export interface OperationItemForm {
  id: string;
  baseItemId: string;
  offsetHours: number;
  offsetMinutes: number;
  durationHours: number;
  durationMinutes: number;
  content: string;
  metadataJson: string;
  metadataExpanded: boolean;
  sortOrder: number;
}

export interface OperationAdminContext {
  selectedDate: Ref<string>;
  today: string;
  withStatus: WithStatus;
  refresh: RefreshAdminList;
  requestConfirmation: RequestConfirmation;
}

export interface HolidayImportForm {
  source: HolidayImportSource;
  url: string;
}

export interface HolidayAdminContext {
  today: string;
  statusText: Ref<string>;
  refresh: RefreshAdminList;
  requestConfirmation: RequestConfirmation;
}
