# Teacher Account Settings — Design Spec

**Date:** 2026-09-09  
**Status:** In Review  
**Implements:** DESIGN.md §5 & §6 (Screen 3: Settings), PRD.md §7.1, DATABASE.md §4, IMPLEMENTATION_STATUS.md Phase 1/2 Teacher Portal  

---

## 1. Summary

Implement the dedicated **Teacher Account Settings** screen at `/settings`, replacing the current empty placeholder page (`app/(teacher)/settings/page.tsx`). The page provides teacher profile management (Full Name, School / Institution Name, read-only verified Email) and authenticated in-session password updates with mandatory current-password verification and real-time password strength validation.

### Key Decisions

1. **Dedicated Stacked-Card Layout:** Uses a centered, max-width layout (`max-w-3xl space-y-8`) featuring two visually distinct cards: **Profile Information** and **Password & Security**. Avoids premature tab-switching complexity.
2. **Postgres & Auth Metadata Synchronization:** The `school_name` attribute is formalized in Postgres (`public.teacher.school_name`) and mirrored in Supabase Auth user metadata (`user.user_metadata.school_name`). Profile updates save to both layers.
3. **Sidebar & Layout Auto-Sync:** Invoking Next.js `router.refresh()` upon profile save re-runs `app/(teacher)/layout.tsx`, updating the sidebar's teacher name, initials avatar (`getInitials`), and school badge immediately without a full page reload.
4. **Mandatory Current Password Re-Authentication:** To guard against unauthorized credential takeover on shared or unattended classroom computers, changing the password requires verifying the teacher's current password (`supabase.auth.signInWithPassword`) before applying `supabase.auth.updateUser({ password })`.
5. **Read-Only Email Address:** The email field is rendered disabled with a lock icon and explanatory badge/text. Changes to login email are reserved for system administrative procedures to avoid orphaned auth states.

### Explicitly Out of Scope

- **Parent Settings Page:** As established in `docs/superpowers/specs/2026-08-28-parent-portal-design.md`, the Parent Portal intentionally does not have a separate settings route; parent profile display and sign-out live directly in the top-nav avatar dropdown.
- **Self-Service Email Modification:** Updating login email requires multi-stage verification links and is excluded from in-app settings.
- **Class / Roster Management:** Per DESIGN.md §5, class and section configurations live strictly on `/roster`.
- **Account Deletion:** Account deletion is blocked per DATABASE.md §1 while research and student calibration data reference the teacher.

---

## 2. Database Schema & RLS Policies

### 2.1 SQL Migration (`supabase/migrations/0013_teacher_settings.sql`)

```sql
-- 1. Add school_name column to public.teacher if it does not already exist
alter table public.teacher
  add column if not exists school_name text;

-- 2. Allow teachers to update their own profile record
create policy "teacher can update own profile"
  on public.teacher for update
  using (id = auth.uid())
  with check (id = auth.uid());
```

### 2.2 TypeScript Type Regeneration

Following the migration, run:
```bash
supabase gen types typescript --project-id <dev-project-id> > frontend/src/types/database.ts
```
This ensures `Database["public"]["Tables"]["teacher"]["Row"]` contains `school_name: string | null` and supports typed updates.

---

## 3. Architecture & Data Flow

### 3.1 Initial Data Loading

`app/(teacher)/settings/page.tsx` is a Server Component or pairs with a Client Form component.
- The server retrieves current session and profile data via `supabase.auth.getUser()` and:
  ```typescript
  const { data: profile } = await supabase
    .from("teacher")
    .select("full_name, school_name, email")
    .eq("id", user.id)
    .single();
  ```
- Initial values are passed down to the client form:
  - `fullName`: `profile?.full_name || user.user_metadata?.full_name || ""`
  - `schoolName`: `profile?.school_name || user.user_metadata?.school_name || ""`
  - `email`: `user.email || profile?.email || ""`

### 3.2 Profile Mutation Flow

```
[Teacher clicks "Save Changes"]
       │
       ▼
[Validate fullName is not empty]
       │
       ├─► Invalid: Set inline field error, abort
       │
       ▼
[1. supabase.auth.updateUser({ data: { full_name, school_name } })]
       │
       ▼
[2. supabase.from("teacher").update({ full_name, school_name }).eq("id", user.id)]
       │
       ▼
[3. toast.success("Profile updated successfully")]
       │
       ▼
[4. router.refresh()] ──► Updates TeacherSidebar avatar & school badge
```

### 3.3 Password Change Flow

