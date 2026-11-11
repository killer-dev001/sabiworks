-- Sabi Phase 2 (part 2): working marketplace.
--   * contracts, messages, deliverables, reviews, notifications, payments, reports,
--     portfolio items, project activity, admin roles
--   * column-level grants so clients can never write protected fields
--   * every state change (shortlist, hire, status, review, payment) goes through
--     SECURITY DEFINER functions that check who the caller is
--   * rate limits, input constraints, storage buckets and storage policies
--
-- NOTE: payments here are a provider-independent ledger. No provider (EmbassyCard
-- included) is assumed to support escrow, split payments or delayed settlement, and
-- no card data is stored anywhere. The "manual" provider records payments the two
-- parties arrange themselves.

-- Several SQL-language helpers reference tables created further down this file.
set check_function_bodies = off;

-- ============================================================
-- Helpers
-- ============================================================

create or replace function public.sabi_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.safe_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
create policy "Users read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid());

create or replace function public.has_role(_user uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user and role = _role);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.has_role(auth.uid(), 'admin');
$$;

create or replace function public.owns_workspace(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.workspaces w where w.id = ws and w.owner_id = auth.uid()
  );
$$;

create or replace function public.owns_project_brand(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.projects p join public.workspaces w on w.id = p.brand_workspace_id
    where p.id = pid and w.owner_id = auth.uid()
  );
$$;

create or replace function public.is_project_party(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.project_contracts c
    join public.workspaces bw on bw.id = c.brand_workspace_id
    join public.workspaces cw on cw.id = c.creative_workspace_id
    where c.project_id = pid and (bw.owner_id = auth.uid() or cw.owner_id = auth.uid())
  );
$$;

-- Is the caller one of the two sides of the (project, creative) conversation?
create or replace function public.is_conversation_party(pid uuid, creative_ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.proposals pr
    join public.projects p on p.id = pr.project_id
    join public.workspaces bw on bw.id = p.brand_workspace_id
    join public.workspaces cw on cw.id = pr.creative_workspace_id
    where pr.project_id = pid and pr.creative_workspace_id = creative_ws
      and (bw.owner_id = auth.uid() or cw.owner_id = auth.uid())
  );
$$;

-- Creates an in-app notification. Never callable by clients.
create or replace function public.notify(
  p_user uuid, p_type text, p_title text, p_body text, p_link text, p_ref uuid default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then
    return; -- demo content has no real owner
  end if;
  insert into public.notifications (user_id, type, title, body, link, reference_id)
  values (p_user, p_type, left(p_title, 140), left(coalesce(p_body, ''), 280), p_link, p_ref);
end;
$$;

-- ============================================================
-- workspaces: protect trust fields, add suspension, validation
-- ============================================================

alter table public.workspaces
  add column suspended boolean not null default false,
  add constraint workspaces_name_len check (char_length(btrim(name)) between 2 and 80),
  add constraint workspaces_slug_fmt check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  add constraint workspaces_tagline_len check (tagline is null or char_length(tagline) <= 200),
  add constraint workspaces_desc_len check (description is null or char_length(description) <= 3000),
  add constraint workspaces_price_ok check (starting_price is null or (starting_price >= 0 and starting_price <= 1000000000)),
  add constraint workspaces_skills_len check (coalesce(array_length(skills, 1), 0) <= 20 and coalesce(array_length(services, 1), 0) <= 20);

revoke insert, update, delete on public.workspaces from authenticated;
grant insert (id, owner_id, type, name, slug, tagline, description, industry, location, website_url,
              logo_url, cover_url, avatar_url, skills, services, starting_price, availability)
  on public.workspaces to authenticated;
grant update (name, tagline, description, industry, location, website_url, logo_url, cover_url,
              avatar_url, skills, services, starting_price, availability, published,
              open_to_projects, updated_at)
  on public.workspaces to authenticated;

drop policy "Published workspaces are public, owners see their own" on public.workspaces;
drop policy "Owners delete their workspaces" on public.workspaces;
create policy "Visible workspaces" on public.workspaces for select to anon, authenticated
  using ((published = true and suspended = false) or owner_id = auth.uid() or public.is_admin());

create or replace function public.sabi_workspace_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.workspaces where owner_id = new.owner_id) >= 5 then
      raise exception 'You can have at most 5 workspaces.';
    end if;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;
create trigger workspaces_guard before insert or update on public.workspaces
  for each row execute function public.sabi_workspace_guard();

-- ============================================================
-- projects: lifecycle columns, constraints, locked-down writes
-- ============================================================

alter table public.projects
  add column proposal_deadline date,
  add column preferred_experience text,
  add column attachments text[] not null default '{}',
  add column hired_creative_workspace_id uuid references public.workspaces(id),
  add column hired_at timestamptz,
  add column completed_at timestamptz,
  add constraint projects_title_len check (char_length(btrim(title)) between 3 and 140),
  add constraint projects_desc_len check (char_length(description) <= 6000),
  add constraint projects_budget_ok check (
    (budget_min is null or budget_min >= 0) and (budget_max is null or budget_max >= 0)
    and (budget_min is null or budget_max is null or budget_max >= budget_min)
    and coalesce(budget_max, budget_min, 0) <= 1000000000),
  add constraint projects_deliverables_len check (coalesce(array_length(deliverables, 1), 0) <= 25),
  add constraint projects_attachments_len check (coalesce(array_length(attachments, 1), 0) <= 10);

create index projects_category_idx on public.projects (category);
create index projects_hired_idx on public.projects (hired_creative_workspace_id);

revoke insert, update, delete on public.projects from authenticated;
grant insert (id, brand_workspace_id, title, category, description, deliverables, budget_type, budget_min,
              budget_max, currency, deadline, proposal_deadline, location, is_remote, skills, image_url,
              preferred_experience, attachments)
  on public.projects to authenticated;
grant update (title, category, description, deliverables, budget_type, budget_min, budget_max, deadline,
              proposal_deadline, location, is_remote, skills, image_url, preferred_experience,
              attachments, updated_at)
  on public.projects to authenticated;
