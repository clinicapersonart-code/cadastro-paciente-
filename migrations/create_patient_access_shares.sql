-- Compartilhamento limitado de pacientes por profissional.
-- Permite casos como neuropsicóloga externa anexar laudo sem acessar prontuário.

create table if not exists public.patient_access (
  id text primary key,
  patient_id text not null,
  user_id text not null,
  access_level text not null check (access_level in ('full', 'documents_only', 'upload_report_only')),
  active boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_patient_access_patient_id on public.patient_access(patient_id);
create index if not exists idx_patient_access_user_id on public.patient_access(user_id);
create index if not exists idx_patient_access_active on public.patient_access(active);
create unique index if not exists idx_patient_access_one_active_per_patient_user
  on public.patient_access(patient_id, user_id)
  where active = true;

alter table public.patient_access enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'patient_access'
      and policyname = 'patient_access_read_all'
  ) then
    create policy "patient_access_read_all"
      on public.patient_access for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'patient_access'
      and policyname = 'patient_access_insert_all'
  ) then
    create policy "patient_access_insert_all"
      on public.patient_access for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'patient_access'
      and policyname = 'patient_access_update_all'
  ) then
    create policy "patient_access_update_all"
      on public.patient_access for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end $$;
