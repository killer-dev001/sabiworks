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

-- ============ DEMO SEED (clearly marked demo content) ============

insert into public.workspaces (owner_id, type, name, slug, tagline, description, industry, location, cover_url, logo_url, open_to_projects, rating, reviews_count, verified, is_demo) values
(gen_random_uuid(), 'brand', 'The Sunday Table', 'the-sunday-table', 'Lagos • Dining for creatives', 'A modern Nigerian restaurant celebrating West African flavours. We work with creatives on food photography, content campaigns and brand storytelling.', 'Food & Hospitality', 'Lagos', '/__l5e/assets-v1/fbce9aa6-94a6-45a4-9354-599f6696583a/brand-restaurant.jpg', null, true, 4.8, 12, true, true),
(gen_random_uuid(), 'brand', 'Ayo Studio', 'ayo-studio', 'Lagos • Hiring', 'A contemporary African fashion house creating bold ready-to-wear pieces. We collaborate with photographers, stylists and content creators.', 'Fashion & Lifestyle', 'Lagos', '/__l5e/assets-v1/9984d047-320c-40d3-bba6-df7ef6cd97b8/brand-fashion.jpg', null, true, 4.9, 9, true, true),
(gen_random_uuid(), 'brand', 'BrightPath Academy', 'brightpath-academy', 'Abuja • Open to proposals', 'An innovative school preparing African children for the future. We run creative campaigns and community events year-round.', 'Education', 'Abuja', '/__l5e/assets-v1/da5cc7f7-da19-421d-82ee-b06c044adedf/brand-education.jpg', null, true, 4.7, 6, false, true),
(gen_random_uuid(), 'brand', 'Hozen Properties', 'hozen-properties', 'Lagos • New projects', 'A real estate company developing premium residences in Lagos. We hire videographers and photographers to showcase our properties.', 'Real Estate', 'Lagos', '/__l5e/assets-v1/0604cbbf-f037-4cee-af04-8b72a3759d10/brand-realestate.jpg', null, true, 4.6, 5, true, true);

insert into public.workspaces (owner_id, type, name, slug, tagline, description, industry, location, avatar_url, cover_url, skills, services, starting_price, availability, rating, reviews_count, verified, is_demo) values
(gen_random_uuid(), 'creative', 'Tunde Adebayo', 'tunde-adebayo', 'Brand identity designer telling African stories through bold marks and type.', 'I help brands find their voice through distinctive visual identities. 6 years of experience working with startups, restaurants and culture brands across Nigeria.', 'Design', 'Lagos', '/__l5e/assets-v1/99ad61a0-d2fd-4425-b651-0ec25d088b53/creative-tunde.jpg', '/__l5e/assets-v1/99ad61a0-d2fd-4425-b651-0ec25d088b53/creative-tunde.jpg', array['Brand Identity','Logo Design','Typography','Illustration'], array['Logo & identity design','Brand guidelines','Print & packaging'], 65000, 'Available now', 4.9, 24, true, true),
(gen_random_uuid(), 'creative', 'Zainab Yusuf', 'zainab-yusuf', 'Content strategist helping brands build loyal communities.', 'I plan and create content that turns followers into customers. I have grown social accounts for food, fashion and education brands to a combined 500k audience.', 'Social Media', 'Abuja', '/__l5e/assets-v1/2811e4a8-195d-452f-adff-8ee62a4ed520/creative-zainab.jpg', '/__l5e/assets-v1/2811e4a8-195d-452f-adff-8ee62a4ed520/creative-zainab.jpg', array['Content Strategy','Copywriting','Social Media','Analytics'], array['Content calendars','Campaign strategy','Copywriting'], 55000, 'Available now', 4.8, 18, true, true),
(gen_random_uuid(), 'creative', 'Emeka Okafor', 'emeka-okafor', 'Photographer & videographer capturing real African moments.', 'From weddings to brand campaigns, I create warm, honest imagery that people connect with. Licensed drone pilot and full editing suite.', 'Photography', 'Lagos', '/__l5e/assets-v1/839b622a-fead-417f-b4bf-fc4a605ce203/creative-emeka.jpg', '/__l5e/assets-v1/839b622a-fead-417f-b4bf-fc4a605ce203/creative-emeka.jpg', array['Photography','Videography','Video Editing','Drone'], array['Event photography','Brand shoots','Video production'], 90000, 'Booked until Nov 15', 4.7, 31, false, true),
(gen_random_uuid(), 'creative', 'Ngozi Nwosu', 'ngozi-nwosu', 'Social media manager growing brands people love.', 'I manage social media end-to-end: strategy, content, community and reporting. My clients see steady month-on-month growth and engaged communities.', 'Social Media', 'Port Harcourt', '/__l5e/assets-v1/603b405f-825b-475d-9c68-171e43fb94b8/creative-ngozi.jpg', '/__l5e/assets-v1/603b405f-825b-475d-9c68-171e43fb94b8/creative-ngozi.jpg', array['Social Media Management','Community Management','Content Creation','Analytics'], array['Monthly social management','Content creation','Community engagement'], 50000, 'Available now', 4.9, 27, true, true);