grant delete on public.projects to authenticated;

drop policy "Published projects are public, owners see drafts" on public.projects;
drop policy "Brand owners update their projects" on public.projects;
drop policy "Brand owners delete their projects" on public.projects;
create policy "Visible projects" on public.projects for select to anon, authenticated
  using (status <> 'draft' or public.owns_workspace(brand_workspace_id) or public.is_admin());
create policy "Brand owners edit open projects" on public.projects for update to authenticated
  using (public.owns_workspace(brand_workspace_id) and status in ('draft', 'published', 'in_discussion'))
  with check (public.owns_workspace(brand_workspace_id));
create policy "Brand owners delete drafts" on public.projects for delete to authenticated
  using (public.owns_workspace(brand_workspace_id) and status = 'draft');

create or replace function public.sabi_project_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.projects
        where brand_workspace_id = new.brand_workspace_id and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'You are creating projects too quickly. Please try again later.';
    end if;
    if new.proposal_deadline is not null and new.deadline is not null and new.proposal_deadline > new.deadline then
      raise exception 'The proposal deadline must be on or before the project deadline.';
    end if;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;
create trigger projects_guard before insert or update on public.projects
  for each row execute function public.sabi_project_guard();

-- ============================================================
-- proposals: richer fields, creatives may only edit pending ones
-- ============================================================

alter table public.proposals
  add column cover_message text not null default '',
  add column milestones text,
  add column updated_at timestamptz not null default now(),
  add constraint proposals_price_ok check (price > 0 and price <= 1000000000),
  add constraint proposals_text_len check (
    char_length(approach) <= 5000 and char_length(cover_message) <= 3000
    and (milestones is null or char_length(milestones) <= 3000)),
  add constraint proposals_links_ok check (coalesce(array_length(portfolio_links, 1), 0) <= 6);

revoke insert, update, delete on public.proposals from authenticated;
grant insert (id, project_id, creative_workspace_id, price, delivery_time, approach, cover_message,
              milestones, portfolio_links)
  on public.proposals to authenticated;
grant update (price, delivery_time, approach, cover_message, milestones, portfolio_links, updated_at)
  on public.proposals to authenticated;

drop policy "Parties read proposals" on public.proposals;
drop policy "Creatives submit proposals" on public.proposals;
drop policy "Parties update proposals" on public.proposals;
drop policy "Creatives withdraw proposals" on public.proposals;

create policy "Parties read proposals" on public.proposals for select to authenticated
  using (public.owns_workspace(creative_workspace_id) or public.owns_project_brand(project_id) or public.is_admin());

create policy "Creatives submit proposals" on public.proposals for insert to authenticated
  with check (
    public.owns_workspace(creative_workspace_id)
    and exists (select 1 from public.workspaces cw where cw.id = creative_workspace_id and cw.type = 'creative' and not cw.suspended)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.status in ('published', 'in_discussion')
        and (p.proposal_deadline is null or p.proposal_deadline >= current_date)
    )
  );

create policy "Creatives edit pending proposals" on public.proposals for update to authenticated
  using (public.owns_workspace(creative_workspace_id) and status = 'submitted')
  with check (public.owns_workspace(creative_workspace_id) and status = 'submitted');

create or replace function public.sabi_proposal_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_brand_owner uuid;
  v_creative_owner uuid;
  v_title text;
  v_brand_ws uuid;
begin
  if tg_op = 'INSERT' then
    select p.title, bw.owner_id, p.brand_workspace_id into v_title, v_brand_owner, v_brand_ws
      from public.projects p join public.workspaces bw on bw.id = p.brand_workspace_id where p.id = new.project_id;
    select owner_id into v_creative_owner from public.workspaces where id = new.creative_workspace_id;
    if v_brand_owner = v_creative_owner then
      raise exception 'You cannot send a proposal to your own project.';
    end if;
    if (select count(*) from public.proposals
        where creative_workspace_id = new.creative_workspace_id and created_at > now() - interval '1 hour') >= 15 then
      raise exception 'You are sending proposals too quickly. Please try again later.';
    end if;
    perform public.notify(v_brand_owner, 'proposal_received', 'New proposal received',
      'A creative sent a proposal for "' || v_title || '".', '/project/' || new.project_id, new.id);
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;
create trigger proposals_guard before insert or update on public.proposals
  for each row execute function public.sabi_proposal_guard();

-- ============================================================
-- Portfolio items
-- ============================================================

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text check (description is null or char_length(description) <= 1000),
  media_url text,
  external_url text,
  created_at timestamptz not null default now(),
  check (media_url is not null or external_url is not null)
);
create index portfolio_items_ws_idx on public.portfolio_items (workspace_id, created_at desc);
alter table public.portfolio_items enable row level security;
grant select on public.portfolio_items to anon;
grant select, insert, update, delete on public.portfolio_items to authenticated;
grant all on public.portfolio_items to service_role;
revoke insert, update on public.portfolio_items from authenticated;
grant insert (id, workspace_id, title, description, media_url, external_url) on public.portfolio_items to authenticated;
grant update (title, description, media_url, external_url) on public.portfolio_items to authenticated;

create policy "Portfolio visible with workspace" on public.portfolio_items for select to anon, authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.published and not w.suspended)
         or public.owns_workspace(workspace_id) or public.is_admin());
create policy "Creatives add portfolio" on public.portfolio_items for insert to authenticated
  with check (public.owns_workspace(workspace_id)
              and exists (select 1 from public.workspaces w where w.id = workspace_id and w.type = 'creative'));
create policy "Owners edit portfolio" on public.portfolio_items for update to authenticated
  using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy "Owners delete portfolio" on public.portfolio_items for delete to authenticated
  using (public.owns_workspace(workspace_id));

create or replace function public.sabi_portfolio_guard()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.portfolio_items where workspace_id = new.workspace_id) >= 24 then
    raise exception 'A portfolio can hold at most 24 items.';
  end if;
  return new;
