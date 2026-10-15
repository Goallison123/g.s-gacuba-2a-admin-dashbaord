-- Mid-term reports, assessment marks, teacher class assignments and SMS outbox.
-- Roles are read from trusted Supabase JWT claims; client-side checks are UX only.

CREATE OR REPLACE FUNCTION public.current_school_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  WITH claims AS (
    SELECT lower(coalesce(
      auth.jwt() -> 'app_metadata' ->> 'role',
      auth.jwt() -> 'app_metadata' ->> 'user_role',
      ''
    )) AS role_name
  )
  SELECT CASE lower(role_name)
    WHEN 'dean of studies' THEN 'dean_of_studies'
    WHEN 'dean_of_studies' THEN 'dean_of_studies'
    WHEN 'head teacher' THEN 'headteacher'
    WHEN 'headteacher' THEN 'headteacher'
    WHEN 'teacher' THEN 'teacher'
    WHEN 'it' THEN 'it'
    ELSE ''
  END FROM claims;
$$;

CREATE TABLE IF NOT EXISTS public.teacher_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_name text NOT NULL CHECK (length(trim(class_name)) > 0),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_user_id, class_name)
);

ALTER TABLE public.school_students ADD COLUMN IF NOT EXISTS stream text NOT NULL DEFAULT '';
ALTER TABLE public.school_students ADD COLUMN IF NOT EXISTS registration_number text;
UPDATE public.school_students SET registration_number = registry_code WHERE registration_number IS NULL;
ALTER TABLE public.school_students ALTER COLUMN registration_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS school_students_registration_number_idx ON public.school_students(registration_number);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_students_parent_name_required') THEN
    ALTER TABLE public.school_students ADD CONSTRAINT school_students_parent_name_required
      CHECK (length(trim(parent_name)) > 0 AND lower(trim(parent_name)) <> 'not provided') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_students_stream_required') THEN
    ALTER TABLE public.school_students ADD CONSTRAINT school_students_stream_required
      CHECK (length(trim(stream)) > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_students_parent_email_valid') THEN
    ALTER TABLE public.school_students ADD CONSTRAINT school_students_parent_email_valid
      CHECK (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_students_parent_phone_valid') THEN
    ALTER TABLE public.school_students ADD CONSTRAINT school_students_parent_phone_valid
      CHECK (length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 8) NOT VALID;
  END IF;
END $$;

-- Replace the earlier permissive registry policies with authenticated, role-scoped access.
DROP POLICY IF EXISTS "workspace_select_school_students" ON public.school_students;
DROP POLICY IF EXISTS "workspace_insert_school_students" ON public.school_students;
DROP POLICY IF EXISTS "workspace_update_school_students" ON public.school_students;
DROP POLICY IF EXISTS "workspace_delete_school_students" ON public.school_students;
DROP POLICY IF EXISTS school_students_role_select ON public.school_students;
CREATE POLICY school_students_role_select ON public.school_students FOR SELECT TO authenticated
USING (
  public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it')
);

-- Teacher register view exposes names/classes only; teachers cannot select the base
-- student table and therefore cannot retrieve parent or fee columns over the API.
CREATE OR REPLACE VIEW public.teacher_student_register
WITH (security_barrier = true)
AS
SELECT s.id, s.full_name, s.class_name, s.stream
FROM public.school_students s
WHERE public.current_school_role() = 'teacher'
  AND EXISTS (
    SELECT 1 FROM public.teacher_class_assignments a
    WHERE a.teacher_user_id = auth.uid() AND a.class_name = s.class_name
  );
GRANT SELECT ON public.teacher_student_register TO authenticated;

DROP POLICY IF EXISTS school_students_role_insert ON public.school_students;
CREATE POLICY school_students_role_insert ON public.school_students FOR INSERT TO authenticated
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));
DROP POLICY IF EXISTS school_students_role_update ON public.school_students;
CREATE POLICY school_students_role_update ON public.school_students FOR UPDATE TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));
DROP POLICY IF EXISTS school_students_role_delete ON public.school_students;
CREATE POLICY school_students_role_delete ON public.school_students FOR DELETE TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'));

