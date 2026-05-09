-- Upload de templates por curso (frente do certificado e carta de recomendação)
-- e bucket público para servir as imagens.

alter table courses
  add column if not exists certificate_template_url   text,
  add column if not exists recommendation_template_url text;

comment on column courses.certificate_template_url   is 'URL pública (Storage) do PNG/JPG da frente do certificado deste curso. Quando preenchido, sobrescreve o template global.';
comment on column courses.recommendation_template_url is 'URL pública (Storage) do PNG/JPG da carta de recomendação deste curso.';

-- Bucket de assets dos cursos (logos, banners, templates de certificado/carta)
insert into storage.buckets (id, name, public)
values ('course-assets', 'course-assets', true)
on conflict (id) do nothing;

-- Leitura pública (tudo neste bucket é servido pela URL pública)
drop policy if exists "course-assets public read" on storage.objects;
create policy "course-assets public read"
  on storage.objects for select
  using (bucket_id = 'course-assets');

-- Apenas staff (admin/support) pode subir/editar/excluir.
drop policy if exists "course-assets staff write" on storage.objects;
create policy "course-assets staff write"
  on storage.objects for insert
  with check (bucket_id = 'course-assets' and is_staff());

drop policy if exists "course-assets staff update" on storage.objects;
create policy "course-assets staff update"
  on storage.objects for update
  using (bucket_id = 'course-assets' and is_staff())
  with check (bucket_id = 'course-assets' and is_staff());

drop policy if exists "course-assets staff delete" on storage.objects;
create policy "course-assets staff delete"
  on storage.objects for delete
  using (bucket_id = 'course-assets' and is_staff());