end;
$$;
create trigger portfolio_guard before insert on public.portfolio_items
  for each row execute function public.sabi_portfolio_guard();

-- ============================================================
-- Contracts (agreed scope / price / deadline) – private to the two parties
-- ============================================================

create table public.project_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete restrict,
  proposal_id uuid not null references public.proposals(id) on delete restrict,
  brand_workspace_id uuid not null references public.workspaces(id) on delete restrict,
  creative_workspace_id uuid not null references public.workspaces(id) on delete restrict,
  agreed_price numeric not null check (agreed_price > 0),
  currency text not null default 'NGN',
  agreed_deadline date,
  scope text not null default '' check (char_length(scope) <= 4000),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);
create index contracts_creative_idx on public.project_contracts (creative_workspace_id);
create index contracts_brand_idx on public.project_contracts (brand_workspace_id);
alter table public.project_contracts enable row level security;
grant select on public.project_contracts to authenticated;
grant all on public.project_contracts to service_role;
create policy "Parties read contracts" on public.project_contracts for select to authenticated
  using (public.owns_workspace(brand_workspace_id) or public.owns_workspace(creative_workspace_id) or public.is_admin());

-- ============================================================
-- Project activity log
-- ============================================================

create table public.project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_user_id uuid,
  type text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index project_events_project_idx on public.project_events (project_id, created_at);
alter table public.project_events enable row level security;
grant select on public.project_events to authenticated;
grant all on public.project_events to service_role;
create policy "Parties read project events" on public.project_events for select to authenticated
  using (public.is_project_party(project_id) or public.is_admin());

create or replace function public.log_event(p_project uuid, p_type text, p_message text)
returns void language sql security definer set search_path = public as $$
  insert into public.project_events (project_id, actor_user_id, type, message)
  values (p_project, auth.uid(), p_type, left(p_message, 300));
$$;

-- ============================================================
-- Messages
-- ============================================================

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  creative_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sender_user_id uuid not null,
  sender_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_thread_idx on public.messages (project_id, creative_workspace_id, created_at);
alter table public.messages enable row level security;
grant select on public.messages to authenticated;
grant all on public.messages to service_role;
create policy "Conversation parties read messages" on public.messages for select to authenticated
  using (public.is_conversation_party(project_id, creative_workspace_id) or public.is_admin());

create table public.conversation_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  creative_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, project_id, creative_workspace_id)
);
alter table public.conversation_reads enable row level security;
grant select on public.conversation_reads to authenticated;
grant all on public.conversation_reads to service_role;
create policy "Users read own conversation state" on public.conversation_reads for select to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- Deliverables
-- ============================================================

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 140),
  note text check (note is null or char_length(note) <= 2000),
  file_path text,
  file_name text,
  external_url text,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'revision_requested')),
  feedback text check (feedback is null or char_length(feedback) <= 2000),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (file_path is not null or external_url is not null)
);
create index deliverables_project_idx on public.deliverables (project_id, submitted_at);
alter table public.deliverables enable row level security;
grant select on public.deliverables to authenticated;
grant all on public.deliverables to service_role;
create policy "Parties read deliverables" on public.deliverables for select to authenticated
  using (public.is_project_party(project_id) or public.is_admin());

-- ============================================================
-- Reviews
-- ============================================================

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  reviewer_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  reviewee_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  communication smallint check (communication between 1 and 5),
  quality smallint check (quality between 1 and 5),
  reliability smallint check (reliability between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  unique (project_id, reviewer_workspace_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_workspace_id, created_at desc);
alter table public.reviews enable row level security;
grant select on public.reviews to anon, authenticated;
grant all on public.reviews to service_role;
create policy "Reviews are public" on public.reviews for select to anon, authenticated using (true);

create or replace function public.sabi_review_aftermath()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.workspaces w set
    rating = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r where r.reviewee_workspace_id = new.reviewee_workspace_id), 0),
    reviews_count = (select count(*) from public.reviews r where r.reviewee_workspace_id = new.reviewee_workspace_id)
  where w.id = new.reviewee_workspace_id;
  perform public.notify((select owner_id from public.workspaces where id = new.reviewee_workspace_id),
    'review_received', 'You received a review', 'A new review was left on one of your projects.',
    '/project/' || new.project_id, new.id);
  return new;
end;
$$;
create trigger reviews_aftermath after insert on public.reviews
  for each row execute function public.sabi_review_aftermath();

-- ============================================================
-- Payments (provider-independent ledger; manual pilot by default)
-- ============================================================

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete restrict,
  contract_id uuid not null references public.project_contracts(id) on delete restrict,
  payer_workspace_id uuid not null references public.workspaces(id) on delete restrict,
  payee_workspace_id uuid not null references public.workspaces(id) on delete restrict,
  amount numeric not null check (amount > 0),
  platform_fee numeric not null default 0 check (platform_fee >= 0),
  currency text not null default 'NGN',
  provider text not null default 'manual',
  provider_reference text,
  status text not null default 'pending'
    check (status in ('pending', 'reported', 'confirmed', 'failed', 'refunded')),
  note text check (note is null or char_length(note) <= 1000),
  reported_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.payments enable row level security;
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
create policy "Parties read payments" on public.payments for select to authenticated
  using (public.owns_workspace(payer_workspace_id) or public.owns_workspace(payee_workspace_id) or public.is_admin());

-- ============================================================
-- Notifications
-- ============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text,
  reference_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
create policy "Users read own notifications" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "Users mark own notifications read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- Reports (moderation)
-- ============================================================

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('workspace', 'project', 'proposal', 'message', 'review')),
  target_id uuid not null,
  reason text not null check (char_length(btrim(reason)) between 3 and 120),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index reports_status_idx on public.reports (status, created_at desc);
alter table public.reports enable row level security;
grant select on public.reports to authenticated;
grant insert (target_type, target_id, reason, details) on public.reports to authenticated;
grant all on public.reports to service_role;
create policy "Reporters and admins read reports" on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy "Signed-in users file reports" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

