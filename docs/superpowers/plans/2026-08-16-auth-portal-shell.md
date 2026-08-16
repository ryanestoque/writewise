# Auth + Teacher Portal Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up Supabase Auth, build a login page, add role-based middleware, and create the teacher portal shell with sidebar navigation — establishing the authenticated foundation every Phase 1 feature builds on.

**Architecture:** Middleware-heavy approach — all auth enforcement (session refresh, login redirect, role gating) lives in a single Next.js middleware file. Route group layouts are purely UI. Supabase Auth sessions are managed via cookie-based `@supabase/ssr`. TanStack Query provider is installed at root for future data-fetching.

**Tech Stack:** Next.js 16, React 19, `@supabase/ssr`, `@supabase/supabase-js`, `@tanstack/react-query`, shadcn/ui (sidebar, alert, toast, button, input, label, spinner), Tailwind CSS v4, TypeScript strict mode.

**Spec:** `docs/superpowers/specs/2026-08-16-auth-portal-shell-design.md`

## Global Constraints

- TypeScript `strict: true` — do not relax.
- Use `@/*` path alias for all imports (maps to `frontend/*` per `tsconfig.json`).
- shadcn/ui components are imported from `@/components/ui/*` — never rebuild them.
- Fonts: Poppins (`font-heading`) for headings, Inter (`font-sans`) for body. Already configured in root `layout.tsx`.
- Color tokens: `brand-600` (#1B6B63) for primary, `brand-700` (#145049) for hover, `brand-100` (#E4F1EF) for subtle backgrounds. Use CSS variable tokens (`--primary`, `--secondary`, etc.) via Tailwind, not raw hex.
- Env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are already in `.env.local` (see `.env.local.example`).
- No automated test suite for frontend (AGENTS.md §5, TESTING.md §7). Manual QA only.
- All interactive elements must have unique, descriptive `id` attributes.
- Conventional Commits for all commit messages.

---

### Task 1: Install Dependencies

**Files:**
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: nothing
- Produces: `@supabase/supabase-js`, `@supabase/ssr`, `@tanstack/react-query` available as importable packages

- [ ] **Step 1: Install the three packages**

```bash
cd frontend
npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query
```

- [ ] **Step 2: Verify installation**

```bash
cd frontend
npx tsc --noEmit
```

Expected: PASS (no new type errors from the dependencies themselves)

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: add supabase-ssr, supabase-js, and tanstack-query dependencies"
```

---

### Task 2: Supabase Client Utilities

**Files:**
- Create: `frontend/lib/supabase/client.ts`
- Create: `frontend/lib/supabase/server.ts`
- Create: `frontend/lib/supabase/middleware.ts`

**Interfaces:**
- Consumes: `@supabase/ssr`, `@supabase/supabase-js`, env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Produces:
  - `createClient()` from `lib/supabase/client.ts` — returns `SupabaseClient` for browser use
  - `createClient()` from `lib/supabase/server.ts` — returns `Promise<SupabaseClient>` for server components
  - `createClient(request: NextRequest)` from `lib/supabase/middleware.ts` — returns `{ supabase: SupabaseClient, response: NextResponse }`

- [ ] **Step 1: Create browser client**

Create `frontend/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server client**

Create `frontend/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create middleware client helper**

Create `frontend/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function createClient(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return { supabase, response };
}
```

- [ ] **Step 4: Verify types compile**

```bash
cd frontend
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/supabase/
git commit -m "feat: add supabase client utilities for browser, server, and middleware"
```

---

### Task 3: Auth Middleware

**Files:**
- Create: `frontend/middleware.ts`

**Interfaces:**
- Consumes: `createClient(request)` from `lib/supabase/middleware.ts`
- Produces: Middleware that intercepts all non-static requests, refreshes sessions, and enforces auth/role routing. All downstream route groups can assume the user is authenticated and authorized.

- [ ] **Step 1: Create the middleware**

Create `frontend/middleware.ts`:

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/middleware";

// Routes that don't require authentication
const publicRoutes = ["/login"];

// Route-to-role mapping (Next.js strips the route group prefix from URLs)
const teacherRoutes = ["/dashboard", "/roster", "/activities", "/settings"];
const parentRoutes = ["/progress"];

// Default landing pages per role
const roleLanding: Record<string, string> = {
  teacher: "/dashboard",
  parent: "/progress",
};

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function getRouteRole(pathname: string): string | null {
  if (teacherRoutes.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return "teacher";
  }
  if (parentRoutes.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return "parent";
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { supabase, response } = await createClient(request);
  const { pathname } = request.nextUrl;

  // Always refresh the session — required by @supabase/ssr
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userRole = user?.user_metadata?.role as string | undefined;

  // Unauthenticated user on a protected route → login
  if (!user && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated user on /login → redirect to their portal
  if (user && isPublicRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = roleLanding[userRole ?? ""] ?? "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated user — check role matches route
  if (user && userRole) {
    const routeRole = getRouteRole(pathname);

    // Route belongs to a different role → redirect to own portal
    if (routeRole && routeRole !== userRole) {
      const url = request.nextUrl.clone();
      url.pathname = roleLanding[userRole] ?? "/login";
      return NextResponse.redirect(url);
    }
  }

  // Authenticated user with no role metadata (edge case) → sign out
  if (user && !userRole && !isPublicRoute(pathname)) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Image files
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Verify types compile**

```bash
cd frontend
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/middleware.ts
git commit -m "feat: add auth middleware with role-based route protection"
```

---

### Task 4: Root Layout Providers + Root Page Redirect

**Files:**
- Create: `frontend/components/providers.tsx`
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/app/page.tsx`

**Interfaces:**
- Consumes: `@tanstack/react-query` `QueryClient` + `QueryClientProvider`, `Toaster` from `@/components/ui/toast`
- Produces:
  - `Providers` component wrapping children with `QueryClientProvider` and `Toaster`
  - Root `/` page that redirects authenticated users to `/dashboard`, unauthenticated to `/login`

- [ ] **Step 1: Create the providers wrapper**

Create `frontend/components/providers.tsx`:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Update root layout to use Providers**

Modify `frontend/app/layout.tsx` — wrap `{children}` with the `Providers` component:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Inter, Poppins } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "WriteWise",
  description: "Cursive Handwriting Assessment and Progress Monitoring System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", inter.variable, poppins.variable, "font-sans")}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Update root page to redirect**

