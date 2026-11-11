-- Sabi database tests: security rules + the full marketplace journey.
-- Run against a scratch database that has all migrations applied (and Supabase's
-- auth/storage schemas). Every check prints PASS or aborts with FAIL.
--   psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 -f drizzle/tests/marketplace_flow.test.sql
-- The whole script runs in one transaction and rolls back, leaving no data behind.

begin;
create schema t;

create function t.u(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end $$;
create function t.anon() returns void language plpgsql as $$
begin
  reset role; perform set_config('request.jwt.claim.sub', '', true); execute 'set local role anon';
end $$;
create function t.su() returns void language plpgsql as $$ begin reset role; end $$;

-- expect_fail(sql, must_contain, label): the statement has to raise an error containing the text
create function t.expect_fail(q text, must_contain text, label text) returns void language plpgsql as $$
declare ok boolean := false; msg text;
begin
  begin
    execute q;
  exception when others then
    ok := true; msg := sqlerrm;
  end;
  if not ok then raise exception 'FAIL: % (expected an error but the statement succeeded)', label; end if;
  if position(lower(must_contain) in lower(msg)) = 0 then
    raise exception 'FAIL: % (error was "%", expected it to contain "%")', label, msg, must_contain;
  end if;
  raise notice 'PASS: % [%]', label, left(msg, 70);
end $$;
create function t.expect(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;

-- ---------- fixtures (as superuser) ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'brand@test.dev',  '{"full_name":"Brand Owner"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'cre1@test.dev',    '{"full_name":"Creative One"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'cre2@test.dev',    '{"full_name":"Creative Two"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'outsider@test.dev','{"full_name":"Outsider"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.dev',   '{"full_name":"Admin"}');
insert into public.user_roles values ('00000000-0000-0000-0000-0000000000a1', 'admin');
select t.expect((select count(*) from public.profiles where id::text like '00000000-0000-0000-0000-0000000000%') = 5,
  'signup trigger creates a profile per user');

-- ---------- workspaces ----------
select t.u('00000000-0000-0000-0000-0000000000b1');
insert into public.workspaces (id, owner_id, type, name, slug, industry, location)
  values ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'brand', 'Test Kitchen', 'test-kitchen', 'Food & Hospitality', 'Lagos');
select t.expect(true, 'brand owner creates a brand workspace');
select t.expect((select verified = false and rating = 0 and is_demo = false and suspended = false from public.workspaces where slug = 'test-kitchen'),
  'new workspaces start unverified, unrated, not demo');
select t.expect_fail($q$insert into public.workspaces (owner_id, type, name, slug, verified) values ('00000000-0000-0000-0000-0000000000b1','brand','Fake','fake-verified', true)$q$,
  'permission denied', 'cannot self-verify on insert');
select t.expect_fail($q$update public.workspaces set rating = 5 where slug = 'test-kitchen'$q$,
  'permission denied', 'cannot edit own rating');
select t.expect_fail($q$update public.workspaces set is_demo = true where slug = 'test-kitchen'$q$,
  'permission denied', 'cannot flag own workspace as demo');
select t.expect_fail($q$insert into public.workspaces (owner_id, type, name, slug) values ('00000000-0000-0000-0000-0000000000c1','brand','Impostor','impostor')$q$,
  'row-level security', 'cannot create a workspace for someone else');
select t.expect_fail($q$insert into public.workspaces (owner_id, type, name, slug) values ('00000000-0000-0000-0000-0000000000b1','brand','Bad Slug','Bad Slug!')$q$,
  'workspaces_slug_fmt', 'slug format enforced');
update public.workspaces set tagline = 'Great food' where slug = 'test-kitchen';
select t.expect((select tagline from public.workspaces where slug = 'test-kitchen') = 'Great food', 'owner edits allowed profile fields');

select t.u('00000000-0000-0000-0000-0000000000c1');
insert into public.workspaces (id, owner_id, type, name, slug, skills) values
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'creative', 'Creative One', 'creative-one', array['Photography']);
select t.u('00000000-0000-0000-0000-0000000000c2');
insert into public.workspaces (id, owner_id, type, name, slug) values
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c2', 'creative', 'Creative Two', 'creative-two');
select t.expect((select count(*) from public.workspaces where slug = 'creative-one' and name = 'Creative One') = 1, 'creatives can see each other''s public profile');
update public.workspaces set name = 'Hijacked' where slug = 'creative-one';
select t.su();
select t.expect((select name from public.workspaces where slug = 'creative-one') = 'Creative One', 'cannot edit another user''s workspace (silently filtered by RLS)');

-- ---------- projects ----------
select t.u('00000000-0000-0000-0000-0000000000b1');
select t.expect_fail($q$insert into public.projects (brand_workspace_id, title, category, status) values ('b0000000-0000-0000-0000-000000000001','Sneaky','Design','published')$q$,
  'permission denied', 'cannot insert a project directly as published');
select t.expect_fail($q$insert into public.projects (brand_workspace_id, title, category, budget_min, budget_max) values ('b0000000-0000-0000-0000-000000000001','Bad budget','Design', 500, 100)$q$,
  'projects_budget_ok', 'budget range validated');
insert into public.projects (id, brand_workspace_id, title, category, description, deliverables, budget_type, budget_min, budget_max, deadline, proposal_deadline)
values ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Menu photography', 'Photography',
        'Photograph twelve dishes for our new menu in natural light.', array['12 edited photos'], 'range', 80000, 120000,
        current_date + 30, current_date + 7);
select t.expect((select status from public.projects where id = 'd0000000-0000-0000-0000-000000000001') = 'draft', 'new projects start as drafts');
select t.expect_fail($q$update public.projects set status = 'completed' where id = 'd0000000-0000-0000-0000-000000000001'$q$,
  'permission denied', 'cannot set project status directly');
select t.u('00000000-0000-0000-0000-0000000000c1');
select t.expect((select count(*) from public.projects where id = 'd0000000-0000-0000-0000-000000000001') = 0, 'drafts are invisible to other users');
select t.anon();
select t.expect((select count(*) from public.projects where id = 'd0000000-0000-0000-0000-000000000001') = 0, 'drafts are invisible to anonymous visitors');
select t.expect_fail($q$select public.set_project_status('d0000000-0000-0000-0000-000000000001', 'published')$q$,
  'permission denied', 'anonymous users cannot call workflow functions');
select t.u('00000000-0000-0000-0000-0000000000c1');
select t.expect_fail($q$select public.set_project_status('d0000000-0000-0000-0000-000000000001', 'published')$q$,
  'not found', 'a stranger cannot publish someone else''s project');
select t.u('00000000-0000-0000-0000-0000000000b1');
select public.set_project_status('d0000000-0000-0000-0000-000000000001', 'published');
select t.expect((select status from public.projects where id = 'd0000000-0000-0000-0000-000000000001') = 'published', 'owner publishes the project');
select t.anon();
select t.expect((select count(*) from public.projects where id = 'd0000000-0000-0000-0000-000000000001') = 1, 'published projects are public');

-- ---------- proposals ----------
select t.u('00000000-0000-0000-0000-0000000000c1');
select t.expect_fail($q$insert into public.proposals (project_id, creative_workspace_id, price, status) values ('d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001', 90000, 'accepted')$q$,
  'permission denied', 'cannot create a proposal that is already accepted');
select t.expect_fail($q$insert into public.proposals (project_id, creative_workspace_id, price) values ('d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001', -5)$q$,
  'proposals_price_ok', 'price must be positive');
select t.expect_fail($q$insert into public.proposals (project_id, creative_workspace_id, price) values ('d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002', 90000)$q$,
  'row-level security', 'cannot send a proposal as someone else''s workspace');
insert into public.proposals (id, project_id, creative_workspace_id, price, delivery_time, approach, cover_message)
values ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 95000, 'Within 1 week', 'Natural light', 'Hello!');
select t.expect_fail($q$insert into public.proposals (project_id, creative_workspace_id, price) values ('d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001', 80000)$q$,
  'duplicate key', 'one proposal per creative per project');
