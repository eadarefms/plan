export type Role = 'ADMIN' | 'REGIONAL' | 'PROVINCIAL';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  directorateId: string | null;
}

export interface Directorate { id: string; name: string; code: string; }
export interface AcademicYear { id: string; label: string; startYear: number; isActive: boolean; }

export type ActionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'LATE' | 'STOPPED';

export interface ActionItem {
  id: string;
  number: number;
  title: string;
  directorateId: string;
  directorateName?: string;
  academicYearId: string;
  academicYearLabel?: string;
  coordinatorName: string | null;
  startDate: string | null;
  endDate: string | null;
  indicator: string | null;
  currentValue: number | null;
  targetValue: number | null;
  achievedValue: number | null;
  isPercentage: boolean;
  completionRate: number | null;
  status: ActionStatus;
  statusLabel: string;
  isCompleted: boolean;
  completedAt: string | null;
  updatedAt: string;
}

export const STATUS_COLORS: Record<ActionStatus, string> = {
  DONE: '#16a34a',
  IN_PROGRESS: '#2563eb',
  LATE: '#dc2626',
  NOT_STARTED: '#6b7280',
  STOPPED: '#a855f7',
};
