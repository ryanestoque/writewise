# Teacher Account Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the dedicated Teacher Account Settings page at `/settings` with profile management (Full Name, School / Institution, read-only verified Email) and secure in-session password updates with classroom security re-authentication.

**Architecture:** A clean, responsive stacked-card layout (`ProfileSettingsCard` and `SecuritySettingsCard`) in `app/(teacher)/settings/page.tsx`. Profile state synchronizes across both `public.teacher` in Postgres and Supabase Auth `user_metadata`, immediately updating the layout and sidebar via `router.refresh()`. In-session password updates re-authenticate using current credentials via `signInWithPassword` before applying the change via `updateUser({ password })`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (strict), Supabase Auth & Postgres (RLS), Tailwind CSS, Radix / shadcn/ui components (`Card`, `Input`, `Label`, `Button`), Lucide React icons, and Sonner toasts.

**Spec:** [`docs/superpowers/specs/2026-09-09-teacher-account-settings-design.md`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/docs/superpowers/specs/2026-09-09-teacher-account-settings-design.md)

## Global Constraints

- **TypeScript:** `strict: true` must pass with zero errors (`npx tsc --noEmit`).
- **ESLint:** Code must pass without lint warnings or errors (`npx eslint .`).
- **Security & RLS:** No bypassing RLS from application client code. No raw image bytes or student PII in logs.
- **Error Responses:** Frontend branches on `error.code` where applicable, with graceful fallback toasts.
- **Design Tokens:** Follow warm educational palette (`bg-card`, `border-border`, `shadow-warm`, `font-heading`, `rounded-2xl`).

---

### Task 1: Database Migration & Schema Types

**Files:**
- Create: `supabase/migrations/0016_teacher_settings.sql`
- Modify: `frontend/types/database.ts:345-364`

**Interfaces:**
- Consumes: `public.teacher` table from `0002_identity.sql` and trigger from `0015_parent_invite_status.sql`.
- Produces: `school_name: string | null` column on `public.teacher`, RLS update policy for teachers, and updated TypeScript database definitions.

- [ ] **Step 1: Create the SQL migration file**

Create `supabase/migrations/0016_teacher_settings.sql`:
```sql
-- migration: 0016_teacher_settings.sql
-- Description: Add school_name column to teacher table, allow teachers to update own profile,
-- and extend handle_new_user trigger to synchronize school_name from raw_user_meta_data.

-- 1. Add school_name to public.teacher
alter table public.teacher
  add column if not exists school_name text;

-- 2. Add update policy for teacher on own profile
create policy "teacher can update own profile"
  on public.teacher for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 3. Extend handle_new_user trigger function to persist school_name
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
  user_name text;
  user_school text;
  is_confirmed boolean;
begin
  user_role := new.raw_user_meta_data ->> 'role';
  user_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));
  user_school := new.raw_user_meta_data ->> 'school_name';
  is_confirmed := (new.confirmed_at is not null or new.email_confirmed_at is not null);

  if user_role = 'teacher' then
    insert into public.teacher (id, full_name, email, school_name)
    values (new.id, user_name, new.email, user_school)
    on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        school_name = coalesce(excluded.school_name, public.teacher.school_name);
  elsif user_role = 'parent' then
    insert into public.parent (id, full_name, email)
    values (new.id, user_name, new.email)
    on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email;

    if new.raw_user_meta_data ->> 'student_id' is not null then
      insert into public.student_parent (student_id, parent_id)
      values ((new.raw_user_meta_data ->> 'student_id')::uuid, new.id)
      on conflict do nothing;

      -- Update student parent_status on link
      update public.student
      set parent_status = case when is_confirmed then 'active' else 'pending' end
      where id = (new.raw_user_meta_data ->> 'student_id')::uuid;
    end if;

    -- If parent is confirmed, ensure all linked students reflect 'active' status
    if is_confirmed then
      update public.student
      set parent_status = 'active'
      where id in (
        select student_id from public.student_parent where parent_id = new.id
      );
    end if;
  end if;

  return new;
end;
$$;
```

- [ ] **Step 2: Update TypeScript database types in `frontend/types/database.ts`**

Update `teacher` in `frontend/types/database.ts`:
```typescript
      teacher: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          school_name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          school_name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          school_name?: string | null
        }
        Relationships: []
      }
```

