# Snake-Oil-or-Gold Check

> Neutral, AI-powered reality-check for online coachings, high-ticket programs, and similar offers. Submit a link, get a defensible score with a clear tendency: **Go**, **Vorsicht**, or **Lieber lassen**.

**Status:** Pre-MMP design phase. v0.1 = Full LOW (Free-Shot + 3-Shot + 10-Shot). HIGH-Tier (Single-Check / Vergleichscheck / Retainer) docks onto same backend in v0.2/v0.3.

## Docs

| Doc | Purpose |
|-----|---------|
| [Design Spec (MMP)](docs/superpowers/specs/2026-05-18-snakeoil-check-mmp-design.md) | Architecture, components, data flow, success criteria |
| [Scoring Framework](docs/scoring-framework.md) | Criteria, weights, thresholds, prompt strategy, eval set |
| [Roadmap](docs/roadmap.md) | v0.1 → v0.2 → v0.3 milestones |
| [Decisions Log](docs/decisions.md) | D1..Dn — architecture decisions with rationale |
| [CLAUDE.md](CLAUDE.md) | Working rules for Claude Code sessions in this repo |

## Quick Facts

- **Owner:** German Rauhut (`neckarshore-ai/snakeoil-check`)
- **Stack:** Next.js 16 App Router, Vercel, Stripe, Neon Postgres, Drizzle, Resend, Vercel AI Gateway (Claude Sonnet 4.5), Vercel Workflow
- **Hosting:** Vercel (Fluid Compute)
- **Target Launch:** v0.1 in 6-8 Wochen

## Source Material

Original brainstorming and product packages: Obsidian Vault `Idea - Snakeoil or Gold 25-12/`. Marketing post draft: same folder.
