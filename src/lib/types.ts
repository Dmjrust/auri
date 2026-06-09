// ── Tipos compartilhados da aplicação Auri ─────────────────────────────────

import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { ComponentType } from 'react';

// ── Re-export do tipo User do Supabase para uso nos componentes ───────────────
export type { SupabaseUser as User };

// ── Tipo para componentes de ícone (Phosphor Icons) ──────────────────────────
export type IconComponent = ComponentType<{
  size?: number;
  color?: string;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  className?: string;
}>;

// ── Perfil de usuário (user_profiles table) ───────────────────────────────────
export interface UserProfile {
  id: string;
  userId: string;
  doctorId: string;
  role: 'medico' | 'secretaria' | 'admin';
  fullName: string;
  email: string;
  active: boolean;
}

// ── Agendamento (appointments table) ─────────────────────────────────────────
export interface AppointmentRow {
  id: string;
  doctor_id: string;
  patient_id: string;
  /** Data no formato YYYY-MM-DD */
  date: string;
  /** Horário no formato HH:mm */
  time: string;
  type: 'retorno' | 'primeira vez';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  chief_complaint: string;
  notes: string | null;
  created_at: string;
  // Campos joinados (opcionais — presentes quando a query faz join com patients)
  patient_name?: string;
  patient_birth_date?: string;
  guardian_name?: string;
}

// ── Métricas do Dashboard ─────────────────────────────────────────────────────
export interface DashboardStats {
  todayTotal: number;
  todayCompleted: number;
  todayRemaining: number;
  totalPatients: number;
  totalConsultations: number;
  overdueReturns: number;
  overdueVaccines: number;
}