create or replace function public.sabi_report_guard()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.reports where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'You have filed too many reports today. Please try again tomorrow.';
  end if;
  return new;
end;
$$;
create trigger reports_guard before insert on public.reports
  for each row execute function public.sabi_report_guard();

-- ============================================================
-- Admin read access to profiles
-- ============================================================

create policy "Admins read profiles" on public.profiles for select to authenticated using (public.is_admin());
create policy "Admins read saved projects" on public.saved_projects for select to authenticated using (public.is_admin());

-- ============================================================
-- Workflow functions (the only way to change protected state)
-- ============================================================

-- Shared lookup: project + brand workspace, locked for the transaction.
create or replace function public.sabi_require_user()
returns uuid language plpgsql stable as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in to continue.';
  end if;
  return auth.uid();
end;
$$;

-- ---- proposals -------------------------------------------------

create or replace function public.set_proposal_status(p_proposal_id uuid, p_status public.proposal_status)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_prop public.proposals; v_proj public.projects; v_brand public.workspaces; v_cre public.workspaces;
begin
  perform public.sabi_require_user();
  select * into v_prop from public.proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found.'; end if;
  select * into v_proj from public.projects where id = v_prop.project_id for update;
  select * into v_brand from public.workspaces where id = v_proj.brand_workspace_id;
  if v_brand.owner_id <> auth.uid() then raise exception 'Only the project owner can do that.'; end if;
  if v_proj.status not in ('published', 'in_discussion') then
    raise exception 'This project is no longer accepting changes to proposals.';
  end if;
  if p_status not in ('submitted', 'shortlisted', 'declined') then
    raise exception 'Use the hire action to accept a proposal.';
  end if;
  if v_prop.status not in ('submitted', 'shortlisted', 'declined') then
    raise exception 'This proposal can no longer be changed.';
  end if;
  update public.proposals set status = p_status where id = p_proposal_id;

  -- project is "in discussion" while at least one proposal is shortlisted
  update public.projects set status = case
      when exists (select 1 from public.proposals where project_id = v_proj.id and status = 'shortlisted') then 'in_discussion'::public.project_status
      else 'published'::public.project_status end
    where id = v_proj.id and status in ('published', 'in_discussion');

  select * into v_cre from public.workspaces where id = v_prop.creative_workspace_id;
  if p_status = 'shortlisted' then
    perform public.notify(v_cre.owner_id, 'proposal_shortlisted', 'You were shortlisted',
      v_brand.name || ' shortlisted your proposal for "' || v_proj.title || '".', '/project/' || v_proj.id, v_prop.id);
  elsif p_status = 'declined' then
    perform public.notify(v_cre.owner_id, 'proposal_declined', 'Proposal not selected',
      v_brand.name || ' did not select your proposal for "' || v_proj.title || '".', '/project/' || v_proj.id, v_prop.id);
  end if;
end;
$$;

