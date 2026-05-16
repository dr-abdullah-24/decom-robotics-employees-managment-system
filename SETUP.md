# Decom Robotics EMS — Setup Guide

## Overview

This is a React + Supabase Employee Management System deployable for free via GitHub Pages.

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Create a new project (e.g., "decom-robotics-ems")
3. Note your **Project URL** and **anon public key** from `Settings → API`

---

## Step 2: Run the Database Schema

1. In Supabase → **SQL Editor** → **New query**
2. Paste the contents of `supabase/schema.sql` and click **Run**
3. Create storage buckets manually:
   - Go to **Storage** → **New bucket**
   - Create `employee-documents` (private, 10MB limit)
   - Create `profile-pictures` (public, 5MB limit)
4. For storage RLS, go to Storage → Policies and add:
   - For `employee-documents`: Allow authenticated users to upload/read their own folder
   - For `profile-pictures`: Allow public read, authenticated write

---

## Step 3: Deploy the Edge Function

1. Install [Supabase CLI](https://supabase.com/docs/guides/cli)
2. In your terminal:
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_ID
   supabase functions deploy create-employee
   ```

---

## Step 4: Create Your Admin Account

1. Go to Supabase → **Authentication** → **Users** → **Invite user**
2. Enter your admin email and invite
3. Check your email and set your password
4. In Supabase → **SQL Editor**, run:
   ```sql
   UPDATE public.profiles
   SET role = 'admin', must_change_password = false
   WHERE email = 'your-admin-email@example.com';
   ```

---

## Step 5: Configure Environment Variables

### For local development:
```bash
cp .env.example .env
# Edit .env with your Supabase URL and anon key
```

### For GitHub Pages deployment:
1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Add two secrets:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon/public key

---

## Step 6: Enable GitHub Pages

1. Push your code to GitHub (main branch)
2. Go to repo → **Settings** → **Pages**
3. Set source to **GitHub Actions**
4. The workflow will auto-deploy on every push to main
5. Your app will be live at: `https://YOUR_USERNAME.github.io/decom-robotics-employees-managment-system/`

---

## Step 7: Adding Employees

As admin:
1. Log in to the app
2. Go to **Employees → Add Employee**
3. Fill in the employee details and submit
4. An invitation email is sent to the employee
5. Employee clicks the link, sets their password
6. On first login, they are required to set a new password

---

## Features Summary

### Admin Portal
- Dashboard with live attendance stats
- Employee management (add, edit, view)
- Attendance monitoring with Excel export
- Leave request approval/rejection
- Payroll management with bulk generation

### Employee Portal
- Real-time check-in/check-out with working hours tracking
- Leave balance (22 days/year from employment date)
- Half-day and full-day leave applications
- Document upload (CNIC, academic certificates, contracts)
- Profile & password management

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Functions | Supabase Edge Functions (Deno) |
| Hosting | GitHub Pages (free) |
| Export | xlsx (Excel attendance sheets) |

---

## Local Development

```bash
npm install
cp .env.example .env
# Fill in .env with your Supabase credentials
npm run dev
```

Open http://localhost:5173
