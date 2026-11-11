-- US-151: capturas opcionales en los reportes de problemas y sugerencias.
-- Bucket PRIVADO: cada persona sube y lee solo dentro de su carpeta <user_id>/...; el equipo las ve
-- desde el dashboard (service_role). Sin borrado ni edición desde la app: el reporte es inmutable.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-screenshots', 'support-screenshots', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy support_screenshots_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'support-screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy support_screenshots_select_own on storage.objects for select to authenticated
  using (bucket_id = 'support-screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- La ruta de la captura de un reporte siempre está en la carpeta de quien lo envía.
alter table public.support_tickets
  add constraint support_tickets_screenshot_own_folder
  check (screenshot_path is null or screenshot_path like user_id::text || '/%');