CREATE OR REPLACE FUNCTION public.import_school_students(p_students jsonb)
RETURNS SETOF public.school_students
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO public.school_students (
    registry_code, registration_number, full_name, parent_name, email, phone, class_name, stream, fee_status, fee_amount
  )
  SELECT
    coalesce(item.registry_code, item.registration_number), coalesce(item.registration_number, item.registry_code), item.full_name, coalesce(item.parent_name, 'Not provided'),
    coalesce(item.email, ''), coalesce(item.phone, ''), item.class_name,
    coalesce(item.stream, ''), coalesce(item.fee_status, 'Unpaid'), coalesce(item.fee_amount, '0 RWF')
  FROM jsonb_to_recordset(p_students) AS item(
    registry_code text, registration_number text, full_name text, parent_name text, email text, phone text,
    class_name text, stream text, fee_status text, fee_amount text
  )
  RETURNING *;
$$;

CREATE TABLE IF NOT EXISTS public.midterm_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name text NOT NULL CHECK (length(trim(class_name)) > 0),
  subject_name text NOT NULL CHECK (length(trim(subject_name)) > 0),
  is_enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_name, subject_name)
);

CREATE OR REPLACE FUNCTION public.teacher_can_enter_mark(p_student_id uuid, p_class_name text, p_subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_class_assignments a
    JOIN public.school_students s ON s.id = p_student_id AND s.class_name = p_class_name
    JOIN public.midterm_subjects m ON m.id = p_subject_id AND m.class_name = p_class_name AND m.is_enabled
    WHERE a.teacher_user_id = auth.uid() AND a.class_name = p_class_name
  );
$$;
GRANT EXECUTE ON FUNCTION public.teacher_can_enter_mark(uuid, text, uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.midterm_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  official_date date,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'extended')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.midterm_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.midterm_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  delivered_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.student_midterm_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.school_students(id) ON DELETE CASCADE,
  class_name text NOT NULL,
  period text NOT NULL CHECK (length(trim(period)) > 0),
  subject_id uuid NOT NULL REFERENCES public.midterm_subjects(id) ON DELETE RESTRICT,
  mark numeric(5,2) NOT NULL CHECK (mark >= 0 AND mark <= 100),
  entered_by uuid REFERENCES auth.users(id),
  entered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, period, subject_id)
);

CREATE TABLE IF NOT EXISTS public.midterm_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.school_students(id) ON DELETE SET NULL,
  student_name text NOT NULL,
  class_name text NOT NULL,
  period text NOT NULL,
  average numeric(5,2) NOT NULL DEFAULT 0,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz,
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by uuid REFERENCES auth.users(id),
  generated_at timestamptz NOT NULL DEFAULT now(),
  pdf_generated_at timestamptz,
  pdf_storage_path text,
  teacher_comment text NOT NULL DEFAULT ''
);
ALTER TABLE public.midterm_reports ADD COLUMN IF NOT EXISTS pdf_storage_path text;
ALTER TABLE public.midterm_reports ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved'));
ALTER TABLE public.midterm_reports ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);
ALTER TABLE public.midterm_reports ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.midterm_reports ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.midterm_reports ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);
ALTER TABLE public.midterm_reports ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS public.midterm_report_contacts (
  report_id uuid PRIMARY KEY REFERENCES public.midterm_reports(id) ON DELETE CASCADE,
  parent_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.midterm_sms_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  period text NOT NULL,
  campaign_id uuid,
  recipient_count integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sms_campaign_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  campaign_id uuid,
  recipient_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Retire the old shared-workspace policies now that application access is authenticated and role-based.
DROP POLICY IF EXISTS "workspace_select_school_contacts" ON public.school_contacts;
DROP POLICY IF EXISTS "workspace_insert_school_contacts" ON public.school_contacts;
DROP POLICY IF EXISTS "workspace_update_school_contacts" ON public.school_contacts;
DROP POLICY IF EXISTS "workspace_delete_school_contacts" ON public.school_contacts;
ALTER TABLE public.school_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_contacts_role_read ON public.school_contacts FOR SELECT TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it'));
CREATE POLICY school_contacts_role_manage ON public.school_contacts FOR ALL TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));

