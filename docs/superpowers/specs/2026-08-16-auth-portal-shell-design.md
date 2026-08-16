# Auth + Teacher Portal Shell — Design Spec

**Date:** 2026-08-16
**Scope:** Supabase Auth integration, login page, role-based middleware, teacher portal sidebar shell, placeholder pages
**Implements:** ARCHITECTURE.md §5, §11; DESIGN.md §5, §6 (screens 1, 3, 4–9 placeholders)
**Phase:** Phase 1 prerequisite — every Phase 1 feature (roster, activities, submissions) requires an authenticated teacher session and the portal shell to render inside.

---

## 1. Supabase Client Architecture

Three client utilities in `frontend/lib/supabase/`, following the official `@supabase/ssr` pattern for Next.js App Router.

### `client.ts` — Browser client

Created via `createBrowserClient()` from `@supabase/ssr`. Used in client components (`"use client"`) for auth actions (login, sign out) and future direct reads. Reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from env.

### `server.ts` — Server client

Created via `createServerClient()` from `@supabase/ssr`, using Next.js `cookies()` for session access. Used in server components and route handlers to get the current user, check role, read data. A new instance per request (stateless — the `@supabase/ssr` convention, not a singleton).

### `middleware.ts` — Middleware client helper

Same `createServerClient()` but configured for the middleware context (request/response cookie handling, not the `cookies()` API). Exported as a helper function that the root `middleware.ts` calls — keeps the middleware file focused on routing logic, not Supabase plumbing.

### Why three files

Each runtime context (browser, server component, middleware) has a different cookie-access mechanism. `@supabase/ssr` requires cookies to be wired differently for each. Three small, focused files are clearer than one file with conditional logic.

---

## 2. Middleware & Auth Flow

A single `middleware.ts` at the frontend root (`frontend/middleware.ts`). All auth enforcement lives here — route group layouts do zero auth checking. This follows ARCHITECTURE.md §11's explicit guidance: "enforcing role separation once in middleware rather than scattering checks through components."

### Request flow

```
Request comes in
  │
  ├─ 1. Refresh session (required by @supabase/ssr — keeps cookies alive)
  │
  ├─ 2. Is this a public route? (/login, static assets, /_next, /favicon.ico)
  │     → Yes: pass through, no further checks
  │
  ├─ 3. Get user from refreshed session
  │     → No user (unauthenticated): redirect to /login
  │
  ├─ 4. User is authenticated — read role from user_metadata.role
  │
  ├─ 5. Is user on /login?
  │     → Yes: redirect to their portal landing
  │         teacher → /dashboard
  │         parent  → /progress (Phase 2 — during Phase 1, parent
  │                    layout renders a "coming soon" holding page)
  │
  ├─ 6. Route-role match check:
  │     → Teacher hitting teacher routes: pass through ✓
  │     → Parent hitting parent routes: pass through ✓
  │     → Wrong role for route group: redirect to own portal landing
  │
  └─ 7. No role in metadata (edge case):
        → Sign out, redirect to /login
```

### Route matching

The middleware `config.matcher` excludes static files and Next.js internals:

```ts
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### Role detection

Role is stored in `user.user_metadata.role`, set at account creation time by the `handle_new_user()` trigger in `supabase/migrations/0002_identity.sql`. The middleware reads it directly from the JWT — no database query needed.

### Path-to-role mapping

Explicit static lists, not regex or dynamic patterns:

```ts
const teacherRoutes = ['/dashboard', '/roster', '/activities', '/settings'];
const parentRoutes = ['/progress', '/upload'];
```

Next.js route groups strip the parenthesized prefix from URLs, so actual URLs are `/dashboard`, `/roster`, etc. — not `/(teacher)/dashboard`.

---

## 3. Route Groups & Layout Structure

### File structure

```
frontend/app/
├── layout.tsx              ← root layout (fonts, CSS, providers)
├── page.tsx                ← root "/" — server redirect to /login or /dashboard
├── login/
│   └── page.tsx            ← login form (public)
├── (teacher)/
│   ├── layout.tsx          ← sidebar + content wrapper (UI only, no auth)
│   ├── dashboard/
│   │   └── page.tsx        ← teacher landing page (placeholder)
│   ├── roster/
│   │   └── page.tsx        ← placeholder
│   ├── activities/
│   │   └── page.tsx        ← placeholder
│   └── settings/
│       └── page.tsx        ← placeholder
└── (parent)/
    ├── layout.tsx          ← minimal shell (no sidebar — Phase 2)
    └── progress/
        └── page.tsx        ← "coming soon" holding page
