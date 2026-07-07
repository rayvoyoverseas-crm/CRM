# Rayvoy Overseas — CRM

## Original Problem Statement
Build an internal CRM for Rayvoy Overseas (study-abroad consultancy). Support a Study Abroad pipeline (New Lead → Counsellor Contacted → DNP → Shortlisting → Docs Received → Prospect → Ready to Application → Application → Offer Letter → Ready to Deposit → Deposit → Visa → Enrollment), plus separate pipelines for Accommodation and Education Loan. Capture leads from the rayvoyoverseas.com website. Provide an admin CRM with full access + counsellors with limited access (only their assigned leads). Track monthly/yearly targets and stage-to-stage conversion analytics.

## User Personas
- **Admin (Founder)** — full access to all leads, team, targets, analytics, integrations.
- **Counsellor** — sees only assigned leads; can update stage, add notes.

## Architecture
- **Backend**: FastAPI + MongoDB (motor). JWT auth via httpOnly cookies. Roles: `admin`, `counsellor`.
- **Frontend**: React 19 + Tailwind + Shadcn/UI + Recharts. Fonts: Cabinet Grotesk (display) + Manrope (body). Terracotta (#C05B43) + Navy (#1B365D) palette on warm stone background.
- **Integrations**: Website webhook `POST /api/webhook/website-lead` with `X-API-Key` header.

## Implemented (2026-02-06)
- JWT auth (login / logout / me) with httpOnly cookies, bcrypt hashing, admin seeded on startup.
- Users CRUD (admin only) for team management.
- Leads CRUD with 3 pipelines (`study_abroad`, `accommodation`, `loan`) and stage-specific short codes.
- Kanban board + list view for each pipeline.
- Lead detail page with editable fields, stage/assignment change, activity timeline & notes.
- Website Leads inbox (unreviewed queue) + review action + auto-assign.
- Analytics: funnel, stage-to-stage conversion table, monthly trend bar chart, counsellor performance leaderboard, filters by pipeline / days / counsellor / source.
- Targets page (monthly & yearly leads / deposits / enrollments).
- Integrations page: shows webhook endpoint, API key, cURL sample.
- Role-based route guarding (Team / Targets / Settings admin-only).

## Test Credentials
- Admin: `admin@rayvoyoverseas.com` / `Admin@Rayvoy2026`
- Webhook API key: `rvy_webhook_c9f2e8a4b1d64752`

## Prioritized Backlog
- **P1** — Drag-and-drop stage transitions on Kanban board (currently via dropdown).
- **P1** — CSV export & import of leads.
- **P1** — Email/WhatsApp notifications when a lead is assigned or moves stages.
- **P2** — Attach documents/files to leads (offer letter, passport).
- **P2** — Progress bars on Targets vs actuals.
- **P2** — Global search + saved filters.
- **P3** — Country / intake reporting; automated follow-up reminders.

## Next Tasks
1. Add drag-and-drop with `@dnd-kit/core`.
2. Wire targets to actual counts (progress bars).
3. Add CSV export on each pipeline.