Replace `frontend/app/page.tsx` content:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const role = user.user_metadata?.role as string | undefined;
    if (role === "parent") {
      redirect("/progress");
    }
    redirect("/dashboard");
  }

  redirect("/login");
}
```

- [ ] **Step 4: Verify types compile**

```bash
cd frontend
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/providers.tsx frontend/app/layout.tsx frontend/app/page.tsx
git commit -m "feat: add query/toast providers and root page redirect"
```

---

### Task 5: Login Page

**Files:**
- Create: `frontend/app/login/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/client.ts`, shadcn components (`Button`, `Input`, `Label`, `Alert`, `AlertDescription`, `Spinner`), `Card` from `@/components/ui/card`
- Produces: A login page at `/login` with email/password form, error handling, and redirect on success

- [ ] **Step 1: Create the login page**

Create `frontend/app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { CircleAlertIcon } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message === "Invalid login credentials") {
          setError("Invalid email or password.");
        } else {
          setError("Something went wrong. Please try again.");
        }
        setIsLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm shadow-[var(--shadow-warm)]">
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-2xl text-primary">
            WriteWise
          </CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            {error && (
              <Alert variant="destructive" id="login-error">
                <CircleAlertIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            <Button
              id="login-submit"
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? <Spinner className="mr-2" /> : null}
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd frontend
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: Manual QA — login page renders**

Open `http://localhost:3000/login` in the browser. Verify:
- Card is centered on the page with the correct teal heading
- Email and password fields render
- Submit button says "Sign in"
- Entering wrong credentials shows "Invalid email or password." error

- [ ] **Step 4: Commit**

```bash
git add frontend/app/login/
git commit -m "feat: add login page with email/password auth"
```

---

### Task 6: Teacher Sidebar Layout + Placeholder Pages

**Files:**
- Create: `frontend/components/teacher-sidebar.tsx`
- Create: `frontend/app/(teacher)/layout.tsx`
- Create: `frontend/app/(teacher)/dashboard/page.tsx`
- Create: `frontend/app/(teacher)/roster/page.tsx`
- Create: `frontend/app/(teacher)/activities/page.tsx`
- Create: `frontend/app/(teacher)/settings/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/server.ts`, `createClient()` from `lib/supabase/client.ts`, shadcn sidebar components (`SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarInset`, `SidebarTrigger`)
- Produces: Authenticated teacher shell with persistent sidebar navigation and four clickable placeholder pages

- [ ] **Step 1: Create the teacher sidebar component**

Create `frontend/components/teacher-sidebar.tsx`:

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboardIcon,
  UsersIcon,
  ClipboardListIcon,
  SettingsIcon,
  LogOutIcon,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Roster", href: "/roster", icon: UsersIcon },
  { title: "Activities", href: "/activities", icon: ClipboardListIcon },
  { title: "Settings", href: "/settings", icon: SettingsIcon },
];

interface TeacherSidebarProps {
  user: {
    fullName: string;
    email: string;
  };
}

