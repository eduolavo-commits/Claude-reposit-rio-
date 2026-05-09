-- AGS.CLICK Member Area — initial schema + RLS
-- Apply with: supabase db push  (or paste in the SQL editor)

create extension if not exists "pgcrypto";

-- =========================================================================
-- ENUMS
-- =========================================================================
do $$ begin
  create type user_role        as enum ('student','support','admin');
  create type course_status    as enum ('draft','published');
  create type access_type      as enum ('free','paid');
  create type enrollment_src   as enum ('hotmart','kiwify','eduzz','cademi','manual','admin');
  create type enrollment_st    as enum ('active','revoked');
  create type comment_status   as enum ('open','answered');
  create type certificate_type as enum ('certificate','recommendation');
exception when duplicate_object then null; end $$;

-- =========================================================================
-- TABLES
-- =========================================================================
create table if not exists profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  cpf         text,
  phone       text,
  avatar_url  text,
  role        user_role not null default 'student',
  created_at  timestamptz not null default now()
);

create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  sort_order  int  not null default 0
);

create table if not exists courses (
  id                              uuid primary key default gen_random_uuid(),
  slug                            text not null unique,
  title                           text not null,
  subtitle                        text,
  description_md                  text,
  thumbnail_url                   text,
  banner_url                      text,
  category_id                     uuid references categories(id) on delete set null,
  access_type                     access_type not null default 'paid',
  sales_url                       text,
  whatsapp_url                    text,
  syllabus_md                     text,
  signature_name                  text not null default 'Eduardo Olavo',
  signature_role                  text not null default 'Diretor Geral',
  signature_image_url             text,
  secondary_signature_name        text,
  secondary_signature_role        text,
  secondary_signature_image_url   text,
  status                          course_status not null default 'draft',
  is_featured                     boolean not null default false,
  sort_order                      int not null default 0,
  created_at                      timestamptz not null default now()
);
create index if not exists idx_courses_category on courses(category_id);
create index if not exists idx_courses_status   on courses(status);

create table if not exists modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references courses(id) on delete cascade,
  title       text not null,
  sort_order  int not null default 0
);
create index if not exists idx_modules_course on modules(course_id);

create table if not exists lessons (
  id               uuid primary key default gen_random_uuid(),
  module_id        uuid not null references modules(id) on delete cascade,
  title            text not null,
  panda_video_id   text,
  duration_seconds int not null default 0,
  materials_url    text,
  sort_order       int not null default 0
);
create index if not exists idx_lessons_module on lessons(module_id);

create table if not exists enrollments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  course_id          uuid not null references courses(id)    on delete cascade,
  granted_at         timestamptz not null default now(),
  expires_at         timestamptz,
  source             enrollment_src not null default 'manual',
  external_order_id  text,
  status             enrollment_st  not null default 'active',
  unique(user_id, course_id)
);
create index if not exists idx_enr_user   on enrollments(user_id);
create index if not exists idx_enr_course on enrollments(course_id);

create table if not exists lesson_progress (
  user_id      uuid not null references auth.users(id) on delete cascade,
  lesson_id    uuid not null references lessons(id)    on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists comments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  lesson_id   uuid not null references lessons(id)    on delete cascade,
  body        text not null,
  parent_id   uuid references comments(id)            on delete cascade,
  status      comment_status not null default 'open',
  answered_by uuid references auth.users(id),
  answered_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_comments_lesson on comments(lesson_id);
create index if not exists idx_comments_user   on comments(user_id);
create index if not exists idx_comments_status on comments(status);

create table if not exists certificates (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  course_id           uuid not null references courses(id)    on delete cascade,
  type                certificate_type not null default 'certificate',
  full_name_snapshot  text not null,
  cpf_snapshot        text not null,
  first_issued_at     timestamptz not null default now(),
  last_issued_at      timestamptz not null default now(),
  code                uuid not null unique default gen_random_uuid(),
  pdf_url             text,
  unique(user_id, course_id, type)
);

create table if not exists webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  raw          jsonb not null,
  processed_at timestamptz,
  error        text,
  created_at   timestamptz not null default now()
);

