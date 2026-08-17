# Class Roster Management Design Spec

## 1. Overview
This spec covers the frontend implementation of the Class Roster Management feature for the Teacher Portal (Phase 1). It enables teachers to view their students, add new students, edit existing ones, and unenroll students.

## 2. Architecture & Data Flow
- **Data Fetching:** We will use TanStack React Query to manage server state.
- **Hooks to Implement:**
  - `useStudents()`: Fetches the teacher's roster. (Note: Per API_SPEC.md §1, list endpoints are direct Supabase reads using `supabase-js`, not FastAPI).
  - `useCreateStudent(data)`: Calls `POST /api/students` via FastAPI.
  - `useUpdateStudent(id, data)`: Calls `PATCH /api/students/{id}` via FastAPI.
  - `useRemoveStudent(id)`: Calls `DELETE /api/students/{id}/teacher-link` via FastAPI.
- **State Invalidation:** Mutations will invalidate the `students` query key to trigger a refetch of the roster.

## 3. UI/UX Design (Approach 1: Modal-driven)
Following `DESIGN.md` principles (Diagnostic/Flat for data, Rounded for forms):

### 3.1 Roster Table
- **Layout:** A shadcn `Table` component (`rounded-none` or `rounded-sm`, flat surface).
- **Columns:** Student Name, Section, Parent Email (stored directly on `student.parent_email` and shown under student name / "No parent email linked"), Date Added, Actions.
- **Empty State:** "No students yet. Add your first student to start creating activities." with a primary "Add Student" button.

### 3.2 Add / Edit Student Modal
- **Trigger:** "Add Student" button above the table, or "Edit" inside the row actions dropdown.
- **Container:** A shadcn `Dialog` (rounded, soft shadow).
- **Form Fields (React Hook Form + Zod):**
  - `full_name` (Text input, required)
  - `section` (Combobox/Autocomplete, required): Displays previously used sections for quick selection and allows typing new ones to prevent typos.
  - `parent_email` (Text input, optional, email validation — persisted to `student.parent_email` and triggers Supabase Auth invite)
- **Actions:** "Cancel" and "Save Student" (with loading spinner during mutation).

### 3.3 Remove Student
- **Trigger:** "Remove" inside the row actions dropdown.
- **Confirmation:** A shadcn `AlertDialog` explaining that this unenrolls the student from the roster without deleting historical data (per API_SPEC.md §3.1).

## 4. Error Handling
- Follows the envelope `{ error: { code, message, details } }`.
- API errors (e.g., `VALIDATION_ERROR` or `UNAUTHORIZED`) will be caught in the mutation and displayed to the user via shadcn `toast` notifications.
- The UI will explicitly check `error.code` rather than `error.message` text.

## 5. Security & Access
- The frontend will rely on the session JWT automatically appended to FastAPI requests.
- Direct Supabase reads (`useStudents`) rely on RLS (`is_teacher_of_student` policy).

## 6. Testing / Verification
- As per `AGENTS.md` rules, frontend-only changes do not have an automated test suite.
- Manual QA pass against the flows:
  1. Adding a student creates a row and shows up in the table.
  2. The combobox correctly remembers sections from other students.
  3. Editing a student updates the row instantly.
  4. Removing a student removes them from the table.