- [ ] **Step 3: Run static type checks to verify type definitions**

Run in `frontend`:
```bash
npx tsc --noEmit
```
Expected: PASS with zero errors.

- [ ] **Step 4: Commit Task 1 changes**

```bash
git add supabase/migrations/0016_teacher_settings.sql frontend/types/database.ts
git commit -m "feat(db): add teacher school_name column and profile update RLS policy"
```

---

### Task 2: Profile Settings Card Component

**Files:**
- Create: `frontend/components/settings/profile-settings-card.tsx`

**Interfaces:**
- Consumes:
  - `initialFullName: string`
  - `initialSchoolName: string`
  - `email: string`
- Produces: `ProfileSettingsCard` component that handles updating teacher name and school affiliation with loading and toast states.

- [ ] **Step 1: Implement `ProfileSettingsCard`**

Create `frontend/components/settings/profile-settings-card.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Lock, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface ProfileSettingsCardProps {
  initialFullName: string;
  initialSchoolName: string;
  email: string;
}

export function ProfileSettingsCard({
  initialFullName,
  initialSchoolName,
  email,
}: ProfileSettingsCardProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [schoolName, setSchoolName] = useState(initialSchoolName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = fullName.trim() !== initialFullName.trim() || schoolName.trim() !== initialSchoolName.trim();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = fullName.trim();
    const trimmedSchool = schoolName.trim();

    if (!trimmedName) {
      setNameError("Full name is required.");
      return;
    }
    setNameError(null);

    setIsSaving(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Unable to retrieve authenticated session.");
      }

      // 1. Sync auth metadata
      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          school_name: trimmedSchool || null,
        },
      });
      if (authUpdateError) throw authUpdateError;

      // 2. Update relational teacher table
      const { error: dbUpdateError } = await supabase
        .from("teacher")
        .update({
          full_name: trimmedName,
          school_name: trimmedSchool || null,
        })
        .eq("id", user.id);

      if (dbUpdateError) throw dbUpdateError;

      toast.success("Profile updated successfully.");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update profile.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-warm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <User className="size-5" />
          </div>
          <div>
            <CardTitle className="font-heading text-lg font-semibold">Personal Information</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Update your display name and school affiliation across your classroom.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <form onSubmit={handleSave}>
        <CardContent className="space-y-4 pt-2">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="full-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Full Name
            </Label>
            <Input
              id="full-name"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (nameError && e.target.value.trim()) setNameError(null);
              }}
              placeholder="e.g. Maria Santos"
              className={`h-10 rounded-xl transition-colors ${nameError ? "border-destructive focus-visible:ring-destructive" : ""}`}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "name-error" : undefined}
            />
            {nameError && (
              <p id="name-error" className="text-xs text-destructive font-medium mt-1">
                {nameError}
              </p>
            )}
          </div>

          {/* School Name */}
          <div className="space-y-1.5">
            <Label htmlFor="school-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              School / Institution
            </Label>
            <Input
              id="school-name"
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="e.g. Holy Cross of Davao College"
              className="h-10 rounded-xl transition-colors"
            />
            <p className="text-xs text-muted-foreground">
              Appears alongside your name in the portal sidebar and class reports.
            </p>
          </div>

          {/* Email (Read-only) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-display" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email Address
              </Label>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                <Lock className="size-3" /> Verified Login
              </span>
            </div>
            <Input
              id="email-display"
              type="email"
              value={email}
              disabled
              className="h-10 rounded-xl bg-muted/60 text-muted-foreground cursor-not-allowed border-dashed"
            />
            <p className="text-xs text-muted-foreground">
              Your email is your authenticated login identifier and cannot be changed here. Contact an administrator if your email address has changed.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end pt-4 border-t bg-muted/20 px-6 py-4 rounded-b-2xl">
          <Button
            type="submit"
            disabled={!isDirty || isSaving}
            className="h-10 rounded-xl px-5 font-medium transition-all"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="mr-2 size-4" />
                Save Changes
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
```

- [ ] **Step 2: Run static type check**

Run:
```bash
npx tsc --noEmit
```
Expected: PASS with zero errors.

- [ ] **Step 3: Commit Task 2 changes**