update public.proposals set price = 92000 where id = 'f0000000-0000-0000-0000-000000000001';
select t.expect((select price from public.proposals where id = 'f0000000-0000-0000-0000-000000000001') = 92000, 'creative edits a pending proposal');
select t.expect_fail($q$update public.proposals set status = 'accepted' where id = 'f0000000-0000-0000-0000-000000000001'$q$,
  'permission denied', 'creative cannot accept their own proposal');
select t.u('00000000-0000-0000-0000-0000000000c2');
insert into public.proposals (id, project_id, creative_workspace_id, price, delivery_time, approach)
values ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 70000, 'Within 2 weeks', 'Studio shoot');
select t.expect((select count(*) from public.proposals) = 1, 'creatives only see their own proposals');
select t.u('00000000-0000-0000-0000-0000000000e1');
select t.expect((select count(*) from public.proposals) = 0, 'outsiders see no proposals');
select t.u('00000000-0000-0000-0000-0000000000b1');
select t.expect((select count(*) from public.proposals) = 2, 'project owner sees every proposal');
update public.proposals set price = 1 where id = 'f0000000-0000-0000-0000-000000000001';
select t.su();
select t.expect((select price from public.proposals where id = 'f0000000-0000-0000-0000-000000000001') = 92000, 'brand owner cannot rewrite a creative''s price');
select t.expect((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and type = 'proposal_received') = 2, 'brand is notified of each proposal');