insert into public.projects (brand_workspace_id, title, category, description, deliverables, budget_type, budget_min, budget_max, deadline, location, is_remote, skills, status, image_url, created_at, is_demo) values
((select id from public.workspaces where slug='the-sunday-table'), 'Restaurant content campaign', 'Social Media', 'We want to increase local awareness and attract more weekend customers with engaging short-form videos and branded posts. Our food is warm, vibrant and authentic — your creative direction should reflect that.', array['4 short videos (reels)','8 edited photos','Captions and hashtags','Creative direction: warm, vibrant, authentic'], 'range', 80000, 120000, current_date + 10, 'Lagos', false, array['Videography','Photography','Social Media'], 'published', '/__l5e/assets-v1/fbce9aa6-94a6-45a4-9354-599f6696583a/brand-restaurant.jpg', now() - interval '2 days', true),
((select id from public.workspaces where slug='the-sunday-table'), 'Menu design & branding', 'Design', 'We are refreshing our menu and restaurant branding. Looking for a designer who understands hospitality and African-inspired aesthetics to redesign our print and digital menus plus supporting signage.', array['Print menu (A4 trifold)','Digital menu board','3 signage concepts','Brand colour refresh'], 'range', 60000, 90000, current_date + 14, 'Lagos', false, array['Graphic Design','Branding','Print Design'], 'published', '/__l5e/assets-v1/21a4a810-aad7-4d1e-a705-9f726a543066/banner-restaurant.jpg', now() - interval '5 days', true),
((select id from public.workspaces where slug='the-sunday-table'), 'Event photography', 'Photography', 'We are hosting a chef collaboration dinner and need professional coverage: candid guest moments, plated dishes and a short highlight reel for our socials.', array['4–6 hours on site','200+ edited photos','1 highlight reel (30s)'], 'range', 120000, 200000, current_date + 7, 'Lagos', false, array['Photography','Event','Editing'], 'in_progress', '/__l5e/assets-v1/352b32e9-53e3-483a-96e2-f6bf21d4b959/event-photography.jpg', now() - interval '7 days', true),
((select id from public.workspaces where slug='ayo-studio'), 'Fashion lookbook content campaign', 'Photography', 'Ayo Studio is launching a new ready-to-wear collection and needs a lookbook shot on location in Lagos: bold, editorial, full of personality.', array['4–8 final visuals','Behind-the-scenes stills','Retouching included'], 'range', 80000, 120000, current_date + 10, 'Lagos', false, array['Photography','Fashion','Retouching'], 'published', '/__l5e/assets-v1/9984d047-320c-40d3-bba6-df7ef6cd97b8/brand-fashion.jpg', now() - interval '3 days', true),
((select id from public.workspaces where slug='brightpath-academy'), 'Social media campaign', 'Social Media', 'BrightPath Academy wants a term-long social media campaign to reach parents: short videos, photos from campus life and clear, friendly copy.', array['Photos + flash and reels set','Copy for 4 weeks','Simple performance report'], 'range', 100000, 150000, current_date + 14, 'Abuja', true, array['Social Media','Copywriting','Videography'], 'published', '/__l5e/assets-v1/da5cc7f7-da19-421d-82ee-b06c044adedf/brand-education.jpg', now() - interval '4 days', true),
((select id from public.workspaces where slug='hozen-properties'), 'Property video + photos', 'Videography', 'We need a cinematic walkthrough of our newest residence in Victoria Island: 4–6 hero photos and one smooth video tour for listings and ads.', array['4–6 photos','1 video tour','Drone shots if possible'], 'range', 120000, 200000, current_date + 7, 'Lagos', false, array['Videography','Photography','Drone'], 'published', '/__l5e/assets-v1/0604cbbf-f037-4cee-af04-8b72a3759d10/brand-realestate.jpg', now() - interval '6 days', true);