DROP POLICY IF EXISTS "workspace_select_notification_campaigns" ON public.notification_campaigns;
DROP POLICY IF EXISTS "workspace_insert_notification_campaigns" ON public.notification_campaigns;
DROP POLICY IF EXISTS "workspace_update_notification_campaigns" ON public.notification_campaigns;
DROP POLICY IF EXISTS "workspace_delete_notification_campaigns" ON public.notification_campaigns;
ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_campaign_role_read ON public.notification_campaigns FOR SELECT TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it'));
CREATE POLICY notification_campaign_role_insert ON public.notification_campaigns FOR INSERT TO authenticated
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it'));
CREATE POLICY notification_campaign_role_update ON public.notification_campaigns FOR UPDATE TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));
CREATE POLICY notification_campaign_role_delete ON public.notification_campaigns FOR DELETE TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'));

DROP POLICY IF EXISTS "workspace_select_school_content" ON public.school_content;
DROP POLICY IF EXISTS "workspace_insert_school_content" ON public.school_content;
DROP POLICY IF EXISTS "workspace_update_school_content" ON public.school_content;
DROP POLICY IF EXISTS "workspace_delete_school_content" ON public.school_content;
ALTER TABLE public.school_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_content_role_manage ON public.school_content FOR ALL TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));

DROP POLICY IF EXISTS "workspace_select_school_inquiries" ON public.school_inquiries;
DROP POLICY IF EXISTS "workspace_insert_school_inquiries" ON public.school_inquiries;
DROP POLICY IF EXISTS "workspace_update_school_inquiries" ON public.school_inquiries;
DROP POLICY IF EXISTS "workspace_delete_school_inquiries" ON public.school_inquiries;
ALTER TABLE public.school_inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_inquiries_role_manage ON public.school_inquiries FOR ALL TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_select_workspace_settings" ON public.workspace_settings;
DROP POLICY IF EXISTS "workspace_insert_workspace_settings" ON public.workspace_settings;
DROP POLICY IF EXISTS "workspace_update_workspace_settings" ON public.workspace_settings;
CREATE POLICY workspace_settings_role_read ON public.workspace_settings FOR SELECT TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'));
CREATE POLICY workspace_settings_role_insert ON public.workspace_settings FOR INSERT TO authenticated
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));
CREATE POLICY workspace_settings_role_update ON public.workspace_settings FOR UPDATE TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));

CREATE INDEX IF NOT EXISTS teacher_class_assignments_teacher_idx ON public.teacher_class_assignments(teacher_user_id);
CREATE INDEX IF NOT EXISTS midterm_subjects_class_idx ON public.midterm_subjects(class_name, is_enabled);
CREATE INDEX IF NOT EXISTS student_midterm_marks_period_student_idx ON public.student_midterm_marks(period, student_id);
CREATE INDEX IF NOT EXISTS midterm_reports_period_class_idx ON public.midterm_reports(period, class_name, generated_at DESC);

ALTER TABLE public.teacher_class_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.midterm_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.midterm_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.midterm_notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_midterm_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.midterm_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.midterm_report_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.midterm_sms_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaign_dispatches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_assignments_read ON public.teacher_class_assignments;
CREATE POLICY teacher_assignments_read ON public.teacher_class_assignments FOR SELECT TO authenticated
USING (teacher_user_id = auth.uid() OR public.current_school_role() IN ('dean_of_studies', 'it'));
DROP POLICY IF EXISTS teacher_assignments_manage ON public.teacher_class_assignments;
CREATE POLICY teacher_assignments_manage ON public.teacher_class_assignments FOR ALL TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));

