-- Vínculo — Schema Supabase
-- Cole e execute no SQL Editor do projeto

-- ── Perfis dos médicos ────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  crm text,
  specialty text default 'Pediatria',
  phone text default '',
  clinic_name text default '',
  clinic_phone text default '',
  clinic_email text default '',
  clinic_address text default '',
  clinic_hours_start text default '08:00',
  clinic_hours_end text default '18:00',
  created_at timestamptz default now()
);

-- Run this if the table already exists:
alter table public.profiles add column if not exists phone text default '';
alter table public.profiles add column if not exists clinic_name text default '';
alter table public.profiles add column if not exists clinic_phone text default '';
alter table public.profiles add column if not exists clinic_email text default '';
alter table public.profiles add column if not exists clinic_address text default '';
alter table public.profiles add column if not exists clinic_hours_start text default '08:00';
alter table public.profiles add column if not exists clinic_hours_end text default '18:00';

-- ── Pacientes ─────────────────────────────────────────────────────────────────
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid references public.profiles(id) on delete cascade not null,
  full_name text not null,
  birth_date date not null,
  gender char(1) check (gender in ('M','F')) not null,
  blood_type text,
  delivery_type text default '',
  gestational_age_weeks int,
  birth_weight_g int,
  notes text default '',
  insurance_plan text,
  insurance_card_number text,
  is_active boolean default true,
  next_return date,
  created_at timestamptz default now()
);

-- ── Responsáveis ──────────────────────────────────────────────────────────────
create table if not exists public.patient_guardians (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade not null,
  name text not null,
  relationship text default 'Responsável',
  phone text,
  email text,
  is_primary boolean default false
);

-- ── Consultas ─────────────────────────────────────────────────────────────────
create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade not null,
  doctor_id uuid references public.profiles(id) not null,
  scheduled_at timestamptz default now(),
  status text default 'completed',
  type text check (type in ('retorno','primeira vez')) default 'retorno',
  duration_minutes int default 0,
  chief_complaint text default '',
  diagnosis text default '',
  plan text default '',
  prescription text default '',
  anamnesis text default '',
  physical_exam text default '',
  sum_queixa_principal text,
  sum_hda text,
  sum_exame_fisico text,
  sum_hipoteses text[],
  sum_conduta text,
  sum_retorno text,
  sum_peso text,
  sum_altura text,
  sum_perimetro_cefalico text,
  sum_vacinas_mencionadas text[],
  created_at timestamptz default now()
);

-- ── Crescimento ───────────────────────────────────────────────────────────────
create table if not exists public.growth_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade not null,
  month_age int not null,
  weight_kg numeric(5,2),
  height_cm numeric(5,1),
  head_circumference_cm numeric(4,1),
  created_at timestamptz default now()
);

-- ── Vacinas ───────────────────────────────────────────────────────────────────
create table if not exists public.patient_vaccines (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade not null,
  name text not null,
  dose text,
  applied_at date,
  status text check (status in ('done','pending','overdue')) default 'pending',
  age_label text,
  created_at timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.patients          enable row level security;
alter table public.patient_guardians enable row level security;
alter table public.consultations     enable row level security;
alter table public.growth_records    enable row level security;
alter table public.patient_vaccines  enable row level security;

create policy "own_profile"       on public.profiles          for all using (auth.uid() = id);
create policy "own_patients"      on public.patients          for all using (auth.uid() = doctor_id);
create policy "own_guardians"     on public.patient_guardians for all using (
  patient_id in (select id from public.patients where doctor_id = auth.uid())
);
create policy "own_consultations" on public.consultations     for all using (auth.uid() = doctor_id);
create policy "own_growth"        on public.growth_records    for all using (
  patient_id in (select id from public.patients where doctor_id = auth.uid())
);
create policy "own_vaccines"      on public.patient_vaccines  for all using (
  patient_id in (select id from public.patients where doctor_id = auth.uid())
);

-- ── Trigger: cria perfil ao cadastrar médico ──────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