-- Map a gateway product id to a course in the platform
create table if not exists product_mappings (
  id                   uuid primary key default gen_random_uuid(),
  provider             text not null check (provider in ('hotmart','kiwify','eduzz','cademi')),
  external_product_id  text not null,
  course_id            uuid not null references courses(id) on delete cascade,
  unique(provider, external_product_id)
);
create index if not exists idx_pm_lookup on product_mappings(provider, external_product_id);

-- =========================================================================
-- HELPERS
-- =========================================================================
create or replace function is_staff()
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and role in ('admin','support')
  );
$$;

create or replace function has_course_access(p_course uuid)
returns boolean language sql stable as $$
  select
    is_staff()
    or exists (select 1 from courses where id = p_course and access_type = 'free' and status = 'published')
    or exists (
      select 1 from enrollments
      where user_id = auth.uid() and course_id = p_course and status = 'active'
    );
$$;

-- Auto-create a profile row on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- =========================================================================
-- RLS
-- =========================================================================
alter table profiles        enable row level security;
alter table categories      enable row level security;
alter table courses         enable row level security;
alter table modules         enable row level security;
alter table lessons         enable row level security;
alter table enrollments     enable row level security;
alter table lesson_progress enable row level security;
alter table comments        enable row level security;
alter table certificates    enable row level security;
alter table webhook_events  enable row level security;

-- profiles: each user sees and updates only their row; staff sees all
create policy profiles_self_read on profiles for select
  using (user_id = auth.uid() or is_staff());
create policy profiles_self_update on profiles for update
  using (user_id = auth.uid() or is_staff());

-- categories: public read; staff write
create policy cat_public_read on categories for select using (true);
create policy cat_staff_write on categories for all
  using (is_staff()) with check (is_staff());

-- courses: published readable by anyone (catalog needs locked cards too); staff can write
create policy courses_public_read on courses for select
  using (status = 'published' or is_staff());
create policy courses_staff_write on courses for all
  using (is_staff()) with check (is_staff());

-- modules/lessons: visible only when has access to the parent course
create policy modules_access_read on modules for select
  using (has_course_access(course_id));
create policy modules_staff_write on modules for all
  using (is_staff()) with check (is_staff());

create policy lessons_access_read on lessons for select
  using (has_course_access((select course_id from modules where id = module_id)));
create policy lessons_staff_write on lessons for all
  using (is_staff()) with check (is_staff());

-- enrollments
create policy enr_self_read on enrollments for select
  using (user_id = auth.uid() or is_staff());
create policy enr_staff_write on enrollments for all
  using (is_staff()) with check (is_staff());

-- lesson_progress: user manages their own
create policy lp_self on lesson_progress for all
  using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

-- comments: aluno só vê os próprios + respostas; staff vê tudo
create policy comments_self_read on comments for select
  using (
    is_staff()
    or user_id = auth.uid()
    or parent_id in (select id from comments c2 where c2.user_id = auth.uid())
  );
create policy comments_self_insert on comments for insert
  with check (user_id = auth.uid() or is_staff());
create policy comments_staff_update on comments for update
  using (is_staff()) with check (is_staff());

-- certificates: user sees own; staff sees all
create policy cert_self_read on certificates for select
  using (user_id = auth.uid() or is_staff());
create policy cert_self_write on certificates for all
  using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

-- webhook_events: staff only
create policy wh_staff on webhook_events for all
  using (is_staff()) with check (is_staff());

alter table product_mappings enable row level security;
create policy pm_staff on product_mappings for all
  using (is_staff()) with check (is_staff());

-- =========================================================================
-- SEED (opcional — comente em produção)
-- =========================================================================
insert into categories (name, slug, sort_order) values
  ('Veterinária',         'veterinaria',         10),
  ('Estética e Beleza',   'estetica-beleza',     20),
  ('Marketing Digital',   'marketing-digital',   30),
  ('Administração',       'administracao',       40)
on conflict (slug) do nothing;