DROP POLICY IF EXISTS midterm_subjects_read ON public.midterm_subjects;
CREATE POLICY midterm_subjects_read ON public.midterm_subjects FOR SELECT TO authenticated
USING (public.current_school_role() IN ('teacher', 'dean_of_studies', 'it', 'headteacher'));
DROP POLICY IF EXISTS midterm_subjects_manage ON public.midterm_subjects;
CREATE POLICY midterm_subjects_manage ON public.midterm_subjects FOR ALL TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));

DROP POLICY IF EXISTS midterm_settings_read ON public.midterm_settings;
CREATE POLICY midterm_settings_read ON public.midterm_settings FOR SELECT TO authenticated
USING (public.current_school_role() IN ('teacher', 'dean_of_studies', 'it', 'headteacher'));
DROP POLICY IF EXISTS midterm_settings_manage ON public.midterm_settings;
CREATE POLICY midterm_settings_manage ON public.midterm_settings FOR UPDATE TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));

DROP POLICY IF EXISTS midterm_alerts_read ON public.midterm_notification_outbox;
CREATE POLICY midterm_alerts_read ON public.midterm_notification_outbox FOR SELECT TO authenticated
USING (recipient_user_id = auth.uid() OR public.current_school_role() IN ('dean_of_studies', 'it'));
DROP POLICY IF EXISTS midterm_alerts_mark_read ON public.midterm_notification_outbox;
CREATE POLICY midterm_alerts_mark_read ON public.midterm_notification_outbox FOR UPDATE TO authenticated
USING (recipient_user_id = auth.uid()) WITH CHECK (recipient_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.enqueue_midterm_date_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.official_date IS DISTINCT FROM OLD.official_date AND NEW.official_date IS NOT NULL THEN
    INSERT INTO public.midterm_notification_outbox (recipient_user_id, recipient_email, event_type, payload)
    SELECT a.teacher_user_id, u.email, 'teacher_midterm_date_set',
      jsonb_build_object('official_date', NEW.official_date, 'class_name', a.class_name)
    FROM public.teacher_class_assignments a
    JOIN auth.users u ON u.id = a.teacher_user_id;

    INSERT INTO public.midterm_notification_outbox (recipient_user_id, recipient_email, event_type, payload)
    SELECT u.id, u.email, 'dean_midterm_review',
      jsonb_build_object('official_date', NEW.official_date, 'action_options', jsonb_build_array('approve', 'extend_deadline', 'regenerate'))
    FROM auth.users u
    WHERE lower(coalesce(u.raw_app_meta_data ->> 'role', u.raw_app_meta_data ->> 'user_role', ''))
      IN ('dean_of_studies', 'it');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS midterm_date_alerts_after_update ON public.midterm_settings;
CREATE TRIGGER midterm_date_alerts_after_update
AFTER UPDATE OF official_date ON public.midterm_settings
FOR EACH ROW EXECUTE FUNCTION public.enqueue_midterm_date_alerts();

CREATE OR REPLACE FUNCTION public.enqueue_midterm_report_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.midterm_notification_outbox (recipient_user_id, recipient_email, event_type, payload)
  SELECT u.id, u.email, 'midterm_report_ready_for_dean',
    jsonb_build_object('report_id', NEW.id, 'student_name', NEW.student_name, 'class_name', NEW.class_name, 'period', NEW.period, 'average', NEW.average, 'action_options', jsonb_build_array('approve', 'extend_deadline', 'regenerate'))
  FROM auth.users u
  WHERE lower(coalesce(u.raw_app_meta_data ->> 'role', u.raw_app_meta_data ->> 'user_role', ''))
    IN ('dean_of_studies', 'it');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS midterm_report_review_after_insert ON public.midterm_reports;
CREATE TRIGGER midterm_report_review_after_insert
AFTER INSERT ON public.midterm_reports
FOR EACH ROW EXECUTE FUNCTION public.enqueue_midterm_report_review();

-- Automatically compile a student's report once every enabled subject has a mark.
CREATE OR REPLACE FUNCTION public.auto_compile_midterm_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  required_subjects integer;
  entered_subjects integer;
  last_generated timestamptz;
  compiled_rows jsonb;
  compiled_average numeric(5,2);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.student_id::text || ':' || NEW.period));

  SELECT count(*) INTO required_subjects
  FROM public.midterm_subjects s
  WHERE s.class_name = NEW.class_name AND s.is_enabled;
  IF required_subjects = 0 THEN RETURN NEW; END IF;

  SELECT count(DISTINCT m.subject_id) INTO entered_subjects
  FROM public.student_midterm_marks m
  JOIN public.midterm_subjects s ON s.id = m.subject_id
  WHERE m.student_id = NEW.student_id AND m.period = NEW.period
    AND m.class_name = NEW.class_name AND s.is_enabled;
  IF entered_subjects < required_subjects THEN RETURN NEW; END IF;

  SELECT max(r.generated_at) INTO last_generated
  FROM public.midterm_reports r
  WHERE r.student_id = NEW.student_id AND r.period = NEW.period AND NOT r.is_deleted;
  -- The trigger creates the initial snapshot. Subsequent changes are deliberately
  -- compiled by the Dean's incremental/force-regeneration workflow.
  IF last_generated IS NOT NULL THEN RETURN NEW; END IF;
  SELECT
    jsonb_agg(jsonb_build_object(
      'subject_id', s.id, 'subject', s.subject_name, 'mark', m.mark,
      'weight', round(m.mark / 10),
      'grade', CASE WHEN m.mark >= 80 THEN 'A' WHEN m.mark >= 70 THEN 'B'
        WHEN m.mark >= 60 THEN 'C' WHEN m.mark >= 50 THEN 'D' ELSE 'E' END
    ) ORDER BY s.subject_name) FILTER (WHERE m.mark > 0),
    round(avg(m.mark) FILTER (WHERE m.mark > 0), 2)
  INTO compiled_rows, compiled_average
  FROM public.student_midterm_marks m
  JOIN public.midterm_subjects s ON s.id = m.subject_id
  WHERE m.student_id = NEW.student_id AND m.period = NEW.period AND s.is_enabled;
  IF compiled_rows IS NULL OR compiled_average IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.midterm_reports (
    student_id, student_name, class_name, period, average, report_data, generated_by, generated_at
  )
  SELECT s.id, s.full_name, s.class_name, NEW.period, compiled_average,
    jsonb_build_object('rows', compiled_rows), NEW.entered_by, now()
  FROM public.school_students s WHERE s.id = NEW.student_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_compile_midterm_after_mark ON public.student_midterm_marks;