-- own-project guard: brand owner also owns a creative workspace
select t.u('00000000-0000-0000-0000-0000000000b1');
insert into public.workspaces (id, owner_id, type, name, slug) values ('c0000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b1', 'creative', 'Owner As Creative', 'owner-creative');
select t.expect_fail($q$insert into public.proposals (project_id, creative_workspace_id, price) values ('d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-0000000000b2', 50000)$q$,
  'own project', 'cannot apply to your own project');

-- shortlist / decline
select t.u('00000000-0000-0000-0000-0000000000c2');
select t.expect_fail($q$select public.set_proposal_status('f0000000-0000-0000-0000-000000000001', 'declined')$q$, 'project owner', 'a rival creative cannot decline another proposal');
select t.u('00000000-0000-0000-0000-0000000000b1');
select public.set_proposal_status('f0000000-0000-0000-0000-000000000001', 'shortlisted');
select t.expect((select status from public.projects where id = 'd0000000-0000-0000-0000-000000000001') = 'in_discussion', 'shortlisting moves the project to in_discussion');
select t.expect_fail($q$select public.set_proposal_status('f0000000-0000-0000-0000-000000000001', 'accepted')$q$, 'hire action', 'accepting is only possible through hiring');

-- ---------- hiring ----------
select t.u('00000000-0000-0000-0000-0000000000c1');
select t.expect_fail($q$select public.hire_creative('f0000000-0000-0000-0000-000000000001', 1000, current_date + 5, 'x')$q$, 'project owner', 'a creative cannot hire themselves');
select t.u('00000000-0000-0000-0000-0000000000b1');
select t.expect_fail($q$select public.hire_creative('f0000000-0000-0000-0000-000000000001', 0, current_date + 5, 'x')$q$, 'valid agreed price', 'agreed price must be positive');
select t.expect_fail($q$select public.hire_creative('f0000000-0000-0000-0000-000000000001', 90000, current_date - 1, 'x')$q$, 'past', 'agreed deadline cannot be in the past');
select public.hire_creative('f0000000-0000-0000-0000-000000000001', 90000, current_date + 14, 'Twelve edited dishes, two revisions.');
select t.expect((select status from public.projects where id = 'd0000000-0000-0000-0000-000000000001') = 'hired', 'hiring marks the project as hired');
select t.expect((select status from public.proposals where id = 'f0000000-0000-0000-0000-000000000001') = 'accepted', 'winning proposal is accepted');
select t.expect((select status from public.proposals where id = 'f0000000-0000-0000-0000-000000000002') = 'declined', 'other proposals are declined');
select t.expect((select count(*) from public.payments where status = 'pending' and amount = 90000) = 1, 'a pending payment record is created at the agreed price');
select t.expect_fail($q$select public.hire_creative('f0000000-0000-0000-0000-000000000002', 70000, current_date + 5, '')$q$, 'not open', 'a second creative cannot be hired');
select t.u('00000000-0000-0000-0000-0000000000c2');
select t.expect((select count(*) from public.project_contracts) = 0, 'losing creative cannot see the contract');
select t.expect((select count(*) from public.payments) = 0, 'losing creative cannot see the payment');
select t.u('00000000-0000-0000-0000-0000000000c1');
select t.expect((select agreed_price from public.project_contracts) = 90000, 'hired creative sees the contract');
select t.u('00000000-0000-0000-0000-0000000000e1');
select t.expect((select count(*) from public.project_contracts) = 0, 'outsider cannot see contracts');