```bash
git add frontend/components/settings/profile-settings-card.tsx
git commit -m "feat(settings): add profile settings card component"
```

---

### Task 3: Security & Password Settings Card Component

**Files:**
- Create: `frontend/components/settings/security-settings-card.tsx`

**Interfaces:**
- Consumes: `email: string`
- Produces: `SecuritySettingsCard` component handling in-session credentials re-authentication, password criteria checklists, and credential updates.

- [ ] **Step 1: Implement `SecuritySettingsCard`**

Create `frontend/components/settings/security-settings-card.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Eye, EyeOff, Check, X, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SecuritySettingsCardProps {
  email: string;
}

export function SecuritySettingsCard({ email }: SecuritySettingsCardProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Criteria validation
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const allCriteriaMet = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword.trim().length > 0 && allCriteriaMet && passwordsMatch && !isSubmitting;

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setCurrentPasswordError(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();

      // 1. Re-authenticate current credentials to verify identity
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        setCurrentPasswordError("Current password is incorrect. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // 2. Apply new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        if (updateError.message.toLowerCase().includes("different")) {
          throw new Error("New password must be different from your current password.");
        }
        throw updateError;
      }

      toast.success("Password updated successfully.");
      // Reset form fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update password.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-warm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <div>
            <CardTitle className="font-heading text-lg font-semibold">Password & Security</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Update your password to keep your classroom account protected.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <form onSubmit={handlePasswordUpdate}>
        <CardContent className="space-y-4 pt-2">
          {/* Current Password */}
          <div className="space-y-1.5">
            <Label htmlFor="current-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current Password
            </Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (currentPasswordError) setCurrentPasswordError(null);
                }}
                placeholder="Enter current password"
                className={`h-10 rounded-xl pr-10 transition-colors ${currentPasswordError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                aria-invalid={!!currentPasswordError}
                aria-describedby={currentPasswordError ? "current-password-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                aria-label={showCurrent ? "Hide password" : "Show password"}
              >
                {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {currentPasswordError && (
              <p id="current-password-error" className="text-xs text-destructive font-medium mt-1">
                {currentPasswordError}
              </p>
            )}
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="h-10 rounded-xl pr-10 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            {/* Real-time criteria checklist */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-muted-foreground">
              <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                {hasMinLength ? <Check className="size-3.5" /> : <div className="size-1.5 rounded-full bg-muted-foreground/50 mx-1" />}
                <span>At least 8 characters</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasUppercase ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                {hasUppercase ? <Check className="size-3.5" /> : <div className="size-1.5 rounded-full bg-muted-foreground/50 mx-1" />}
                <span>One uppercase letter (A–Z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasLowercase ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                {hasLowercase ? <Check className="size-3.5" /> : <div className="size-1.5 rounded-full bg-muted-foreground/50 mx-1" />}
                <span>One lowercase letter (a–z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                {hasNumber ? <Check className="size-3.5" /> : <div className="size-1.5 rounded-full bg-muted-foreground/50 mx-1" />}
                <span>One number (0–9)</span>
              </div>
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Confirm New Password
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="h-10 rounded-xl pr-10 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <p className={`text-xs font-medium flex items-center gap-1 mt-1 ${passwordsMatch ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {passwordsMatch ? (
                  <>
                    <Check className="size-3.5" /> Passwords match
                  </>
                ) : (
                  <>
                    <X className="size-3.5" /> Passwords do not match
                  </>
                )}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end pt-4 border-t bg-muted/20 px-6 py-4 rounded-b-2xl">
          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-10 rounded-xl px-5 font-medium transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 size-4" />
                Update Password
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
```

- [ ] **Step 2: Run static type check**

Run:
```bash
npx tsc --noEmit
```
Expected: PASS with zero errors.

- [ ] **Step 3: Commit Task 3 changes**

```bash
git add frontend/components/settings/security-settings-card.tsx
git commit -m "feat(settings): add security and password settings card component"
```

---

### Task 4: Account Settings Page Integration & Layout Updates

**Files:**
- Modify: `frontend/app/(teacher)/settings/page.tsx`
- Modify: `frontend/app/(teacher)/layout.tsx:23-37`

**Interfaces:**
- Consumes: `ProfileSettingsCard` and `SecuritySettingsCard`
- Produces: Fully assembled `/settings` page for teachers, and enhanced `TeacherLayout` fetching `school_name` directly from `public.teacher`.

- [ ] **Step 1: Update `frontend/app/(teacher)/layout.tsx` to read `school_name` from DB**

In `frontend/app/(teacher)/layout.tsx`:
```tsx
  // Fetch teacher profile
  const { data: teacherProfile } = await supabase
    .from("teacher")
    .select("full_name, school_name")
    .eq("id", user.id)
    .single();

  const fullName =
    teacherProfile?.full_name ||
    (user.user_metadata?.full_name as string) ||
    user.email ||
    "Teacher";
  const email = user.email || "";
  const schoolName =
    teacherProfile?.school_name ||
    (user.user_metadata?.school_name as string) ||
    undefined;
```

- [ ] **Step 2: Implement `/settings/page.tsx`**

Replace `frontend/app/(teacher)/settings/page.tsx`:
```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileSettingsCard } from "@/components/settings/profile-settings-card";
import { SecuritySettingsCard } from "@/components/settings/security-settings-card";

export const metadata: Metadata = {
  title: "Account Settings — WriteWise",
  description: "Manage your teacher profile and account credentials.",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: teacherProfile } = await supabase
    .from("teacher")
    .select("full_name, school_name, email")
    .eq("id", user.id)
    .single();

  const fullName =
    teacherProfile?.full_name ||
    (user.user_metadata?.full_name as string) ||
    "";
  const schoolName =
    teacherProfile?.school_name ||
    (user.user_metadata?.school_name as string) ||
    "";
  const email = user.email || teacherProfile?.email || "";

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-2 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your teacher profile information and account security credentials.
        </p>
      </div>

      {/* Profile Card */}
      <ProfileSettingsCard
        initialFullName={fullName}
        initialSchoolName={schoolName}
        email={email}
      />

      {/* Password & Security Card */}
      <SecuritySettingsCard email={email} />
    </div>
  );
}
```

- [ ] **Step 3: Run static type checks and linter**

Run in `frontend`:
```bash
npx tsc --noEmit
npx eslint .
```
Expected: PASS with zero errors and clean lint.

- [ ] **Step 4: Commit Task 4 changes**

```bash
git add frontend/app/(teacher)/settings/page.tsx frontend/app/(teacher)/layout.tsx
git commit -m "feat(settings): integrate account settings page and layout sync"
```

---

### Task 5: End-to-End Browser Verification

- [ ] **Step 1: Verify dev server availability**

Check that `npm run dev` in `frontend` is active at `http://localhost:3000`.