CREATE TRIGGER auto_compile_midterm_after_mark
AFTER INSERT OR UPDATE OF mark, entered_at ON public.student_midterm_marks
FOR EACH ROW EXECUTE FUNCTION public.auto_compile_midterm_report();

CREATE OR REPLACE FUNCTION public.set_midterm_report_pdf_metadata(
  p_report_id uuid,
  p_pdf_generated_at timestamptz,
  p_pdf_storage_path text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_pdf_storage_path IS DISTINCT FROM (p_report_id::text || '/report.pdf') THEN
    RAISE EXCEPTION 'Invalid report PDF path';
  END IF;
  UPDATE public.midterm_reports r
  SET pdf_generated_at = p_pdf_generated_at, pdf_storage_path = p_pdf_storage_path
  WHERE r.id = p_report_id AND (
    public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it')
    OR (public.current_school_role() = 'teacher' AND EXISTS (
      SELECT 1 FROM public.teacher_class_assignments a
      WHERE a.teacher_user_id = auth.uid() AND a.class_name = r.class_name
    ))
  );
  RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_midterm_report_pdf_metadata(uuid, timestamptz, text) TO authenticated;

DROP POLICY IF EXISTS midterm_marks_read ON public.student_midterm_marks;
CREATE POLICY midterm_marks_read ON public.student_midterm_marks FOR SELECT TO authenticated
USING (
  public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it')
  OR (public.current_school_role() = 'teacher' AND EXISTS (
    SELECT 1 FROM public.teacher_class_assignments a
    WHERE a.teacher_user_id = auth.uid() AND a.class_name = student_midterm_marks.class_name
  ))
);
DROP POLICY IF EXISTS midterm_marks_insert ON public.student_midterm_marks;
CREATE POLICY midterm_marks_insert ON public.student_midterm_marks FOR INSERT TO authenticated
WITH CHECK (
  public.current_school_role() IN ('dean_of_studies', 'it')
  OR (public.current_school_role() = 'teacher'
    AND NOT EXISTS (SELECT 1 FROM public.midterm_reports r WHERE r.student_id = student_midterm_marks.student_id AND r.period = student_midterm_marks.period)
    AND public.teacher_can_enter_mark(student_midterm_marks.student_id, student_midterm_marks.class_name, student_midterm_marks.subject_id))
);
DROP POLICY IF EXISTS midterm_marks_update ON public.student_midterm_marks;
CREATE POLICY midterm_marks_update ON public.student_midterm_marks FOR UPDATE TO authenticated
USING (
  public.current_school_role() IN ('dean_of_studies', 'it')
  OR (public.current_school_role() = 'teacher'
    AND NOT EXISTS (SELECT 1 FROM public.midterm_reports r WHERE r.student_id = student_midterm_marks.student_id AND r.period = student_midterm_marks.period)
    AND EXISTS (SELECT 1 FROM public.teacher_class_assignments a WHERE a.teacher_user_id = auth.uid() AND a.class_name = student_midterm_marks.class_name))
)
WITH CHECK (
  public.current_school_role() IN ('dean_of_studies', 'it')
  OR (public.current_school_role() = 'teacher'
    AND public.teacher_can_enter_mark(student_midterm_marks.student_id, student_midterm_marks.class_name, student_midterm_marks.subject_id))
);
DROP POLICY IF EXISTS midterm_marks_delete ON public.student_midterm_marks;
CREATE POLICY midterm_marks_delete ON public.student_midterm_marks FOR DELETE TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'));

DROP POLICY IF EXISTS midterm_reports_read ON public.midterm_reports;
CREATE POLICY midterm_reports_read ON public.midterm_reports FOR SELECT TO authenticated
USING (
  NOT midterm_reports.is_deleted AND (
    public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it')
    OR (public.current_school_role() = 'teacher' AND EXISTS (
    SELECT 1 FROM public.teacher_class_assignments a
    WHERE a.teacher_user_id = auth.uid() AND a.class_name = midterm_reports.class_name
    ))
  )
);
DROP POLICY IF EXISTS midterm_reports_insert ON public.midterm_reports;
CREATE POLICY midterm_reports_insert ON public.midterm_reports FOR INSERT TO authenticated
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));
DROP POLICY IF EXISTS midterm_reports_update ON public.midterm_reports;
CREATE POLICY midterm_reports_update ON public.midterm_reports FOR UPDATE TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));
DROP POLICY IF EXISTS midterm_reports_delete ON public.midterm_reports;
-- Reports are soft-deleted by the UI so historical metadata remains auditable.

