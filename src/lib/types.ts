// ── Tipos compartilhados da aplicação Auri ────────────────────────────────────

export interface UserProfile {
  id: string;
  userId: string;
  doctorId: string;
  role: 'medico' | 'secretaria';
  fullName: string;
  email: string;
  active: boolean;
}
