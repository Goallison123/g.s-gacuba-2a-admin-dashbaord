/*
# Create school_data table for S4Me school management platform

## Purpose
Stores each school's complete data (profile, classes, subjects, teachers, students,
timetable, assessments, marks, terms) as a single JSON document owned by the
authenticated user who created it.

## New Tables
- `school_data`
  - `id` (uuid, primary key)
  - `user_id` (uuid, NOT NULL, defaults to auth.uid(), references auth.users)
  - `data` (jsonb, NOT NULL) — the full SchoolData object
  - `created_at` (timestamptz, defaults to now())
  - `updated_at` (timestamptz, defaults to now())

## Security
- RLS enabled with 4 owner-scoped policies (SELECT/INSERT/UPDATE/DELETE).
- user_id defaults to auth.uid() so frontend inserts omitting user_id still pass.
- One school per user enforced by unique constraint on user_id.
*/

CREATE TABLE IF NOT EXISTS school_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_data_user_id_key') THEN
    ALTER TABLE school_data ADD CONSTRAINT school_data_user_id_key UNIQUE (user_id);
  END IF;
END $do$;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS school_data_updated_at ON school_data;
CREATE TRIGGER school_data_updated_at
  BEFORE UPDATE ON school_data
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE school_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_school_data" ON school_data;
CREATE POLICY "select_own_school_data"
  ON school_data FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_school_data" ON school_data;
CREATE POLICY "insert_own_school_data"
  ON school_data FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_school_data" ON school_data;
CREATE POLICY "update_own_school_data"
  ON school_data FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_school_data" ON school_data;
CREATE POLICY "delete_own_school_data"
  ON school_data FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
