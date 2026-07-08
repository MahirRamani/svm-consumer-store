// ─── Shared types used across student management tabs ─────────────────────

export interface StudentRow {
  _id: string;
  rollNumber: number;
  name: string;
  standard: number;
  year: string;
  id?: number | null;
}

export interface YearConfigEntry {
  _id: string;
  currentYear: string;
  yearStartDate: string;
  yearEndDate: string;
  isActive: boolean;
}

export interface YearConfigResponse {
  activeYear: YearConfigEntry | null;
  history: YearConfigEntry[];
}

// ── Assign IDs tab ──────────────────────────────────────────────────────────

export type IdRowStatus = "idle" | "editing" | "saving" | "saved" | "error";

export interface IdRowState {
  value: string; // always a string — bound directly to an <Input>
  status: IdRowStatus;
  error?: string;
  originalId?: number; // matches StudentRow.id's numeric type
}

// ── Assign Rolls tab ────────────────────────────────────────────────────────

export type RollsPhase = "edit" | "preview" | "done";

export interface YearRow {
  newRollNumber: string;
  newStandard: string;
}

export interface YearRowErrors {
  newRollNumber?: string;
  newStandard?: string;
}

export interface ExcelStatus {
  matched: number;
  unmatched: number;
  unmatchedIds: string[];
  error?: string;
}

export interface AssignReport {
  rollChanged: { name: string; from: string; to: string }[];
  stdChanged: { name: string; rollNumber: string; from: string; to: string }[];
  yearMoved: { name: string; rollNumber: string; fromYear: string }[];
  activated: { name: string; rollNumber: string }[];
  unchanged: { name: string; rollNumber: string }[];
}

// ── Year Config tab ─────────────────────────────────────────────────────────

export interface YearConfigForm {
  currentYear: string;
  yearStartDate: string;
  yearEndDate: string;
}

export type YearConfigErrors = Partial<YearConfigForm>;

// ── Add Students tab ────────────────────────────────────────────────────────

export type AddPhase = "edit" | "preview" | "done";

export interface AddRow {
  _key: string;
  id: string;
  rollNumber: string;
  name: string;
  standard: string;
}

export interface AddRowErrors {
  id?: string;
  rollNumber?: string;
  name?: string;
  standard?: string;
}