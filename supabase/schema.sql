-- ============================================================
-- Decom Robotics Employee Management System — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ─────────────────────────────────────────────
CREATE TABLE public.profiles (
  id                   UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  employee_id          TEXT UNIQUE,
  full_name            TEXT NOT NULL,
  email                TEXT NOT NULL,
  phone                TEXT,
  department           TEXT,
  position             TEXT,
  role                 TEXT DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  employment_date      DATE,
  basic_salary         DECIMAL(12,2) DEFAULT 0,
  status               TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  profile_picture_url  TEXT,
  must_change_password BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins can update all profiles
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can insert profiles
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role can do anything (for Edge Functions)
CREATE POLICY "profiles_service_all" ON public.profiles
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────
-- ATTENDANCE
-- ─────────────────────────────────────────────
CREATE TABLE public.attendance (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in      TIMESTAMPTZ,
  check_out     TIMESTAMPTZ,
  working_hours DECIMAL(5,2),
  status        TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day', 'leave')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select_own" ON public.attendance
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "attendance_select_admin" ON public.attendance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "attendance_insert_own" ON public.attendance
  FOR INSERT WITH CHECK (employee_id = auth.uid());

CREATE POLICY "attendance_insert_admin" ON public.attendance
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "attendance_update_own" ON public.attendance
  FOR UPDATE USING (employee_id = auth.uid() AND date = CURRENT_DATE);

CREATE POLICY "attendance_update_admin" ON public.attendance
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "attendance_upsert_service" ON public.attendance
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────
-- LEAVES
-- ─────────────────────────────────────────────
CREATE TABLE public.leaves (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  leave_type       TEXT NOT NULL CHECK (leave_type IN ('full_day', 'half_day')),
  half_day_period  TEXT CHECK (half_day_period IN ('morning', 'afternoon')),
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  days_count       DECIMAL(4,1) NOT NULL CHECK (days_count > 0),
  reason           TEXT NOT NULL,
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  admin_notes      TEXT,
  approved_by      UUID REFERENCES public.profiles(id),
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leaves_select_own" ON public.leaves
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "leaves_select_admin" ON public.leaves
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "leaves_insert_own" ON public.leaves
  FOR INSERT WITH CHECK (employee_id = auth.uid());

CREATE POLICY "leaves_update_own_cancel" ON public.leaves
  FOR UPDATE USING (employee_id = auth.uid() AND status = 'pending')
  WITH CHECK (status = 'cancelled');

CREATE POLICY "leaves_update_admin" ON public.leaves
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "leaves_service_all" ON public.leaves
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────
-- DOCUMENTS
-- ─────────────────────────────────────────────
CREATE TABLE public.documents (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  document_type  TEXT NOT NULL CHECK (document_type IN ('profile_picture', 'national_id', 'academic', 'experience', 'contract', 'other')),
  document_name  TEXT NOT NULL,
  file_path      TEXT NOT NULL,
  file_url       TEXT NOT NULL,
  file_size      INTEGER,
  mime_type      TEXT,
  uploaded_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_own" ON public.documents
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "documents_select_admin" ON public.documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "documents_insert_own" ON public.documents
  FOR INSERT WITH CHECK (employee_id = auth.uid());

CREATE POLICY "documents_delete_own" ON public.documents
  FOR DELETE USING (employee_id = auth.uid());

CREATE POLICY "documents_admin_all" ON public.documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ─────────────────────────────────────────────
-- SALARY RECORDS
-- ─────────────────────────────────────────────
CREATE TABLE public.salary_records (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  month        INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year         INTEGER NOT NULL,
  basic_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  bonuses      DECIMAL(12,2) NOT NULL DEFAULT 0,
  deductions   DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_salary   DECIMAL(12,2) GENERATED ALWAYS AS (basic_salary + bonuses - deductions) STORED,
  notes        TEXT,
  paid_on      DATE,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, month, year)
);

ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salary_select_own" ON public.salary_records
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "salary_admin_all" ON public.salary_records
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ─────────────────────────────────────────────
-- TRIGGER: create profile on auth signup
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, must_change_password)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─────────────────────────────────────────────
-- WORK SCHEDULE (singleton — one row for default schedule)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_schedule (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  check_in_time    TIME NOT NULL DEFAULT '09:00',
  check_out_time   TIME NOT NULL DEFAULT '18:00',
  working_days     INT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_by       UUID REFERENCES public.profiles(id)
);

-- Insert the default row if it doesn't exist
INSERT INTO public.work_schedule (check_in_time, check_out_time, working_days)
SELECT '09:00', '18:00', ARRAY[1,2,3,4,5]
WHERE NOT EXISTS (SELECT 1 FROM public.work_schedule);

-- RLS for work_schedule
ALTER TABLE public.work_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read schedule" ON public.work_schedule FOR SELECT USING (true);
CREATE POLICY "Admin can update schedule" ON public.work_schedule FOR UPDATE USING (is_admin());


-- ─────────────────────────────────────────────
-- SCHEDULE OVERRIDES (per-day exceptions)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schedule_overrides (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date             DATE NOT NULL UNIQUE,
  is_working       BOOLEAN NOT NULL DEFAULT false,
  check_in_time    TIME,
  check_out_time   TIME,
  reason           TEXT,
  created_by       UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.schedule_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read overrides" ON public.schedule_overrides FOR SELECT USING (true);
CREATE POLICY "Admin can manage overrides" ON public.schedule_overrides FOR ALL USING (is_admin());


-- ─────────────────────────────────────────────
-- STORAGE BUCKETS
-- Run these separately in SQL Editor:
-- ─────────────────────────────────────────────

-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'employee-documents',
--   'employee-documents',
--   false,
--   10485760,  -- 10MB
--   ARRAY['application/pdf','image/jpeg','image/jpg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
-- );

-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'profile-pictures',
--   'profile-pictures',
--   true,
--   5242880,  -- 5MB
--   ARRAY['image/jpeg','image/jpg','image/png','image/webp']
-- );


-- ─────────────────────────────────────────────
-- FIRST ADMIN SETUP
-- After creating your account, run this with YOUR user's UUID:
-- ─────────────────────────────────────────────

-- UPDATE public.profiles
-- SET role = 'admin', must_change_password = false
-- WHERE email = 'your-admin-email@example.com';