export function TeacherSidebar({ user }: TeacherSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="font-heading text-lg font-semibold text-primary">
            WriteWise
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href} id={`nav-${item.title.toLowerCase()}`}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <SidebarSeparator />
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex flex-col truncate">
            <span className="truncate text-sm font-medium">
              {user.fullName}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </div>
          <Button
            id="sign-out"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleSignOut}
          >
            <LogOutIcon />
            <span>Sign out</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
```

- [ ] **Step 2: Create the teacher layout**

Create `frontend/app/(teacher)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TeacherSidebar } from "@/components/teacher-sidebar";
import { Separator } from "@/components/ui/separator";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware should have caught this, but guard defensively
  if (!user) {
    redirect("/login");
  }

  const fullName =
    (user.user_metadata?.full_name as string) || user.email || "Teacher";
  const email = user.email || "";

  return (
    <SidebarProvider>
      <TeacherSidebar user={{ fullName, email }} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Step 3: Create the dashboard page (teacher landing)**

Create `frontend/app/(teacher)/dashboard/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — WriteWise",
};

export default function DashboardPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Welcome to WriteWise. Your class overview will appear here.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Create the roster placeholder page**

Create `frontend/app/(teacher)/roster/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roster — WriteWise",
};

export default function RosterPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold">Roster</h1>
      <p className="mt-2 text-muted-foreground">
        Manage your class roster here. Coming soon.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Create the activities placeholder page**

Create `frontend/app/(teacher)/activities/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activities — WriteWise",
};

export default function ActivitiesPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold">Activities</h1>
      <p className="mt-2 text-muted-foreground">
        Create and manage handwriting activities here. Coming soon.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Create the settings placeholder page**

Create `frontend/app/(teacher)/settings/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings — WriteWise",
};

export default function SettingsPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-muted-foreground">
        Account and profile settings. Coming soon.
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Verify types compile**

```bash
cd frontend
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/components/teacher-sidebar.tsx frontend/app/(teacher)/
git commit -m "feat: add teacher sidebar layout and placeholder pages"
```

---

### Task 7: Parent Portal Shell (Minimal)

**Files:**
- Create: `frontend/app/(parent)/layout.tsx`
- Create: `frontend/app/(parent)/progress/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/server.ts`
- Produces: Minimal parent shell with a "coming soon" holding page at `/progress`, so the middleware's parent redirect doesn't 404

- [ ] **Step 1: Create the parent layout**

Create `frontend/app/(parent)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware should have caught this, but guard defensively
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center p-6">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create the parent progress holding page**

Create `frontend/app/(parent)/progress/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Progress — WriteWise",
};

export default function ProgressPage() {
  return (
    <div className="text-center">
      <h1 className="font-heading text-2xl font-semibold">
        Parent Portal
      </h1>
      <p className="mt-2 text-muted-foreground">
        The parent portal is coming soon. You&apos;ll be able to view your
        child&apos;s handwriting progress here.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verify types compile**

```bash
cd frontend
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/app/(parent)/
git commit -m "feat: add minimal parent layout with progress holding page"
```

---

### Task 8: Lint, Full Verification & Final Commit

**Files:**
- No new files — verification only

**Interfaces:**
- Consumes: all previous tasks
- Produces: verified, lint-clean, type-safe codebase

- [ ] **Step 1: Run ESLint**

```bash
cd frontend
npx eslint .
```

Expected: PASS — no errors (warnings are acceptable if pre-existing)

- [ ] **Step 2: Run TypeScript type check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: Manual QA — full flow**

Start the dev server (`npm run dev`) and verify each item:

1. **`http://localhost:3000/`** → redirects to `/login` (unauthenticated)
2. **`http://localhost:3000/dashboard`** → redirects to `/login` (unauthenticated)
3. **`http://localhost:3000/login`** → login card renders, centered, teal "WriteWise" heading
4. **Submit wrong credentials** → "Invalid email or password." alert appears
5. **Submit correct credentials** (provision a teacher in Supabase dashboard first: email/password with `raw_user_meta_data = { "role": "teacher", "full_name": "Test Teacher" }`) → redirects to `/dashboard`
6. **Sidebar** → four nav items (Dashboard, Roster, Activities, Settings), click each one, correct page loads with active highlight
7. **Teacher name/email** → visible in sidebar footer
8. **Sign out** → redirected to `/login`, can't access `/dashboard`
9. **`http://localhost:3000/login`** while authenticated → redirects to `/dashboard`
10. **Mobile** → resize browser to mobile width, sidebar collapses to sheet/drawer

- [ ] **Step 4: Fix any issues found in QA**

Address any visual, routing, or type issues discovered during manual testing.

- [ ] **Step 5: Final commit if any fixes were made**

```bash
git add -A
git commit -m "fix: address QA feedback for auth and portal shell"
```
