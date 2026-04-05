# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyC Admin Portal — a React/TypeScript admin dashboard for a Pilates gym (MYC). Features student management, class scheduling, coach directories, analytics dashboards, and AI-powered student progress analysis via Google Gemini. All UI text is in **Spanish**.

## Build & Dev Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Vite, port 3000, host 0.0.0.0)
npm run build        # Production build
npm run preview      # Preview production build
```

No test runner or linter is configured.

## Environment Variables

Create `.env.local` in project root:
```
GEMINI_API_KEY=<google-gemini-api-key>
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
VITE_SUPABASE_SERVICE_KEY=<supabase-service-key>
```

Note: `GEMINI_API_KEY` is exposed as `process.env.API_KEY` via Vite's `define` config. Supabase vars use the `VITE_` prefix and are accessed via `import.meta.env`.

## Architecture

### Single-Page App with Tab Navigation

The app is a **monolithic SPA** — nearly all UI lives in `App.tsx` (~1900 lines). There is no router; navigation is state-driven via a sidebar that switches between four views:

- **Panel General (Dashboard)** — KPIs, attendance charts, period-based filtering (week/month/semester/year)
- **Alumnos (Students)** — Two sub-tabs: progress+evaluations (with AI analysis) and personal info CRUD
- **Clases (Classes)** — Two sub-views: schedule management and historical analytics
- **Entrenadores (Coaches)** — Directory cards with schedule calendar modal, plus personal info CRUD

Authentication is a placeholder — any non-empty credentials pass the login form.

### Data Layer (`services/`)

- **`supabaseClient.ts`** — Exports two Supabase clients: `supabase` (anon key, respects RLS) and `supabaseAdmin` (service key, bypasses RLS for admin operations like creating auth users)
- **`dataService.ts`** — CRUD functions for all entities (alumnos, entrenadores, clases, reservas, pagos, evaluaciones). Trainer creation uses `supabaseAdmin.auth.admin.createUser()` with rollback on failure. DB field `celular` is mapped to TypeScript field `telefono`.
- **`geminiService.ts`** — `analyzeStudentProgress()` sends student data + evaluations + reservations to Gemini (`gemini-3-flash-preview`) and returns a Spanish-language progress report (max 100 words).
- **`mockData.ts`** — Generates ~2 years of realistic demo reservations, payments, coach schedules, and evaluations for development/testing.

### Data Model (`types.ts`)

Six core entities mapping to Supabase tables:
- **Alumno** (student) — name, contact, pathology, available classes, registration/expiry dates
- **Entrenador** (coach) — name, contact, specialty (Reformer, Rehabilitación, etc.)
- **Clase** (class) — title, trainer ref, datetime, max capacity
- **Reserva** (booking) — student+class refs, attendance confirmed/attended, class type
- **EvaluacionFisica** (physical assessment) — body metrics (weight, height, fat%, muscle%, perimeters, BMI)
- **Pago** (payment) — amount in COP, class quantity, Wompi transaction ID, status (PENDING/APPROVED/REJECTED)

### Tech Stack

- **React 19** with hooks for state management (useState, useEffect, useMemo, useCallback)
- **Vite 6** build tool with path alias `@/*` → project root
- **Tailwind CSS** via CDN with custom `pilates` color palette (primary: `#42a699`)
- **Recharts** for charts (Line, Bar, Pie, Area)
- **Lucide React** for icons
- **Supabase** for PostgreSQL database + auth
- **Google GenAI SDK** for Gemini AI analysis

## Key Patterns

- All state management is local React state — no Redux, Zustand, or context providers
- Data is fetched in parallel via `Promise.all()` in useEffect on mount
- Expensive computations (filtering, analytics) use `useMemo`
- Modals are inline components (no modal library) with overlay pattern
- Responsive: mobile sidebar overlay, grids scale from 1→4 columns via `md:`/`lg:` breakpoints
- Date formatting uses Spanish locale throughout