- [ ] **Step 2: Sign in and navigate to Settings**

- Sign in as a test teacher user (e.g. seeded teacher).
- Click on the teacher user dropdown in the bottom left sidebar and select **Account Settings**.
- Verify navigation lands on `/settings` with the header "Account Settings" and active nav highlight.

- [ ] **Step 3: Test Profile Updates**

- Verify prefilled Full Name, School Name, and read-only email with verified lock badge.
- Edit Full Name and School Name $\rightarrow$ verify "Save Changes" button becomes active.
- Click "Save Changes" $\rightarrow$ verify success toast and immediate update in sidebar footer initials and school badge.
- Refresh page $\rightarrow$ verify values remain persisted.

- [ ] **Step 4: Test Password Security Validation & Updates**

- Enter an incorrect current password with valid new password $\rightarrow$ verify inline error `"Current password is incorrect. Please try again."` appears without logging out.
- Enter correct current password + invalid new password (e.g. "short") $\rightarrow$ verify checklist items reflect unmet criteria and "Update Password" remains disabled.
- Enter matching new password meeting all 4 criteria $\rightarrow$ click "Update Password" $\rightarrow$ verify toast `"Password updated successfully."` and form fields reset.

- [ ] **Step 5: Verify Session Re-authentication with New Password**

- Sign out of WriteWise.
- Log in using the newly updated password.
- Confirm successful authentication and landing on `/dashboard`.

- [ ] **Step 6: Update `IMPLEMENTATION_STATUS.md` and commit**

Mark Teacher Settings as completed in `IMPLEMENTATION_STATUS.md`.
```bash
git add IMPLEMENTATION_STATUS.md
git commit -m "docs: update implementation status for teacher account settings"
```