create or replace function public.withdraw_proposal(p_proposal_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_prop public.proposals;
begin
  perform public.sabi_require_user();
  select * into v_prop from public.proposals where id = p_proposal_id for update;
  if not found or not public.owns_workspace(v_prop.creative_workspace_id) then
    raise exception 'Proposal not found.';
  end if;
  if v_prop.status not in ('submitted', 'shortlisted') then
    raise exception 'Only pending proposals can be withdrawn.';
  end if;
  update public.proposals set status = 'withdrawn' where id = p_proposal_id;
  update public.projects set status = case
      when exists (select 1 from public.proposals where project_id = v_prop.project_id and status = 'shortlisted') then 'in_discussion'::public.project_status
      else 'published'::public.project_status end
    where id = v_prop.project_id and status in ('published', 'in_discussion');
end;
$$;

create or replace function public.resubmit_proposal(p_proposal_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_prop public.proposals; v_proj public.projects;
begin
  perform public.sabi_require_user();
  select * into v_prop from public.proposals where id = p_proposal_id for update;
  if not found or not public.owns_workspace(v_prop.creative_workspace_id) then
    raise exception 'Proposal not found.';
  end if;
  select * into v_proj from public.projects where id = v_prop.project_id;
  if v_prop.status <> 'withdrawn' then raise exception 'Only withdrawn proposals can be re-submitted.'; end if;
  if v_proj.status not in ('published', 'in_discussion')
     or (v_proj.proposal_deadline is not null and v_proj.proposal_deadline < current_date) then
    raise exception 'This project is no longer accepting proposals.';
  end if;
  update public.proposals set status = 'submitted' where id = p_proposal_id;
end;
$$;

-- ---- hiring ----------------------------------------------------

create or replace function public.hire_creative(
  p_proposal_id uuid, p_agreed_price numeric, p_agreed_deadline date, p_scope text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_prop public.proposals; v_proj public.projects; v_brand public.workspaces; v_cre public.workspaces;
  v_contract uuid; r record;
begin
  perform public.sabi_require_user();
  select * into v_prop from public.proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found.'; end if;
  select * into v_proj from public.projects where id = v_prop.project_id for update;
  select * into v_brand from public.workspaces where id = v_proj.brand_workspace_id;
  select * into v_cre from public.workspaces where id = v_prop.creative_workspace_id;
  if v_brand.owner_id <> auth.uid() then raise exception 'Only the project owner can hire.'; end if;
  if v_proj.is_demo then raise exception 'Demo projects cannot be awarded.'; end if;
  if v_proj.status not in ('published', 'in_discussion') then
    raise exception 'This project is not open for hiring.';
  end if;
  if v_prop.status not in ('submitted', 'shortlisted') then
    raise exception 'This proposal can no longer be accepted.';
  end if;
  if p_agreed_price is null or p_agreed_price <= 0 or p_agreed_price > 1000000000 then
    raise exception 'Enter a valid agreed price.';
  end if;
  if p_agreed_deadline is not null and p_agreed_deadline < current_date then
    raise exception 'The agreed deadline cannot be in the past.';
  end if;

  insert into public.project_contracts (project_id, proposal_id, brand_workspace_id, creative_workspace_id,
                                        agreed_price, currency, agreed_deadline, scope)
  values (v_proj.id, v_prop.id, v_brand.id, v_cre.id, p_agreed_price, v_proj.currency, p_agreed_deadline,
          left(coalesce(p_scope, ''), 4000))
  returning id into v_contract;

  update public.proposals set status = 'accepted' where id = v_prop.id;
  for r in
    select pr.id, w.owner_id from public.proposals pr join public.workspaces w on w.id = pr.creative_workspace_id
    where pr.project_id = v_proj.id and pr.id <> v_prop.id and pr.status in ('submitted', 'shortlisted')
  loop
    update public.proposals set status = 'declined' where id = r.id;
    perform public.notify(r.owner_id, 'proposal_declined', 'Proposal not selected',
      v_brand.name || ' hired another creative for "' || v_proj.title || '".', '/project/' || v_proj.id, r.id);
  end loop;

  update public.projects set status = 'hired', hired_creative_workspace_id = v_cre.id, hired_at = now()
    where id = v_proj.id;

  insert into public.payments (project_id, contract_id, payer_workspace_id, payee_workspace_id, amount, currency)
  values (v_proj.id, v_contract, v_brand.id, v_cre.id, p_agreed_price, v_proj.currency);

  perform public.log_event(v_proj.id, 'hired', v_brand.name || ' hired ' || v_cre.name || '.');
  perform public.notify(v_cre.owner_id, 'hired', 'You have been hired',
    v_brand.name || ' awarded you "' || v_proj.title || '".', '/work/' || v_proj.id, v_proj.id);
  return v_contract;
end;
$$;

-- ---- project status --------------------------------------------

create or replace function public.set_project_status(p_project_id uuid, p_status public.project_status)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_proj public.projects; v_brand public.workspaces; v_cre public.workspaces;
  v_is_brand boolean; v_is_creative boolean; v_admin boolean; v_ok boolean := false; v_other uuid;
begin
  perform public.sabi_require_user();
  select * into v_proj from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found.'; end if;
  select * into v_brand from public.workspaces where id = v_proj.brand_workspace_id;
  if v_proj.hired_creative_workspace_id is not null then
    select * into v_cre from public.workspaces where id = v_proj.hired_creative_workspace_id;
  end if;
  v_is_brand := v_brand.owner_id = auth.uid();
  v_is_creative := v_cre.id is not null and v_cre.owner_id = auth.uid();
  v_admin := public.is_admin();
  if not (v_is_brand or v_is_creative or v_admin) then raise exception 'Project not found.'; end if;
  if v_proj.is_demo and not v_admin then raise exception 'Demo projects cannot be changed.'; end if;
  if v_proj.status = p_status then return; end if;

  if v_admin then v_ok := true;
  elsif v_is_brand and v_proj.status = 'draft' and p_status = 'published' then v_ok := true;
  elsif v_is_brand and v_proj.status in ('published', 'in_discussion') and p_status = 'cancelled' then v_ok := true;
  elsif v_is_brand and v_proj.status = 'cancelled' and p_status = 'published' and v_proj.hired_creative_workspace_id is null then v_ok := true;
  elsif v_is_creative and v_proj.status = 'hired' and p_status = 'in_progress' then v_ok := true;
  elsif (v_is_brand or v_is_creative) and v_proj.status = 'hired' and p_status = 'cancelled' then v_ok := true;
  end if;
  if not v_ok then
    raise exception 'That status change is not allowed from "%".', v_proj.status;
  end if;

  if v_proj.status = 'draft' and p_status = 'published' then
    if char_length(btrim(v_proj.description)) < 20 then raise exception 'Add a description (at least 20 characters) before publishing.'; end if;
    if coalesce(array_length(v_proj.deliverables, 1), 0) = 0 then raise exception 'List at least one deliverable before publishing.'; end if;
    if v_proj.budget_min is null and v_proj.budget_max is null then raise exception 'Set a budget before publishing.'; end if;
    if v_proj.deadline is not null and v_proj.deadline < current_date then raise exception 'The deadline cannot be in the past.'; end if;
    if v_brand.suspended then raise exception 'This brand is suspended.'; end if;
  end if;

  update public.projects set status = p_status,
    completed_at = case when p_status = 'completed' then now() else completed_at end
    where id = p_project_id;

  if p_status = 'in_progress' then
    update public.project_contracts set started_at = now() where project_id = p_project_id;
  elsif p_status = 'cancelled' and v_proj.hired_creative_workspace_id is not null then
    update public.project_contracts set cancelled_at = now() where project_id = p_project_id;
    update public.payments set status = case when status in ('pending') then 'failed' else status end where project_id = p_project_id;
  end if;

  perform public.log_event(p_project_id, 'status', 'Status changed to ' || replace(p_status::text, '_', ' ') || '.');
  v_other := case when v_is_brand then v_cre.owner_id else v_brand.owner_id end;
  if v_other is not null and v_other <> auth.uid() and p_status <> 'published' then
    perform public.notify(v_other, 'project_status', 'Project updated',
      '"' || v_proj.title || '" is now ' || replace(p_status::text, '_', ' ') || '.', '/work/' || p_project_id, p_project_id);
  end if;
end;
$$;

-- ---- messaging -------------------------------------------------

create or replace function public.send_message(p_project_id uuid, p_creative_workspace_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_proj public.projects; v_brand public.workspaces; v_cre public.workspaces;
  v_sender_ws uuid; v_recipient uuid; v_id uuid; v_body text := btrim(coalesce(p_body, ''));
begin
  perform public.sabi_require_user();
  if char_length(v_body) = 0 or char_length(v_body) > 4000 then
    raise exception 'Messages must be between 1 and 4000 characters.';
  end if;
  if not public.is_conversation_party(p_project_id, p_creative_workspace_id) then
    raise exception 'You are not part of this conversation.';
  end if;
  select * into v_proj from public.projects where id = p_project_id;
  select * into v_brand from public.workspaces where id = v_proj.brand_workspace_id;
  select * into v_cre from public.workspaces where id = p_creative_workspace_id;
  if v_proj.is_demo or v_cre.is_demo then raise exception 'Demo profiles cannot receive messages.'; end if;
  if (select count(*) from public.messages where sender_user_id = auth.uid() and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'You are sending messages too quickly. Please wait a moment.';
  end if;
  if v_brand.owner_id = auth.uid() then
    v_sender_ws := v_brand.id; v_recipient := v_cre.owner_id;
  else
    v_sender_ws := v_cre.id; v_recipient := v_brand.owner_id;
  end if;
  insert into public.messages (project_id, creative_workspace_id, sender_user_id, sender_workspace_id, body)
  values (p_project_id, p_creative_workspace_id, auth.uid(), v_sender_ws, v_body) returning id into v_id;
  insert into public.conversation_reads (user_id, project_id, creative_workspace_id)
  values (auth.uid(), p_project_id, p_creative_workspace_id)
  on conflict (user_id, project_id, creative_workspace_id) do update set last_read_at = now();
  perform public.notify(v_recipient, 'message', 'New message', left(v_body, 120),
    '/messages?project=' || p_project_id || '&creative=' || p_creative_workspace_id, v_id);
  return v_id;
end;
$$;

create or replace function public.mark_conversation_read(p_project_id uuid, p_creative_workspace_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.sabi_require_user();
  if not public.is_conversation_party(p_project_id, p_creative_workspace_id) then return; end if;
  insert into public.conversation_reads (user_id, project_id, creative_workspace_id)
  values (auth.uid(), p_project_id, p_creative_workspace_id)
  on conflict (user_id, project_id, creative_workspace_id) do update set last_read_at = now();
  update public.notifications set read_at = now()
    where user_id = auth.uid() and type = 'message' and read_at is null
      and link = '/messages?project=' || p_project_id || '&creative=' || p_creative_workspace_id;
end;
$$;

create or replace function public.my_conversations()
returns table (
  project_id uuid, project_title text, project_status public.project_status,
  creative_workspace_id uuid, brand_workspace_id uuid, other_name text, other_avatar text,
  i_am_brand boolean, last_body text, last_at timestamptz, unread integer
) language sql stable security invoker set search_path = public as $$
  select p.id, p.title, p.status, pr.creative_workspace_id, p.brand_workspace_id,
    case when bw.owner_id = auth.uid() then cw.name else bw.name end,
    case when bw.owner_id = auth.uid() then coalesce(cw.avatar_url, cw.logo_url)
         else coalesce(bw.logo_url, bw.avatar_url, bw.cover_url) end,
    (bw.owner_id = auth.uid()),
    lm.body, coalesce(lm.created_at, pr.created_at),
    (select count(*)::int from public.messages m
      where m.project_id = p.id and m.creative_workspace_id = pr.creative_workspace_id
        and m.sender_user_id <> auth.uid()
        and m.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz))
  from public.proposals pr
  join public.projects p on p.id = pr.project_id
  join public.workspaces cw on cw.id = pr.creative_workspace_id
  join public.workspaces bw on bw.id = p.brand_workspace_id
  left join public.conversation_reads cr
    on cr.user_id = auth.uid() and cr.project_id = p.id and cr.creative_workspace_id = pr.creative_workspace_id
  left join lateral (
    select m.body, m.created_at from public.messages m
    where m.project_id = p.id and m.creative_workspace_id = pr.creative_workspace_id
    order by m.created_at desc limit 1
  ) lm on true
  where not p.is_demo and not cw.is_demo
    and pr.status <> 'withdrawn'
    and (cw.owner_id = auth.uid() or bw.owner_id = auth.uid())
  order by 10 desc;
$$;

-- ---- deliverables ----------------------------------------------

create or replace function public.submit_deliverable(
  p_project_id uuid, p_title text, p_note text, p_file_path text, p_file_name text, p_url text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_proj public.projects; v_cre public.workspaces; v_brand public.workspaces; v_id uuid;
begin
  perform public.sabi_require_user();
  select * into v_proj from public.projects where id = p_project_id for update;
  if not found or v_proj.hired_creative_workspace_id is null then raise exception 'Project not found.'; end if;
  select * into v_cre from public.workspaces where id = v_proj.hired_creative_workspace_id;
  select * into v_brand from public.workspaces where id = v_proj.brand_workspace_id;
  if v_cre.owner_id <> auth.uid() then raise exception 'Only the hired creative can submit work.'; end if;
  if v_proj.status not in ('in_progress', 'revision_requested') then
    raise exception 'Start the project before submitting work.';
  end if;
  if p_file_path is null and (p_url is null or btrim(p_url) = '') then
    raise exception 'Attach a file or add a link.';
  end if;
  if p_file_path is not null and split_part(p_file_path, '/', 1) <> p_project_id::text then
    raise exception 'Invalid file location.';
  end if;
  if p_url is not null and btrim(p_url) <> '' and p_url !~* '^https?://' then
    raise exception 'Links must start with http:// or https://.';
  end if;
  insert into public.deliverables (project_id, title, note, file_path, file_name, external_url)
  values (p_project_id, p_title, nullif(btrim(coalesce(p_note, '')), ''), p_file_path, p_file_name, nullif(btrim(coalesce(p_url, '')), ''))
  returning id into v_id;
  update public.projects set status = 'in_review' where id = p_project_id;
  perform public.log_event(p_project_id, 'deliverable', v_cre.name || ' submitted "' || left(p_title, 80) || '" for review.');
  perform public.notify(v_brand.owner_id, 'deliverable', 'Work submitted for review',
    v_cre.name || ' submitted work on "' || v_proj.title || '".', '/work/' || p_project_id, v_id);
  return v_id;
end;
$$;

create or replace function public.request_revision(p_project_id uuid, p_feedback text)
returns void language plpgsql security definer set search_path = public as $$
declare v_proj public.projects; v_brand public.workspaces; v_cre public.workspaces;
begin
  perform public.sabi_require_user();
  select * into v_proj from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found.'; end if;
  select * into v_brand from public.workspaces where id = v_proj.brand_workspace_id;
  if v_brand.owner_id <> auth.uid() then raise exception 'Only the project owner can request revisions.'; end if;
  if v_proj.status <> 'in_review' then raise exception 'There is no submitted work to review.'; end if;
  if p_feedback is null or char_length(btrim(p_feedback)) < 3 then raise exception 'Tell the creative what to change.'; end if;
  update public.deliverables set status = 'revision_requested', feedback = left(btrim(p_feedback), 2000), reviewed_at = now()
    where project_id = p_project_id and status = 'submitted';
  update public.projects set status = 'revision_requested' where id = p_project_id;
  select * into v_cre from public.workspaces where id = v_proj.hired_creative_workspace_id;
  perform public.log_event(p_project_id, 'revision', 'Revision requested.');
  perform public.notify(v_cre.owner_id, 'revision', 'Revision requested',
    v_brand.name || ' asked for changes on "' || v_proj.title || '".', '/work/' || p_project_id, p_project_id);
end;
$$;

create or replace function public.approve_project(p_project_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_proj public.projects; v_brand public.workspaces; v_cre public.workspaces;
begin
  perform public.sabi_require_user();
  select * into v_proj from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found.'; end if;
  select * into v_brand from public.workspaces where id = v_proj.brand_workspace_id;
  if v_brand.owner_id <> auth.uid() then raise exception 'Only the project owner can approve the work.'; end if;
  if v_proj.status <> 'in_review' then raise exception 'There is no submitted work to approve.'; end if;
  update public.deliverables set status = 'approved', reviewed_at = now() where project_id = p_project_id and status = 'submitted';
  update public.projects set status = 'completed', completed_at = now() where id = p_project_id;
  update public.project_contracts set completed_at = now() where project_id = p_project_id;
  select * into v_cre from public.workspaces where id = v_proj.hired_creative_workspace_id;
  perform public.log_event(p_project_id, 'completed', 'Work approved. Project completed.');
  perform public.notify(v_cre.owner_id, 'completed', 'Project completed',
    v_brand.name || ' approved your work on "' || v_proj.title || '". You can now leave a review.', '/work/' || p_project_id, p_project_id);
end;
$$;

-- ---- reviews ---------------------------------------------------

create or replace function public.submit_review(
  p_project_id uuid, p_rating int, p_communication int, p_quality int, p_reliability int, p_comment text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_proj public.projects; v_brand public.workspaces; v_cre public.workspaces; v_reviewer uuid; v_reviewee uuid; v_id uuid;
begin
  perform public.sabi_require_user();
  select * into v_proj from public.projects where id = p_project_id;
  if not found or v_proj.status <> 'completed' or v_proj.hired_creative_workspace_id is null then
    raise exception 'Reviews open once a project is completed.';
  end if;
  select * into v_brand from public.workspaces where id = v_proj.brand_workspace_id;
  select * into v_cre from public.workspaces where id = v_proj.hired_creative_workspace_id;
  if v_brand.owner_id = auth.uid() then v_reviewer := v_brand.id; v_reviewee := v_cre.id;
  elsif v_cre.owner_id = auth.uid() then v_reviewer := v_cre.id; v_reviewee := v_brand.id;
  else raise exception 'Only the two parties can review this project.'; end if;
  if exists (select 1 from public.reviews where project_id = p_project_id and reviewer_workspace_id = v_reviewer) then
    raise exception 'You have already reviewed this project.';
  end if;
  insert into public.reviews (project_id, reviewer_workspace_id, reviewee_workspace_id, rating, communication, quality, reliability, comment)
  values (p_project_id, v_reviewer, v_reviewee, p_rating, p_communication, p_quality, p_reliability, nullif(btrim(coalesce(p_comment, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---- payments --------------------------------------------------

create or replace function public.report_payment(p_project_id uuid, p_reference text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_pay public.payments; v_proj public.projects; v_cre public.workspaces;
begin
  perform public.sabi_require_user();
  select * into v_pay from public.payments where project_id = p_project_id for update;
  if not found or not public.owns_workspace(v_pay.payer_workspace_id) then raise exception 'Payment not found.'; end if;
  if v_pay.status not in ('pending', 'failed') then raise exception 'This payment has already been reported.'; end if;
  if p_reference is null or char_length(btrim(p_reference)) < 3 then raise exception 'Enter the transfer reference or receipt number.'; end if;
  update public.payments set status = 'reported', provider_reference = left(btrim(p_reference), 120),
    note = left(nullif(btrim(coalesce(p_note, '')), ''), 1000), reported_at = now()
    where id = v_pay.id;
  select * into v_proj from public.projects where id = p_project_id;
  select * into v_cre from public.workspaces where id = v_pay.payee_workspace_id;
  perform public.log_event(p_project_id, 'payment', 'Payment reported by the brand.');
  perform public.notify(v_cre.owner_id, 'payment', 'Payment reported',
    'The brand reported a payment for "' || v_proj.title || '". Please confirm once you have received it.', '/work/' || p_project_id, v_pay.id);
end;
$$;

create or replace function public.confirm_payment(p_project_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_pay public.payments; v_proj public.projects; v_brand public.workspaces;
begin
  perform public.sabi_require_user();
  select * into v_pay from public.payments where project_id = p_project_id for update;
  if not found or not public.owns_workspace(v_pay.payee_workspace_id) then raise exception 'Payment not found.'; end if;
  if v_pay.status <> 'reported' then raise exception 'There is no reported payment to confirm.'; end if;
  update public.payments set status = 'confirmed', confirmed_at = now() where id = v_pay.id;
  select * into v_proj from public.projects where id = p_project_id;
  select * into v_brand from public.workspaces where id = v_pay.payer_workspace_id;
  perform public.log_event(p_project_id, 'payment', 'Payment confirmed by the creative.');
  perform public.notify(v_brand.owner_id, 'payment', 'Payment confirmed',
    'The creative confirmed receipt for "' || v_proj.title || '".', '/work/' || p_project_id, v_pay.id);
end;
$$;

-- ---- admin -----------------------------------------------------

create or replace function public.admin_set_workspace_suspended(p_workspace_id uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.workspaces set suspended = p_suspended where id = p_workspace_id;
  perform public.notify((select owner_id from public.workspaces where id = p_workspace_id),
    'moderation', case when p_suspended then 'Your workspace was suspended' else 'Your workspace was restored' end,
    case when p_suspended then 'Contact support if you think this is a mistake.' else 'Your workspace is visible again.' end, '/settings', p_workspace_id);
end;
$$;

create or replace function public.admin_resolve_report(p_report_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_status not in ('reviewing', 'resolved', 'dismissed') then raise exception 'Invalid status.'; end if;
  update public.reports set status = p_status, admin_note = left(nullif(btrim(coalesce(p_note, '')), ''), 2000),
    resolved_at = case when p_status in ('resolved', 'dismissed') then now() else null end
    where id = p_report_id;
end;
$$;

create or replace function public.admin_set_payment_status(p_project_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_status not in ('pending', 'reported', 'confirmed', 'failed', 'refunded') then raise exception 'Invalid status.'; end if;
  update public.payments set status = p_status, note = coalesce(left(nullif(btrim(coalesce(p_note, '')), ''), 1000), note),
    confirmed_at = case when p_status = 'confirmed' then now() else confirmed_at end
    where project_id = p_project_id;
  perform public.log_event(p_project_id, 'payment', 'Admin set payment status to ' || p_status || '.');
end;
$$;

-- ============================================================
-- Function privileges: nothing is executable by default
-- ============================================================

revoke all on function
  public.notify(uuid, text, text, text, text, uuid),
  public.log_event(uuid, text, text),
  public.sabi_require_user()
  from public, anon, authenticated;

revoke all on function
  public.set_proposal_status(uuid, public.proposal_status),
  public.withdraw_proposal(uuid),
  public.resubmit_proposal(uuid),
  public.hire_creative(uuid, numeric, date, text),
  public.set_project_status(uuid, public.project_status),
  public.send_message(uuid, uuid, text),
  public.mark_conversation_read(uuid, uuid),
  public.my_conversations(),
  public.submit_deliverable(uuid, text, text, text, text, text),
  public.request_revision(uuid, text),
  public.approve_project(uuid),
  public.submit_review(uuid, int, int, int, int, text),
  public.report_payment(uuid, text, text),
  public.confirm_payment(uuid),
  public.admin_set_workspace_suspended(uuid, boolean),
  public.admin_resolve_report(uuid, text, text),
  public.admin_set_payment_status(uuid, text, text)
  from public, anon;

grant execute on function
  public.set_proposal_status(uuid, public.proposal_status),
  public.withdraw_proposal(uuid),
  public.resubmit_proposal(uuid),
  public.hire_creative(uuid, numeric, date, text),
  public.set_project_status(uuid, public.project_status),
  public.send_message(uuid, uuid, text),
  public.mark_conversation_read(uuid, uuid),
  public.my_conversations(),
  public.submit_deliverable(uuid, text, text, text, text, text),
  public.request_revision(uuid, text),
  public.approve_project(uuid),
  public.submit_review(uuid, int, int, int, int, text),
  public.report_payment(uuid, text, text),
  public.confirm_payment(uuid),
  public.admin_set_workspace_suspended(uuid, boolean),
  public.admin_resolve_report(uuid, text, text),
  public.admin_set_payment_status(uuid, text, text),
  public.is_admin(), public.has_role(uuid, public.app_role)
  to authenticated;

-- Policy helpers must be callable by the roles that evaluate the policies.
grant execute on function
  public.owns_workspace(uuid), public.owns_project_brand(uuid), public.is_project_party(uuid),
  public.is_conversation_party(uuid, uuid), public.is_admin(), public.safe_uuid(text)
  to anon, authenticated;

-- ============================================================
-- Storage: public media bucket + private deliverables bucket
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('workspace-media', 'workspace-media', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('deliverables', 'deliverables', false, 52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime',
          'application/pdf', 'application/zip',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- workspace-media: first path segment is the workspace id the file belongs to
create policy "Workspace media is public" on storage.objects for select to anon, authenticated
  using (bucket_id = 'workspace-media');
create policy "Owners upload workspace media" on storage.objects for insert to authenticated
  with check (bucket_id = 'workspace-media' and public.owns_workspace(public.safe_uuid((storage.foldername(name))[1])));
create policy "Owners replace workspace media" on storage.objects for update to authenticated
  using (bucket_id = 'workspace-media' and public.owns_workspace(public.safe_uuid((storage.foldername(name))[1])));
create policy "Owners delete workspace media" on storage.objects for delete to authenticated
  using (bucket_id = 'workspace-media' and public.owns_workspace(public.safe_uuid((storage.foldername(name))[1])));

-- deliverables: first path segment is the project id
create or replace function public.can_upload_deliverable(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.projects p join public.workspaces cw on cw.id = p.hired_creative_workspace_id
    where p.id = pid and cw.owner_id = auth.uid() and p.status in ('in_progress', 'revision_requested')
  );
$$;
grant execute on function public.can_upload_deliverable(uuid) to authenticated;

create policy "Parties read deliverable files" on storage.objects for select to authenticated
  using (bucket_id = 'deliverables' and (public.is_project_party(public.safe_uuid((storage.foldername(name))[1])) or public.is_admin()));
create policy "Hired creative uploads deliverable files" on storage.objects for insert to authenticated
  with check (bucket_id = 'deliverables' and public.can_upload_deliverable(public.safe_uuid((storage.foldername(name))[1])));

reset check_function_bodies;
