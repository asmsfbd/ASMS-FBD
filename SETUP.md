# ASMS Phase 2 — Setup Instructions

## Step 1 — Place the folder
Put this `asms-faridabad` folder wherever you keep your projects.
Example: `C:\Users\Daksh Verma\Desktop\asms-faridabad`

## Step 2 — Create your .env file
Copy `.env.example` to `.env`:
```
copy .env.example .env
```
Then open `.env` and fill in your Supabase values:
- Go to supabase.com → your project → Settings → API
- Copy "Project URL" → paste as VITE_SUPABASE_URL
- Copy "anon public" key → paste as VITE_SUPABASE_ANON_KEY

## Step 3 — Install dependencies
Open command prompt in this folder and run:
```
npm install
```

## Step 4 — Run the app
```
npm run dev
```
Open http://localhost:5173 in your browser.

## Step 5 — Create your first login in Supabase
1. Go to Supabase → Authentication → Users → Add User
2. Email: FB5978ASO001@asms.local  (use your actual ASO badge number)
3. Password: set a temporary password
4. Copy the UUID from the created user
5. Run this in Supabase SQL Editor:
```sql
INSERT INTO public.users (auth_id, badge_number, role, centre)
VALUES (
  'PASTE-UUID-HERE',
  'YOUR-ASO-BADGE-NUMBER',
  'aso',
  'SECTOR-15-A'
);
```
6. Log in at http://localhost:5173/login

## Step 6 — Push to GitHub + deploy on Vercel
1. Create a new repo on github.com named `asms-faridabad`
2. In this folder run:
```
git init
git add .
git commit -m "Phase 2 — initial ASMS scaffold"
git remote add origin https://github.com/YOUR-USERNAME/asms-faridabad.git
git push -u origin main
```
3. Go to vercel.com → New Project → Import from GitHub → select `asms-faridabad`
4. Add Environment Variables (same as your .env file)
5. Deploy — your app is live!

## What's included in Phase 2
- Login screen with badge number authentication
- Role-based routing (ASO / Centre Admin / Scanner / Jatha Sewadar)
- Full sidebar navigation per role
- ASO Dashboard with live scan feed
- Centre Admin Dashboard with NR jatha cards
- Scanner Dashboard with full IN/OUT logic + jatha block check
- Jatha Sewadar Dashboard with attendance marking
- ASMS design system (maroon/navy/gold)

## Coming in Phase 3+
- /sewadars — Sewadar database with search, add, edit, bulk import
- /jatha-schedule — ASO creates schedules + quotas
- /nominal-roles — Full NR creation and approval workflow
- /reports — All 6 reports including the matrix
