# Sabi — Phase 1 Build Roadmap

Source: uploaded mockup (Sabi_Marketplace_Foundation_UI_Mockup.png) + PROJECT_SABI brief.

## Done / In progress
- [x] Lovable Cloud enabled (auth: email + Google + Apple + Lovable)
- [x] Design system tokens in src/styles.css (forest green, burnt orange, coral, gold, cream)

## Backend
- [x] Migration: profiles, workspaces (creative|brand), projects, proposals, saved_projects + RLS + grants + demo seed
- [x] Demo seed uses generated image asset URLs

## Public pages
- [x] / — homepage (hero, categories, featured brands, featured creatives, how it works, trust, footer)
- [x] /auth — Sign Up / Login (split layout, desktop hero panel, mobile stack, password visibility, forgot password)
- [x] /brands — brand discovery (filters, search, sort)
- [x] /creatives — creative discovery
- [x] /projects — browse available projects
- [x] /project/$id — project brief + proposal submission (sign-in required to submit)

## Authenticated (under _authenticated)
- [x] /workspace — Choose Your Workspace (I'm a Creative / I'm a Brand, workspace switching)
- [x] /dashboard — creative + brand dashboard variants (stats from DB, switcher sidebar)
- [x] /post-project — 4-step brief wizard (Details → Deliverables → Budget & timeline → Review & publish)
- [x] Brand: Posted Projects, Proposals Received, My Brand profile
- [x] Creative: My Profile, Available Projects, My Proposals
- [x] Messages / Payments / Hired Creatives — Phase 2/3 stubs with clear empty states
- [x] /reset-password — recovery page

## Assets
- [x] Logo, hero, 4 brand photos, 4 creative portraits, dashboard banner, event photo

## Verification
- [x] Build log clean, Playwright walkthrough of core flows

## Phase 2 (completed in this pass)
- [x] Contracts, messaging, deliverables, reviews, notifications, payments ledger, reports, admin (see SETUP.md)
- [x] Row-level security + column grants + workflow functions, verified by drizzle/tests/marketplace_flow.test.sql
- [ ] Live browser walkthrough on the deployed Supabase project
- [ ] Payment provider integration (blocked on written provider capabilities)
