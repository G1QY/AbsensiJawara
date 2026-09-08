import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/apiClient';
import { useAuth } from '../../lib/AuthContext';

export interface WorkflowState {
  event_id: string;
  data: Record<string, any>;
  current_step: number;
  max_reached: number;
  updated_at: string | null;
}

export interface CrewEventAssignment {
  id: string;
  position: string | null;
  status: 'ACTIVE' | 'ENDED';
  event: {
    id: string;
    event_code: string;
    event_name: string;
    client_name: string | null;
    start_time?:string|null;end_time?:string|null;pic_crew_id?:string|null;
    event_date: string;
    status: 'DRAFT' | 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
    branch?: { name: string } | null;
    event_locations?: Array<{ address: string | null }>;
    pic?: { user?: { full_name: string } | null } | null;
  };
  event_schedules: Array<{ id: string; schedule_date: string; start_time: string; end_time: string; status: string; overtime_preapproved?: boolean }>;
  workflow: WorkflowState;
  team: string[];
  members?:Array<{id:string;crew_id:string;name:string;position:string|null;status:string}>;
  attendance: Array<{ id: string; attendance_date: string; check_in: string | null; check_out: string | null; check_in_photo_url?: string | null; check_out_photo_url?: string | null; status: string; review_status: string; late_minutes: number; overtime_minutes: number; overtime_status: string }>;
}

export interface CrewEventWorkspaceData {
  crew: { id: string; employee_code: string; base_salary: number; user?: { full_name: string } | null };
  assignments: CrewEventAssignment[];
}

export function useCrewEventWorkspace() {
  const { auth } = useAuth();
  const [data, setData] = useState<CrewEventWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback((showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    api.get<CrewEventWorkspaceData>('/crew-event/workspace')
      .then(setData)
      .catch(error => setError(error instanceof ApiError ? error.message : 'Data Crew Event tidak dapat dimuat.'))
      .finally(() => setLoading(false));
  }, [auth?.user.id]);
  useEffect(() => {
    load(true);
    const timer = window.setInterval(() => load(false), 15000);
    const refresh = () => load(false);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);
  return { data, loading, error, reload: () => load(false) };
}

export const eventAddress = (row: CrewEventAssignment) => row.event.event_locations?.[0]?.address || row.event.branch?.name || 'Lokasi belum diisi';
export const eventSchedule = (row: CrewEventAssignment) => row.event_schedules.find(s => s.status === 'ACTIVE') || row.event_schedules[0];
export const eventIsFinished = (row: CrewEventAssignment) => row.status === 'ENDED' || row.workflow.max_reached >= 15 || row.attendance.some(item => Boolean(item.check_out)) || ['COMPLETED', 'CANCELLED'].includes(row.event.status);
export const eventEffectiveStatus = (row: CrewEventAssignment) => row.event.status;
export const idDate = (value: string) => new Date(`${value}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
export const idClock = (value: string | null) => value ? new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta' }) : '—';
export const rupiah = (value: number) => `Rp${Math.round(value || 0).toLocaleString('id-ID')}`;
