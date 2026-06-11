# Claude Code Instructions — snakeoil-check

## Repo Context

- **Project:** Snake-Oil-or-Gold Check — MMP for AI-powered online-offer review service
- **GitHub home:** `neckarshore-ai/snakeoil-check`
- **Local path:** `~/Developer/projects/neckarshore-mmps/snakeoil-check/`
- **Domain (TBD):** `snakeoilcheck.com` or similar (decided before Stripe Checkout integration, v0.1 build phase 4)
- **Brand:** Neckarshore.ai portfolio Mini-Geldmaschine. Marketing tone: skeptical, dry, honest — Western/RDR2 aesthetic per marketing brief.

## Working Directory Rule

This repo lives at `~/Developer/projects/neckarshore-mmps/snakeoil-check/`. Every Bash command must start with:

```bash
cd ~/Developer/projects/neckarshore-mmps/snakeoil-check && ...
```

The Claude Code harness resets `cwd` after every Bash call. Unscoped commands risk writing to the wrong repo.

## Stack (locked in design doc)

| Layer | Tech |
|-------|------|
| Frontend + API | Next.js 16 App Router |
| Hosting | Vercel (Fluid Compute) |
| DB | Neon Postgres (Vercel Marketplace) |
| ORM | Drizzle |
| Auth | E-Mail Magic-Link (custom, no provider) |
| Payments | Stripe Payment-Intent + Webhooks |
| Email | Resend (Vercel Marketplace) |
| AI | Vercel AI Gateway → `anthropic/claude-sonnet-4.5` |
| Background Work | Vercel Workflow (DevKit) |
| Scraping | `fetch` + `cheerio` |
| Tests | Vitest + Playwright |
| Config | `vercel.ts` |

## Rules

- Mobile-first responsive design
- Lighthouse 95+ target on landing pages
- Self-hosted fonts (DSGVO)
- Analytics: Vercel Web Analytics only (cookieless)
- No CMS
- Commit after each logical block
- TypeScript only — strict mode
- Use exact dependency versions (no `^`, no `~`); install with `--save-exact` or `pnpm add --save-exact`
- Drizzle migrations versioned, never edit applied migrations
- **AI calls:** always via Vercel AI Gateway (string `"anthropic/claude-sonnet-4.5"`), never via `@ai-sdk/anthropic` direct — keeps provider-switch capability

## CI

- CI (`.github/workflows/ci.yml`) triggers **only** on `pull_request.branches: [main]` and `push` to `main`. This is deliberate (single-base model) — it keeps CI from firing on every intermediate branch.
- **Stacked-PR consequence:** a PR whose base is *another feature branch* (not `main`) will **not** run CI until that base merges to `main` and the child is rebased onto `main`. This is by design for the current solo-dev shape; do **not** broaden the trigger (e.g. to `pull_request:` with no branch filter) — that would run the full suite on every link of every stack.
- **Cascade-on-merge expectation:** after a stacked PR's base merges to `main`, **rebase the child onto `main`** so its CI fires before you merge it. Don't merge a child whose CI never ran against `main`.
- A future multi-author workflow may justify broader triggers; revisit then. Historical context: stacked PRs #10/#11/#12 (2026-05-20) didn't see CI until their bases caught up — acceptable for this shape (open_item `T-NEW-CI-TRIGGER-EXTEND-STACKED-PRS`).

## Definition of Done

- Tests pass (Vitest unit + Playwright E2E for critical flows)
- Lighthouse 95+ desktop + mobile on landing
- Build green (`pnpm build`)
- Lint green (`pnpm lint`)
- Type-check green (`pnpm typecheck`)
- Mobile + Desktop visual check
- No browser console errors
- Committed to feature branch, PR opened
- User decides when manual test cycle is "PASS"

## Out of Scope (v0.1)

- Account self-service (password reset, profile edit) — magic-link only
- Refund automation — manual via Stripe Dashboard
- Internationalization — DE-only at launch, EN in v0.2
- Mobile apps — web-only
- Real-time updates — email + "refresh" page pattern only

## Session Type Constraints

- This repo is **implementation territory** for `bob` (backend) and `linus` (frontend) agents
- Planning/Brainstorming lives in this folder's `docs/` — owned by MASCHIN
- See `docs/decisions.md` before changing architecture