```

### Root layout changes

Two additions to the existing `layout.tsx`:

1. **TanStack Query provider** — a `QueryClientProvider` wrapper (client component) wrapping `{children}`. No queries yet, but installing the provider now avoids touching the root layout for every future feature.
2. **Toaster** — shadcn's toast at root level for auth feedback (login errors, sign-out).

### Teacher sidebar — `(teacher)/layout.tsx`

Uses the existing shadcn `sidebar.tsx` component with `SidebarProvider` + `SidebarInset`.

**Navigation items** (DESIGN.md §5):

| Item | Lucide Icon | Path |
|---|---|---|
| Dashboard | `LayoutDashboard` | `/dashboard` |
| Roster | `Users` | `/roster` |
| Activities | `ClipboardList` | `/activities` |
| Settings | `Settings` | `/settings` |

**Footer:** Teacher's name + email (from Supabase session, read in server component, passed down) + Sign Out button.

**Mobile:** shadcn sidebar's built-in collapse → sheet/drawer pattern handles the DESIGN.md §5 spec ("collapsing to a top bar + drawer on mobile") with no custom responsive code.

### Placeholder pages

Each placeholder renders a Poppins heading + a brief empty state. No functionality — they exist so sidebar links work.

### Root `/` page

Server component redirect: authenticated → `/dashboard`, unauthenticated → `/login`.

---

## 4. Login Page

Outside the portal shell — no sidebar, no nav. Standalone page at `app/login/page.tsx`.

### Visual design

- **Page:** `bg` background (`#F7F8F7`)
- **Card:** `surface` white, `rounded-xl`, `shadow-warm` (`rgba(30,40,35,0.06)`) — DESIGN.md §2.4: human-facing surfaces get rounded corners + soft shadow
- **Heading:** "WriteWise" in Poppins (`font-heading`), `brand-600` teal
- **Subheading:** "Sign in to your account" in Inter, `text-secondary`
- **Form fields:** Email + Password, shadcn `Input` + `Label`, `rounded-lg`
- **Submit button:** Full-width, `brand-600` bg, white text, `rounded-lg`, loading spinner on submit
- **No signup link** — teachers are provisioned in the Supabase dashboard (invite-only model)

### Form behavior

- Client component — uses browser Supabase client for `signInWithPassword()`
- On success: `router.push('/dashboard')` — middleware handles role routing
- On failure: inline shadcn `Alert` (destructive variant):
  - `invalid_credentials` → "Invalid email or password."
  - Network/unknown → "Something went wrong. Please try again."
- Submit button disables during request to prevent double-submit

### Excluded

- **Remember me:** Supabase sessions persist by default (cookie-based), so this is already the default behavior.
- **Password reset:** Out of scope. Teachers can reset via the Supabase dashboard during the pilot.
- **OAuth / magic link:** Not needed for the pilot's teacher-only invite model.

---

## 5. Dependencies

New npm packages to install:

| Package | Purpose |
|---|---|
| `@supabase/supabase-js` | Core Supabase client |
| `@supabase/ssr` | Next.js server-side auth (cookie-based sessions) |
| `@tanstack/react-query` | Data-fetching layer (ARCHITECTURE.md §11) — provider installed now, queries come later |

---

## 6. Files Changed

| File | Action | Purpose |
|---|---|---|
| `lib/supabase/client.ts` | NEW | Browser Supabase client |
| `lib/supabase/server.ts` | NEW | Server component Supabase client |
| `lib/supabase/middleware.ts` | NEW | Middleware Supabase client helper |
| `middleware.ts` (frontend root) | NEW | Auth guard + role routing |
| `app/login/page.tsx` | NEW | Login form |
| `app/(teacher)/layout.tsx` | NEW | Teacher sidebar shell |
| `app/(teacher)/dashboard/page.tsx` | NEW | Teacher landing (placeholder) |
| `app/(teacher)/roster/page.tsx` | NEW | Placeholder |
| `app/(teacher)/activities/page.tsx` | NEW | Placeholder |
| `app/(teacher)/settings/page.tsx` | NEW | Placeholder |
| `app/(parent)/layout.tsx` | NEW | Minimal parent shell (no sidebar yet) |
| `app/(parent)/progress/page.tsx` | NEW | "Coming soon" holding page for Phase 1 |
| `components/providers.tsx` | NEW | TanStack Query provider wrapper |
| `app/layout.tsx` | MODIFY | Add providers wrapper + Toaster |
| `app/page.tsx` | MODIFY | Root redirect logic |
| `package.json` | MODIFY | Add 3 dependencies |

---

## 7. Verification Plan

Per AGENTS.md §5 — frontend-only change, no automated test suite. Manual QA:

1. Unauthenticated access to `/dashboard`, `/roster`, `/activities`, `/settings` → all redirect to `/login`
2. Login with valid teacher credentials → lands on `/dashboard`
3. Login with invalid credentials → inline error, no redirect
4. Sidebar nav → each item loads correct page with active highlight
5. Sign out → session cleared, redirect to `/login`, protected routes inaccessible
6. Role guard → parent account on teacher route redirects to parent portal
7. Session persistence → close/reopen tab, still authenticated
8. Mobile sidebar → resize to mobile, sidebar collapses to drawer

Lint/type checks: `npx eslint .` and `npx tsc --noEmit` must pass clean.