```
[Teacher enters: currentPassword, newPassword, confirmPassword]
       │
       ▼
[Client-side validation: 4-rule strength checklist + confirm match]
       │
       ▼
[Teacher clicks "Update Password"]
       │
       ▼
[1. Verify: supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })]
       │
       ├─► Failure ("Invalid login credentials"):
       │   Set field error on currentPassword: "Current password is incorrect."
       │   Abort (session remains active)
       │
       ▼
[2. Apply: supabase.auth.updateUser({ password: newPassword })]
       │
       ├─► Failure: Set toast.error with server message
       │
       ▼
[3. Success: toast.success("Password changed successfully")]
       │
       ▼
[4. Reset form fields to empty & reset strength checklist]
```

---

## 4. UI Components & Visual Layout

### 4.1 Page Layout (`app/(teacher)/settings/page.tsx`)

Container: `max-w-3xl mx-auto space-y-8 py-2`

- **Header Section:**
  - `h1`: "Account Settings" (`font-heading text-2xl font-bold tracking-tight`)
  - Subtitle: "Manage your teacher profile information and account security credentials." (`text-sm text-muted-foreground mt-1`)

### 4.2 Profile Information Card (`components/settings/profile-settings-card.tsx`)

- **Card Container:** Warm border with subtle shadow (`rounded-2xl border bg-card text-card-foreground shadow-warm`)
- **Card Header:**
  - Icon badge: Warm primary tinted icon container with `UserIcon`
  - Title: "Personal Information" (`text-lg font-heading font-semibold`)
  - Description: "Update your display name and school affiliation."
- **Fields:**
  1. **Full Name (`Input`):**
     - Label: "Full Name"
     - Value: Controlled state initialized to current full name.
     - Inline error message if cleared upon submit.
  2. **School / Institution (`Input`):**
     - Label: "School / Institution"
     - Value: Controlled state initialized to current school name.
     - Helper text: *"Appears under your name in the portal sidebar and class reports."*
  3. **Email Address (`Input`, Disabled):**
     - Label: "Email Address"
     - Value: `user.email`
     - Trailing icon: `LockIcon` or shield badge.
     - Helper text: *"Your email is your authenticated login identifier and cannot be changed here. Contact an administrator if your email needs updating."*
- **Card Footer:**
  - "Save Changes" (`Button`)
  - Disabled when form values match initial state (pristine) or when `isSaving` is true.
  - Displays inline `Loader2Icon` spinning indicator while saving.

### 4.3 Password & Security Card (`components/settings/security-settings-card.tsx`)

- **Card Container:** Matching styled card with `KeyRoundIcon` header badge.
- **Card Header:**
  - Title: "Password & Security" (`text-lg font-heading font-semibold`)
  - Description: "Update your password to keep your classroom portal secure."
- **Fields:**
  1. **Current Password (`Input`):**
     - Password toggle (eye / eye-off icon).
     - Inline error state for invalid credential attempts.
  2. **New Password (`Input`):**
     - Password toggle.
     - Dynamic 4-item checklist with checkmark / neutral icons:
       - [ ] At least 8 characters
       - [ ] At least one uppercase letter (A–Z)
       - [ ] At least one lowercase letter (a–z)
       - [ ] At least one number (0–9)
  3. **Confirm New Password (`Input`):**
     - Password toggle.
     - Real-time match text (*"Passwords match"* in emerald or warning if mismatch).
- **Card Footer:**
  - "Update Password" (`Button`)
  - Disabled until current password is typed, all 4 rules are met, and passwords match.
  - Clears all fields upon successful update.

---

## 5. Error Handling & Accessibility

1. **Security Isolation:** Current password verification failures do NOT invalidate the active session or log the teacher out.
2. **Accessible Labels & Contrast:** All inputs include explicit `<Label htmlFor="...">` tags, `aria-describedby` links to helper/error text, and `aria-invalid` attributes.
3. **Screen Reader Live Regions:** Dynamic password requirement updates and match statuses announce state changes politely.
4. **Toast Feedback:** Standardized through `sonner` toasts matching WriteWise conventions.

---

## 6. Testing & Verification

1. **Static Analysis:**
   - `npx tsc --noEmit` clean.
   - `npx eslint .` clean.
2. **Database Verification:**
   - Migration applied cleanly; RLS update check verifies non-owners cannot mutate teacher records.
3. **Manual Browser Verification:**
   - Profile edit: update full name and school name $\rightarrow$ verify toast and sidebar update.
   - Password update with incorrect current password $\rightarrow$ verify inline error displayed and session preserved.
   - Password update with valid current and new password $\rightarrow$ verify success toast, input reset, and successful subsequent login with new credentials.
