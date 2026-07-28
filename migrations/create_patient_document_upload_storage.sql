-- Storage privado para anexos de documentos dos pacientes.
-- Aceita PDF, DOC, DOCX e imagens. Limite: 20 MB.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-documents',
  'patient-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'patient_documents_storage_select'
  ) then
    create policy "patient_documents_storage_select"
      on storage.objects for select
      to anon, authenticated
      using (bucket_id = 'patient-documents');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'patient_documents_storage_insert'
  ) then
    create policy "patient_documents_storage_insert"
      on storage.objects for insert
      to anon, authenticated
      with check (bucket_id = 'patient-documents');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'patient_documents_storage_delete'
  ) then
    create policy "patient_documents_storage_delete"
      on storage.objects for delete
      to anon, authenticated
      using (bucket_id = 'patient-documents');
  end if;
end $$;