DROP POLICY IF EXISTS midterm_report_contacts_read ON public.midterm_report_contacts;
CREATE POLICY midterm_report_contacts_read ON public.midterm_report_contacts FOR SELECT TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'));
DROP POLICY IF EXISTS midterm_report_contacts_manage ON public.midterm_report_contacts;
CREATE POLICY midterm_report_contacts_manage ON public.midterm_report_contacts FOR ALL TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));

CREATE OR REPLACE FUNCTION public.snapshot_midterm_report_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.midterm_report_contacts (report_id, parent_name, phone, email, captured_at)
  SELECT NEW.id, coalesce(s.parent_name, ''), coalesce(s.phone, ''), coalesce(s.email, ''), now()
  FROM public.school_students s WHERE s.id = NEW.student_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS midterm_report_contact_snapshot_after_insert ON public.midterm_reports;
CREATE TRIGGER midterm_report_contact_snapshot_after_insert
AFTER INSERT ON public.midterm_reports
FOR EACH ROW EXECUTE FUNCTION public.snapshot_midterm_report_contact();

DROP POLICY IF EXISTS midterm_sms_dean_read ON public.midterm_sms_dispatches;
CREATE POLICY midterm_sms_dean_read ON public.midterm_sms_dispatches FOR SELECT TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'));
DROP POLICY IF EXISTS midterm_sms_dean_insert ON public.midterm_sms_dispatches;
CREATE POLICY midterm_sms_dean_insert ON public.midterm_sms_dispatches FOR INSERT TO authenticated
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));

