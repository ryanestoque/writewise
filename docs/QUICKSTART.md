# WriteWise — Teammate Quickstart & Local Setup Guide

> **Target Audience:** Development Team (Ryan, Lawrence, David, Saara)  
> **Goal:** Go from a fresh laptop to running both frontend & backend locally in under 10 minutes.  
> **Prerequisites:** No Docker needed — connects directly to the hosted `writewise-dev` Supabase project.

---

## 1. Required Software Checklist

Install these tools on your computer before cloning the repository:

### 1.1 Git
- **Download:** [git-scm.com/downloads](https://git-scm.com/downloads)
- **Verify installation:**
  ```bash
  git --version
  ```

### 1.2 Node.js (v24 or v20+ LTS)
- **Download:** [nodejs.org](https://nodejs.org/) (Download LTS version)
- Comes bundled with `npm`.
- **Verify installation:**
  ```bash
  node -v
  npm -v
  ```

### 1.3 `uv` (Fast Python Package & Interpreter Manager)
> 💡 **Why `uv`?** You **do NOT** need to install Python manually! `uv` automatically downloads, installs, and manages the exact Python 3.13 interpreter required for WriteWise.

- **Windows (PowerShell):**
  ```powershell
  powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
  ```
  *(After installation, close and reopen your PowerShell terminal).*

- **macOS / Linux:**
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```

- **Verify installation:**
  ```bash
  uv --version
  ```

### 1.4 Code Editor
- **VS Code** (or Cursor / Antigravity): [code.visualstudio.com](https://code.visualstudio.com/)
- **Recommended Extensions:**
  - *Tailwind CSS IntelliSense*
  - *Prettier - Code formatter*
  - *ESLint*
  - *Python / Ruff* (by Astral Software)

---

## 2. Clone the Repository

Open your terminal, choose a folder where you keep coding projects, and run:

```bash
git clone https://github.com/ryanestoque/writewise.git
cd writewise
```

---

## 3. Environment Variables Configuration

Because secret API keys are never stored in public GitHub repositories, you need to set up two local `.env` files. Ask **Ryan** for the active dev Supabase keys.

### 3.1 Frontend Environment (`frontend/.env.local`)
Create a file named `.env.local` inside the `frontend/` folder:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-dev-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-dev-anon-key>
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 3.2 Backend Environment (`backend/.env`)
Create a file named `.env` inside the `backend/` folder:

```env
SUPABASE_URL=https://<your-dev-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-dev-service-role-key>
SUPABASE_JWT_SECRET=<your-dev-jwt-secret>
SUPABASE_DB_URL=postgresql://postgres:<password>@<db-host>:5432/postgres
MODEL_STORAGE_BUCKET=model-artifacts
MODEL_ARTIFACT_PATH=
SCORING_ENGINE=manual
CORS_ALLOWED_ORIGINS=http://localhost:3000
ENVIRONMENT=dev
```

---

## 4. Starting the Application

You need two separate terminal windows open at the same time: one for the frontend and one for the backend.

### Terminal 1: Frontend (Next.js)

```bash
# Navigate to frontend
cd frontend

# Install dependencies (first time only)
npm install

# Start the dev server
npm run dev
```

- **Web App URL:** [`http://localhost:3000`](http://localhost:3000)

---

### Terminal 2: Backend (FastAPI + OpenCV)

Open a **new, second terminal window** in the project root:

```bash
# Navigate to backend
cd backend

# Sync Python environment and dependencies (first time only)
uv sync

# Start the FastAPI server with auto-reload
uv run uvicorn app.main:app --reload
```

- **Backend API:** [`http://localhost:8000`](http://localhost:8000)
- **Interactive Swagger API Docs:** [`http://localhost:8000/docs`](http://localhost:8000/docs)

---

## 5. Verifying Your Setup

1. Open your browser to [`http://localhost:3000`](http://localhost:3000).
   - You should see the WriteWise sign-in page.
2. Open [`http://localhost:8000/docs`](http://localhost:8000/docs).
   - You should see FastAPI's Swagger UI documentation listing all active routes (`/api/activities`, `/api/students`, `/api/submissions`).
3. If both load without errors, your machine is 100% ready!

---

## 6. Default Test Accounts

Use these pre-seeded accounts to test and explore the system:

| Role | Email | Dev Password | Default Landing Page |
|---|---|---|---|
| **Teacher** | `teacher.santos@example.com` | `password123` | [`http://localhost:3000/dashboard`](http://localhost:3000/dashboard) |
| **Parent** | `parent.seed@example.com` | `password123` | [`http://localhost:3000/progress`](http://localhost:3000/progress) |

*Linked student record: **Juan Dela Cruz** (Grade 3 - Sampaguita).*

---

## 7. Running the Manual E2E Tests

If you are performing quality assurance or manual verification:
1. Open the latest test guide in [`docs/manual_tests/9-25-2026.md`](./manual_tests/9-25-2026.md).
2. Follow each test procedure starting from **Section 1: Authentication & Route Protection**.
3. Record `[x] Pass` or `[x] Fail` and any observations in the test document.

---

## 8. Troubleshooting & Common Issues

### Issue 1: `uv : File ... cannot be loaded because running scripts is disabled` (Windows)
- **Fix:** Run this command in PowerShell as Administrator:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

### Issue 2: `Port 3000 or 8000 is already in use`
- Another process or previous server instance is still occupying the port.
- **Windows Fix:**
  ```powershell
  # Find and kill process on port 3000
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F
  ```
- Or simply close lingering terminal windows and restart.

### Issue 3: `Database connection error / Failed to fetch`
- Double check that your `frontend/.env.local` and `backend/.env` have valid Supabase dev credentials and no trailing spaces or quotes.
- Ensure your internet connection is active, as local dev connects to the cloud Supabase dev database.

---

*Need help? Reach out in the team chat or contact Ryan Christopher B. Estoque.*