-- ---------- messaging ----------
select t.u('00000000-0000-0000-0000-0000000000b1');
select public.send_message('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Welcome aboard!');
select t.u('00000000-0000-0000-0000-0000000000e1');
select t.expect_fail($q$select public.send_message('d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','hi')$q$, 'not part', 'outsiders cannot send messages into a thread');
select t.expect((select count(*) from public.messages) = 0, 'outsiders cannot read messages');
select t.u('00000000-0000-0000-0000-0000000000c2');
select t.expect((select count(*) from public.messages) = 0, 'another creative cannot read the thread');
select t.expect_fail($q$insert into public.messages (project_id, creative_workspace_id, sender_user_id, sender_workspace_id, body) values ('d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c2','c0000000-0000-0000-0000-000000000002','x')$q$, 'permission denied', 'messages cannot be inserted directly');
select t.u('00000000-0000-0000-0000-0000000000c1');
select t.expect((select unread from public.my_conversations() where project_id = 'd0000000-0000-0000-0000-000000000001') = 1, 'hired creative sees 1 unread message');
select public.mark_conversation_read('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001');
select t.expect((select unread from public.my_conversations() where project_id = 'd0000000-0000-0000-0000-000000000001') = 0, 'reading clears the unread count');
select public.send_message('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Thanks, starting soon.');
select t.expect((select count(*) from public.messages) = 2, 'both sides can read the conversation');

