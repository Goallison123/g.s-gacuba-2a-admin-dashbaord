CREATE TABLE IF NOT EXISTS school_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  parent_name text NOT NULL DEFAULT 'Not provided',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  class_name text NOT NULL,
  fee_status text NOT NULL DEFAULT 'Unpaid' CHECK (fee_status IN ('Paid', 'Partial', 'Unpaid')),
  fee_amount text NOT NULL DEFAULT '0 RWF',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE school_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_select_school_students" ON school_students;
CREATE POLICY "workspace_select_school_students" ON school_students FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "workspace_insert_school_students" ON school_students;
CREATE POLICY "workspace_insert_school_students" ON school_students FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "workspace_update_school_students" ON school_students;
CREATE POLICY "workspace_update_school_students" ON school_students FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "workspace_delete_school_students" ON school_students;
CREATE POLICY "workspace_delete_school_students" ON school_students FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS school_students_class_name_idx ON school_students(class_name);
CREATE INDEX IF NOT EXISTS school_students_full_name_idx ON school_students(full_name);

CREATE OR REPLACE FUNCTION import_school_students(p_students jsonb)
RETURNS SETOF school_students
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO public.school_students (
    registry_code,
    full_name,
    parent_name,
    email,
    phone,
    class_name,
    fee_status,
    fee_amount
  )
  SELECT
    item.registry_code,
    item.full_name,
    item.parent_name,
    item.email,
    item.phone,
    item.class_name,
    item.fee_status,
    item.fee_amount
  FROM jsonb_to_recordset(p_students) AS item(
    registry_code text,
    full_name text,
    parent_name text,
    email text,
    phone text,
    class_name text,
    fee_status text,
    fee_amount text
  )
  RETURNING *;
$$;