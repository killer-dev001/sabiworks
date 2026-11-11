-- Sabi Phase 2 (part 1): new project lifecycle states.
-- ALTER TYPE ... ADD VALUE must be committed before the values are used, so this
-- lives in its own migration file and runs before 0002.

alter type public.project_status add value if not exists 'in_review';
alter type public.project_status add value if not exists 'revision_requested';

create type public.app_role as enum ('admin');