-- ---------- project workspace lifecycle ----------
select t.u('00000000-0000-0000-0000-0000000000b1');
select t.expect_fail($q$select public.set_project_status('d0000000-0000-0000-0000-000000000001', 'in_progress')$q$, 'not allowed', 'brand cannot start work on the creative''s behalf');
select t.u('00000000-0000-0000-0000-0000000000c1');
select t.expect_fail($q$select public.submit_deliverable('d0000000-0000-0000-0000-000000000001','Photos','', null, null, 'https://example.com/a')$q$, 'start the project', 'cannot submit before starting');
select public.set_project_status('d0000000-0000-0000-0000-000000000001', 'in_progress');
select t.expect_fail($q$select public.submit_deliverable('d0000000-0000-0000-0000-000000000001','Photos','', null, null, 'javascript:alert(1)')$q$, 'http', 'deliverable links must be http(s)');
select t.expect_fail($q$select public.submit_deliverable('d0000000-0000-0000-0000-000000000001','Photos','', null, null, null)$q$, 'attach', 'a deliverable needs a file or link');
select t.expect_fail($q$select public.submit_deliverable('d0000000-0000-0000-0000-000000000001','Photos','', 'other-project/file.png', 'file.png', null)$q$, 'file location', 'file path must belong to the project');
select public.submit_deliverable('d0000000-0000-0000-0000-000000000001', 'First batch', 'Six dishes', null, null, 'https://example.com/batch1');
select t.expect((select status from public.projects where id = 'd0000000-0000-0000-0000-000000000001') = 'in_review', 'submitting work moves the project to in_review');
select t.u('00000000-0000-0000-0000-0000000000c2');
select t.expect((select count(*) from public.deliverables) = 0, 'other creatives cannot see deliverables');
select t.u('00000000-0000-0000-0000-0000000000c1');
select t.expect_fail($q$select public.approve_project('d0000000-0000-0000-0000-000000000001')$q$, 'project owner', 'creative cannot approve their own work');
select t.u('00000000-0000-0000-0000-0000000000b1');
select t.expect_fail($q$select public.request_revision('d0000000-0000-0000-0000-000000000001', '')$q$, 'what to change', 'revision requests need feedback');
select public.request_revision('d0000000-0000-0000-0000-000000000001', 'Please brighten the last two photos.');
select t.expect((select status from public.projects where id = 'd0000000-0000-0000-0000-000000000001') = 'revision_requested', 'revision requested');
select t.expect((select feedback from public.deliverables limit 1) like 'Please brighten%', 'feedback is stored on the deliverable');
select t.expect_fail($q$select public.submit_review('d0000000-0000-0000-0000-000000000001', 5, 5, 5, 5, 'Great')$q$, 'completed', 'cannot review before completion');
select t.u('00000000-0000-0000-0000-0000000000c1');
select public.submit_deliverable('d0000000-0000-0000-0000-000000000001', 'Final batch', null, null, null, 'https://example.com/final');
select t.u('00000000-0000-0000-0000-0000000000b1');
select public.approve_project('d0000000-0000-0000-0000-000000000001');
select t.expect((select status from public.projects where id = 'd0000000-0000-0000-0000-000000000001') = 'completed', 'approval completes the project');
select t.expect((select count(*) from public.project_events where project_id = 'd0000000-0000-0000-0000-000000000001') >= 6, 'activity log records each step');

-- ---------- payments ----------
select t.expect_fail($q$select public.confirm_payment('d0000000-0000-0000-0000-000000000001')$q$, 'not found', 'brand cannot confirm its own payment');
select t.expect_fail($q$select public.report_payment('d0000000-0000-0000-0000-000000000001', 'x', null)$q$, 'reference', 'payment reference required');
select public.report_payment('d0000000-0000-0000-0000-000000000001', 'TRF-20261031-001', 'Bank transfer');
select t.expect((select status from public.payments) = 'reported', 'brand reports a payment');
select t.u('00000000-0000-0000-0000-0000000000c1');
select t.expect_fail($q$select public.report_payment('d0000000-0000-0000-0000-000000000001', 'TRF-ABC', null)$q$, 'not found', 'creative cannot report the brand''s payment');
select public.confirm_payment('d0000000-0000-0000-0000-000000000001');
select t.expect((select status from public.payments) = 'confirmed', 'creative confirms receipt');
select t.expect_fail($q$update public.payments set status = 'confirmed'$q$, 'permission denied', 'payments cannot be edited directly');

-- ---------- reviews ----------
select t.u('00000000-0000-0000-0000-0000000000e1');
select t.expect_fail($q$select public.submit_review('d0000000-0000-0000-0000-000000000001', 1, 1, 1, 1, 'spam')$q$, 'two parties', 'outsiders cannot review');
select t.u('00000000-0000-0000-0000-0000000000b1');
select t.expect_fail($q$select public.submit_review('d0000000-0000-0000-0000-000000000001', 9, 5, 5, 5, 'bad')$q$, 'reviews_rating_check', 'rating bounded 1-5');
select public.submit_review('d0000000-0000-0000-0000-000000000001', 5, 5, 4, 5, 'Excellent work.');
select t.expect_fail($q$select public.submit_review('d0000000-0000-0000-0000-000000000001', 4, 4, 4, 4, 'again')$q$, 'already', 'no duplicate reviews');
select t.u('00000000-0000-0000-0000-0000000000c1');
select public.submit_review('d0000000-0000-0000-0000-000000000001', 4, 4, 4, 4, 'Clear brief, prompt feedback.');
select t.anon();
select t.expect((select rating = 5 and reviews_count = 1 from public.workspaces where slug = 'creative-one'), 'creative rating is computed from reviews');
select t.expect((select count(*) from public.reviews) = 2, 'reviews are public');