DROP POLICY IF EXISTS sms_campaign_dispatch_read ON public.sms_campaign_dispatches;
CREATE POLICY sms_campaign_dispatch_read ON public.sms_campaign_dispatches FOR SELECT TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it'));
DROP POLICY IF EXISTS sms_campaign_dispatch_insert ON public.sms_campaign_dispatches;
CREATE POLICY sms_campaign_dispatch_insert ON public.sms_campaign_dispatches FOR INSERT TO authenticated
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it'));
DROP POLICY IF EXISTS sms_campaign_dispatch_update ON public.sms_campaign_dispatches;
CREATE POLICY sms_campaign_dispatch_update ON public.sms_campaign_dispatches FOR UPDATE TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it'));
DROP POLICY IF EXISTS sms_campaign_dispatch_delete ON public.sms_campaign_dispatches;
CREATE POLICY sms_campaign_dispatch_delete ON public.sms_campaign_dispatches FOR DELETE TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'));

-- Private report PDFs are reused for seven days, then refreshed by the client on request.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('midterm-reports', 'midterm-reports', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760, allowed_mime_types = ARRAY['application/pdf'];
DROP POLICY IF EXISTS midterm_report_pdf_read ON storage.objects;
CREATE POLICY midterm_report_pdf_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'midterm-reports' AND (
    public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it')
    OR EXISTS (
      SELECT 1 FROM public.midterm_reports r
      WHERE r.id::text = split_part(storage.objects.name, '/', 1)
        AND public.current_school_role() = 'teacher'
        AND EXISTS (SELECT 1 FROM public.teacher_class_assignments a WHERE a.teacher_user_id = auth.uid() AND a.class_name = r.class_name)
    )
  )
);
DROP POLICY IF EXISTS midterm_report_pdf_insert ON storage.objects;
CREATE POLICY midterm_report_pdf_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'midterm-reports' AND (
  public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it')
  OR EXISTS (SELECT 1 FROM public.midterm_reports r JOIN public.teacher_class_assignments a ON a.class_name = r.class_name
    WHERE r.id::text = split_part(storage.objects.name, '/', 1) AND a.teacher_user_id = auth.uid() AND public.current_school_role() = 'teacher')
));
DROP POLICY IF EXISTS midterm_report_pdf_update ON storage.objects;
CREATE POLICY midterm_report_pdf_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'midterm-reports' AND (
  public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it')
  OR EXISTS (SELECT 1 FROM public.midterm_reports r JOIN public.teacher_class_assignments a ON a.class_name = r.class_name
    WHERE r.id::text = split_part(storage.objects.name, '/', 1) AND a.teacher_user_id = auth.uid() AND public.current_school_role() = 'teacher')
))
WITH CHECK (bucket_id = 'midterm-reports' AND (
  public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it')
  OR EXISTS (SELECT 1 FROM public.midterm_reports r JOIN public.teacher_class_assignments a ON a.class_name = r.class_name
    WHERE r.id::text = split_part(storage.objects.name, '/', 1) AND a.teacher_user_id = auth.uid() AND public.current_school_role() = 'teacher')
));
DROP POLICY IF EXISTS midterm_report_pdf_delete ON storage.objects;
CREATE POLICY midterm_report_pdf_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'midterm-reports' AND public.current_school_role() IN ('dean_of_studies', 'it'));