insert into public.proposals (project_id, creative_workspace_id, price, delivery_time, approach, status, is_demo, created_at) values
((select id from public.projects where title='Restaurant content campaign'), (select id from public.workspaces where slug='zainab-yusuf'), 95000, '14 days', 'I will build a 4-week content plan around your weekend service, mixing reel trends with your brand voice. Samples of my food-brand work are in my portfolio.', 'submitted', true, now() - interval '1 day'),
((select id from public.projects where title='Restaurant content campaign'), (select id from public.workspaces where slug='emeka-okafor'), 110000, '10 days', 'Two shoot days covering your kitchen and dining room, delivered as edited reels and stills with captions ready for posting.', 'submitted', true, now() - interval '1 day'),
((select id from public.projects where title='Restaurant content campaign'), (select id from public.workspaces where slug='ngozi-nwosu'), 88000, '21 days', 'End-to-end: I plan, shoot with a partner photographer, edit and manage posting and comments for four weeks.', 'shortlisted', true, now() - interval '2 days'),
((select id from public.projects where title='Restaurant content campaign'), (select id from public.workspaces where slug='tunde-adebayo'), 118000, '12 days', 'I will design a mini content system: templates, type treatment and four reels so your team can keep the look consistent after the campaign.', 'submitted', true, now() - interval '2 days'),
((select id from public.projects where title='Menu design & branding'), (select id from public.workspaces where slug='tunde-adebayo'), 72000, '10 days', 'A trifold menu with warm typography and hand-drawn African motifs, plus a digital board your staff can update.', 'submitted', true, now() - interval '3 days'),
((select id from public.projects where title='Menu design & branding'), (select id from public.workspaces where slug='zainab-yusuf'), 65000, '14 days', 'Menu copy refresh included: dish descriptions that sell, laid out cleanly for print and screen.', 'submitted', true, now() - interval '4 days'),
((select id from public.projects where title='Menu design & branding'), (select id from public.workspaces where slug='ngozi-nwosu'), 60000, '18 days', 'Clean, legible menus with a matching template pack so seasonal updates stay on brand.', 'submitted', true, now() - interval '4 days'),
((select id from public.projects where title='Event photography'), (select id from public.workspaces where slug='emeka-okafor'), 150000, '7 days', 'Full coverage of the dinner: candids, plated dishes and a 30-second highlight reel delivered within a week.', 'accepted', true, now() - interval '6 days'),
((select id from public.projects where title='Event photography'), (select id from public.workspaces where slug='zainab-yusuf'), 135000, '9 days', 'Coverage plus a social-first edit plan so the best moments reach your audience within 48 hours.', 'declined', true, now() - interval '5 days');

-- Demo creative has a proposal sent history
insert into public.proposals (project_id, creative_workspace_id, price, delivery_time, approach, status, is_demo, created_at) values
((select id from public.projects where title='Fashion lookbook content campaign'), (select id from public.workspaces where slug='tunde-adebayo'), 98000, '12 days', 'Editorial lookbook with a bold type-led art direction that matches Ayo Studio''s energy.', 'submitted', true, now() - interval '2 days');