-- ---------- notifications ----------
select t.u('00000000-0000-0000-0000-0000000000c1');
select t.expect((select count(*) from public.notifications where type = 'hired') = 1, 'hired creative has a "hired" notification');
select t.expect((select count(*) from public.notifications where user_id <> '00000000-0000-0000-0000-0000000000c1') = 0, 'users only see their own notifications');
update public.notifications set read_at = now() where type = 'hired';
select t.expect((select read_at is not null from public.notifications where type = 'hired'), 'users can mark their notifications read');
select t.expect_fail($q$update public.notifications set title = 'hacked'$q$, 'permission denied', 'notification content cannot be edited');
select t.expect_fail($q$select public.notify('00000000-0000-0000-0000-0000000000b1', 'x', 'phish', 'x', null)$q$, 'permission denied', 'clients cannot create notifications');

-- ---------- reports & admin ----------
select t.u('00000000-0000-0000-0000-0000000000e1');
insert into public.reports (target_type, target_id, reason, details) values ('workspace', 'c0000000-0000-0000-0000-000000000001', 'Suspicious account', 'Looks fake');
select t.expect((select count(*) from public.reports) = 1, 'users file and see their own reports');
select t.u('00000000-0000-0000-0000-0000000000b1');
select t.expect((select count(*) from public.reports) = 0, 'other users cannot read reports');
select t.expect_fail($q$select public.admin_resolve_report((select id from public.reports limit 1), 'resolved', null)$q$, 'admins only', 'non-admins cannot resolve reports');
select t.u('00000000-0000-0000-0000-0000000000a1');
select t.expect((select count(*) from public.reports) = 1, 'admin sees all reports');
select public.admin_resolve_report((select id from public.reports limit 1), 'resolved', 'Checked: legitimate account.');
select t.expect((select status from public.reports limit 1) = 'resolved', 'admin resolves a report');
select public.admin_set_workspace_suspended('c0000000-0000-0000-0000-000000000002', true);
select t.anon();
select t.expect((select count(*) from public.workspaces where slug = 'creative-two') = 0, 'suspended workspaces disappear from public view');
select t.u('00000000-0000-0000-0000-0000000000c2');
select t.expect((select count(*) from public.workspaces where slug = 'creative-two') = 1, 'suspended owner can still see their own workspace');
select t.expect_fail($q$update public.workspaces set suspended = false where slug = 'creative-two'$q$, 'permission denied', 'owners cannot lift their own suspension');

-- ---------- rate limiting ----------
select t.su();
create function t.spam() returns void language plpgsql as $$
begin
  for i in 1..25 loop
    perform public.send_message('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'msg ' || i);
  end loop;
end $$;
grant execute on function t.spam() to authenticated;
select t.u('00000000-0000-0000-0000-0000000000b1');
select t.expect_fail($q$select t.spam()$q$, 'too quickly', 'message flooding is rate limited');

-- ---------- storage ----------
select t.u('00000000-0000-0000-0000-0000000000c1');
insert into storage.objects (bucket_id, name) values ('workspace-media', 'c0000000-0000-0000-0000-000000000001/avatar.png');
select t.expect(true, 'owner can upload to their own workspace folder');
select t.expect_fail($q$insert into storage.objects (bucket_id, name) values ('workspace-media', 'c0000000-0000-0000-0000-000000000002/avatar.png')$q$, 'row-level security', 'cannot upload into another workspace folder');
select t.expect_fail($q$insert into storage.objects (bucket_id, name) values ('deliverables', 'd0000000-0000-0000-0000-000000000001/late.pdf')$q$, 'row-level security', 'deliverable uploads closed once the project is completed');
select t.u('00000000-0000-0000-0000-0000000000e1');
select t.expect((select count(*) from storage.objects where bucket_id = 'deliverables') = 0, 'outsiders cannot list deliverable files');

select t.su();
select 'ALL DATABASE TESTS PASSED' as result;
rollback;
