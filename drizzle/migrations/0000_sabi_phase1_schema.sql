-- Sabi Phase 1 schema

create type public.workspace_type as enum ('creative', 'brand');
create type public.project_status as enum ('draft', 'published', 'in_discussion', 'hired', 'in_progress', 'completed', 'cancelled');
create type public.proposal_status as enum ('submitted', 'shortlisted', 'accepted', 'declined', 'withdrawn');

-- profiles: linked to auth users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  active_workspace_id uuid,
  created_at timestamptz not null default now()
);

create or replace function public.sabi_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger sabi_on_auth_user_created
after insert on auth.users
for each row execute function public.sabi_handle_new_user();

-- workspaces: one row per creative profile or brand profile
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  type public.workspace_type not null,
  name text not null,
  slug text not null unique,
  tagline text,
  description text,
  industry text,
  location text,
  website_url text,
  logo_url text,
  cover_url text,
  avatar_url text,
  skills text[] not null default '{}',
  services text[] not null default '{}',
  starting_price numeric,
  currency text not null default 'NGN',
  availability text not null default 'Available now',
  verified boolean not null default false,
  published boolean not null default true,
  rating numeric(3,2) not null default 0,
  reviews_count integer not null default 0,
  open_to_projects boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspaces_type_published_idx on public.workspaces (type, published);
create index workspaces_owner_idx on public.workspaces (owner_id);
create index workspaces_industry_idx on public.workspaces (industry);

-- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  brand_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  category text not null,
  description text not null default '',
  deliverables text[] not null default '{}',
  budget_type text not null default 'range' check (budget_type in ('fixed', 'range')),
  budget_min numeric,
  budget_max numeric,
  currency text not null default 'NGN',
  deadline date,
  location text,
  is_remote boolean not null default false,
  skills text[] not null default '{}',
  status public.project_status not null default 'draft',
  image_url text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_brand_idx on public.projects (brand_workspace_id);
create index projects_status_created_idx on public.projects (status, created_at);

-- proposals
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  creative_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  price numeric not null,
  delivery_time text,
  approach text not null default '',
  portfolio_links text[] not null default '{}',
  status public.proposal_status not null default 'submitted',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, creative_workspace_id)
);

create index proposals_project_idx on public.proposals (project_id);
create index proposals_creative_idx on public.proposals (creative_workspace_id);

-- saved projects
create table public.saved_projects (
  id uuid primary key default gen_random_uuid(),
  creative_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (creative_workspace_id, project_id)
);

-- ============ GRANTS ============
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

grant select on public.workspaces to anon;
grant select, insert, update, delete on public.workspaces to authenticated;
grant all on public.workspaces to service_role;

grant select on public.projects to anon;
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;

grant select, insert, update, delete on public.proposals to authenticated;
grant all on public.proposals to service_role;

grant select, insert, delete on public.saved_projects to authenticated;
grant all on public.saved_projects to service_role;

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
alter table public.proposals enable row level security;
alter table public.saved_projects enable row level security;

create policy "Users read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Published workspaces are public, owners see their own"
  on public.workspaces for select
  to anon, authenticated
  using (published = true or owner_id = auth.uid());

create policy "Users create own workspaces"
  on public.workspaces for insert to authenticated
  with check (owner_id = auth.uid());

create policy "Owners update their workspaces"
  on public.workspaces for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners delete their workspaces"
  on public.workspaces for delete to authenticated
  using (owner_id = auth.uid());

create policy "Published projects are public, owners see drafts"
  on public.projects for select
  to anon, authenticated
  using (
    status <> 'draft'
    or exists (
      select 1 from public.workspaces w
      where w.id = brand_workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "Brand owners create projects"
  on public.projects for insert to authenticated
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = brand_workspace_id and w.owner_id = auth.uid() and w.type = 'brand'
    )
  );

create policy "Brand owners update their projects"
  on public.projects for update to authenticated
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = brand_workspace_id and w.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = brand_workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "Brand owners delete their projects"
  on public.projects for delete to authenticated
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = brand_workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "Parties read proposals"
  on public.proposals for select to authenticated
  using (
    exists (
      select 1 from public.workspaces cw
      where cw.id = creative_workspace_id and cw.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.projects p
      join public.workspaces bw on bw.id = p.brand_workspace_id
      where p.id = project_id and bw.owner_id = auth.uid()
    )
  );

create policy "Creatives submit proposals"
  on public.proposals for insert to authenticated
  with check (
    exists (
      select 1 from public.workspaces cw
      where cw.id = creative_workspace_id and cw.owner_id = auth.uid() and cw.type = 'creative'
    )
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.status in ('published', 'in_discussion')
    )
  );

create policy "Parties update proposals"
  on public.proposals for update to authenticated
  using (
    exists (
      select 1 from public.workspaces cw
      where cw.id = creative_workspace_id and cw.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.projects p
      join public.workspaces bw on bw.id = p.brand_workspace_id
      where p.id = project_id and bw.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workspaces cw
      where cw.id = creative_workspace_id and cw.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.projects p
      join public.workspaces bw on bw.id = p.brand_workspace_id
      where p.id = project_id and bw.owner_id = auth.uid()
    )
  );

create policy "Creatives withdraw proposals"
  on public.proposals for delete to authenticated
  using (
    exists (
      select 1 from public.workspaces cw
      where cw.id = creative_workspace_id and cw.owner_id = auth.uid()
    )
  );

create policy "Creatives read own saved projects"
  on public.saved_projects for select to authenticated
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = creative_workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "Creatives save projects"
  on public.saved_projects for insert to authenticated
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = creative_workspace_id and w.owner_id = auth.uid() and w.type = 'creative'
    )
  );

create policy "Creatives unsave projects"
  on public.saved_projects for delete to authenticated
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = creative_workspace_id and w.owner_id = auth.uid()
    )
  );

