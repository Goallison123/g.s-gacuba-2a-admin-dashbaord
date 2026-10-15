-- Canonical school users and database-enforced RBAC.
-- The only supported roles are dean_of_studies, headteacher, teacher, and it.

DO $$ BEGIN
  CREATE TYPE public.school_role AS ENUM ('dean_of_studies', 'headteacher', 'teacher', 'it');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  role public.school_role NOT NULL DEFAULT 'teacher',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.users TO authenticated;

-- Backfill existing accounts from trusted app metadata only. Unrecognized roles
-- become teacher and can then be explicitly reassigned by an IT user.
INSERT INTO public.users (id, email, full_name, role)
SELECT
  a.id,
  coalesce(a.email, a.id::text || '@invalid.local'),
  coalesce(a.raw_user_meta_data ->> 'full_name', ''),
  CASE lower(coalesce(a.raw_app_meta_data ->> 'role', a.raw_app_meta_data ->> 'user_role', ''))
    WHEN 'dean' THEN 'dean_of_studies'::public.school_role
    WHEN 'dean of studies' THEN 'dean_of_studies'::public.school_role
    WHEN 'dean_of_studies' THEN 'dean_of_studies'::public.school_role
    WHEN 'headmaster' THEN 'headteacher'::public.school_role
    WHEN 'head teacher' THEN 'headteacher'::public.school_role
    WHEN 'headteacher' THEN 'headteacher'::public.school_role
    WHEN 'teacher' THEN 'teacher'::public.school_role
    WHEN 'it' THEN 'it'::public.school_role
    WHEN 'admin' THEN 'it'::public.school_role
    WHEN 'administrator' THEN 'it'::public.school_role
    ELSE 'teacher'::public.school_role
  END
FROM auth.users a
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = CASE WHEN public.users.full_name = '' THEN EXCLUDED.full_name ELSE public.users.full_name END,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.current_school_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.role::text
  FROM public.users u
  WHERE u.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.current_school_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_school_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_school_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'A school user ID cannot be changed';
  END IF;
  IF public.current_school_role() IS DISTINCT FROM 'it'
     AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Only IT can change a user''s role';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_school_user_update_before_update ON public.users;
CREATE TRIGGER enforce_school_user_update_before_update
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_school_user_update();

CREATE OR REPLACE FUNCTION public.sync_school_user_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  assigned_role public.school_role;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.users WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  assigned_role := CASE lower(coalesce(NEW.raw_app_meta_data ->> 'role', NEW.raw_app_meta_data ->> 'user_role', ''))
    WHEN 'dean' THEN 'dean_of_studies'::public.school_role
    WHEN 'dean of studies' THEN 'dean_of_studies'::public.school_role
    WHEN 'dean_of_studies' THEN 'dean_of_studies'::public.school_role
    WHEN 'headmaster' THEN 'headteacher'::public.school_role
    WHEN 'head teacher' THEN 'headteacher'::public.school_role
    WHEN 'headteacher' THEN 'headteacher'::public.school_role
    WHEN 'teacher' THEN 'teacher'::public.school_role
    WHEN 'it' THEN 'it'::public.school_role
    WHEN 'admin' THEN 'it'::public.school_role
    WHEN 'administrator' THEN 'it'::public.school_role
    ELSE 'teacher'::public.school_role
  END;

  INSERT INTO public.users (id, email, full_name, role)
  VALUES (NEW.id, coalesce(NEW.email, NEW.id::text || '@invalid.local'), coalesce(NEW.raw_user_meta_data ->> 'full_name', ''), assigned_role)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE WHEN public.users.full_name = '' THEN EXCLUDED.full_name ELSE public.users.full_name END,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_school_user_after_auth_change ON auth.users;
CREATE TRIGGER sync_school_user_after_auth_change
AFTER INSERT OR UPDATE OF email, raw_user_meta_data OR DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_school_user_from_auth();

DROP POLICY IF EXISTS users_read_self_or_it ON public.users;
CREATE POLICY users_read_self_or_it ON public.users
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.current_school_role() = 'it');

DROP POLICY IF EXISTS users_update_self_or_it ON public.users;
CREATE POLICY users_update_self_or_it ON public.users
FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.current_school_role() = 'it')
WITH CHECK (
  (id = auth.uid() AND role::text = public.current_school_role())
  OR public.current_school_role() = 'it'
);

-- Student records: only teacher_student_register exposes teacher-readable fields.
DROP POLICY IF EXISTS school_students_role_select ON public.school_students;
CREATE POLICY school_students_role_select ON public.school_students FOR SELECT TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it'));
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

DROP POLICY IF EXISTS teacher_assignments_read ON public.teacher_class_assignments;
CREATE POLICY teacher_assignments_read ON public.teacher_class_assignments FOR SELECT TO authenticated
USING (teacher_user_id = auth.uid() OR public.current_school_role() IN ('dean_of_studies', 'it'));
DROP POLICY IF EXISTS teacher_assignments_manage ON public.teacher_class_assignments;
CREATE POLICY teacher_assignments_manage ON public.teacher_class_assignments FOR ALL TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));

DROP POLICY IF EXISTS midterm_subjects_read ON public.midterm_subjects;
CREATE POLICY midterm_subjects_read ON public.midterm_subjects FOR SELECT TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'headteacher', 'teacher', 'it'));
DROP POLICY IF EXISTS midterm_subjects_manage ON public.midterm_subjects;
CREATE POLICY midterm_subjects_manage ON public.midterm_subjects FOR ALL TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));

DROP POLICY IF EXISTS midterm_settings_read ON public.midterm_settings;
CREATE POLICY midterm_settings_read ON public.midterm_settings FOR SELECT TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'headteacher', 'teacher', 'it'));
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
    AND NOT EXISTS (SELECT 1 FROM public.midterm_reports r WHERE r.student_id = student_midterm_marks.student_id AND r.period = student_midterm_marks.period AND NOT r.is_deleted)
    AND public.teacher_can_enter_mark(student_midterm_marks.student_id, student_midterm_marks.class_name, student_midterm_marks.subject_id))
);
DROP POLICY IF EXISTS midterm_marks_update ON public.student_midterm_marks;
CREATE POLICY midterm_marks_update ON public.student_midterm_marks FOR UPDATE TO authenticated
USING (
  public.current_school_role() IN ('dean_of_studies', 'it')
  OR (public.current_school_role() = 'teacher'
    AND NOT EXISTS (SELECT 1 FROM public.midterm_reports r WHERE r.student_id = student_midterm_marks.student_id AND r.period = student_midterm_marks.period AND NOT r.is_deleted)
    AND public.teacher_can_enter_mark(student_midterm_marks.student_id, student_midterm_marks.class_name, student_midterm_marks.subject_id))
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

DROP POLICY IF EXISTS midterm_report_contacts_read ON public.midterm_report_contacts;
CREATE POLICY midterm_report_contacts_read ON public.midterm_report_contacts FOR SELECT TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'));
DROP POLICY IF EXISTS midterm_report_contacts_manage ON public.midterm_report_contacts;
CREATE POLICY midterm_report_contacts_manage ON public.midterm_report_contacts FOR ALL TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));

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

-- Existing shared-workspace policies were intentionally removed in the earlier migration.
DROP POLICY IF EXISTS school_contacts_role_read ON public.school_contacts;
CREATE POLICY school_contacts_role_read ON public.school_contacts FOR SELECT TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it'));
DROP POLICY IF EXISTS school_contacts_role_manage ON public.school_contacts;
CREATE POLICY school_contacts_role_manage ON public.school_contacts FOR ALL TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));

DROP POLICY IF EXISTS notification_campaign_role_read ON public.notification_campaigns;
CREATE POLICY notification_campaign_role_read ON public.notification_campaigns FOR SELECT TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it'));
DROP POLICY IF EXISTS notification_campaign_role_insert ON public.notification_campaigns;
CREATE POLICY notification_campaign_role_insert ON public.notification_campaigns FOR INSERT TO authenticated
WITH CHECK (
  public.current_school_role() IN ('dean_of_studies', 'it')
  OR (public.current_school_role() = 'headteacher' AND category IN ('FEES', 'GENERAL', 'Fee reminder', 'Parent notification'))
);
DROP POLICY IF EXISTS notification_campaign_role_update ON public.notification_campaigns;
CREATE POLICY notification_campaign_role_update ON public.notification_campaigns FOR UPDATE TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));
DROP POLICY IF EXISTS notification_campaign_role_delete ON public.notification_campaigns;
CREATE POLICY notification_campaign_role_delete ON public.notification_campaigns FOR DELETE TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'));

DROP POLICY IF EXISTS school_content_role_manage ON public.school_content;
CREATE POLICY school_content_role_manage ON public.school_content FOR ALL TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));
DROP POLICY IF EXISTS school_inquiries_role_manage ON public.school_inquiries;
CREATE POLICY school_inquiries_role_manage ON public.school_inquiries FOR ALL TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));

DROP POLICY IF EXISTS workspace_settings_role_read ON public.workspace_settings;
CREATE POLICY workspace_settings_role_read ON public.workspace_settings FOR SELECT TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'));
DROP POLICY IF EXISTS workspace_settings_role_insert ON public.workspace_settings;
CREATE POLICY workspace_settings_role_insert ON public.workspace_settings FOR INSERT TO authenticated
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));
DROP POLICY IF EXISTS workspace_settings_role_update ON public.workspace_settings;
CREATE POLICY workspace_settings_role_update ON public.workspace_settings FOR UPDATE TO authenticated
USING (public.current_school_role() IN ('dean_of_studies', 'it'))
WITH CHECK (public.current_school_role() IN ('dean_of_studies', 'it'));

-- Restrict report-PDF storage access to assigned report viewers and report administrators.
DROP POLICY IF EXISTS midterm_report_pdf_read ON storage.objects;
CREATE POLICY midterm_report_pdf_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'midterm-reports' AND (
    public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it')
    OR EXISTS (
      SELECT 1 FROM public.midterm_reports r
      JOIN public.teacher_class_assignments a ON a.class_name = r.class_name
      WHERE r.id::text = split_part(storage.objects.name, '/', 1)
        AND a.teacher_user_id = auth.uid()
        AND public.current_school_role() = 'teacher'
        AND NOT r.is_deleted
    )
  )
);
DROP POLICY IF EXISTS midterm_report_pdf_insert ON storage.objects;
CREATE POLICY midterm_report_pdf_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'midterm-reports' AND (
  public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it')
  OR EXISTS (SELECT 1 FROM public.midterm_reports r JOIN public.teacher_class_assignments a ON a.class_name = r.class_name
    WHERE r.id::text = split_part(storage.objects.name, '/', 1) AND a.teacher_user_id = auth.uid() AND public.current_school_role() = 'teacher' AND NOT r.is_deleted)
));
DROP POLICY IF EXISTS midterm_report_pdf_update ON storage.objects;
CREATE POLICY midterm_report_pdf_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'midterm-reports' AND (
  public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it')
  OR EXISTS (SELECT 1 FROM public.midterm_reports r JOIN public.teacher_class_assignments a ON a.class_name = r.class_name
    WHERE r.id::text = split_part(storage.objects.name, '/', 1) AND a.teacher_user_id = auth.uid() AND public.current_school_role() = 'teacher' AND NOT r.is_deleted)
))
WITH CHECK (bucket_id = 'midterm-reports' AND (
  public.current_school_role() IN ('dean_of_studies', 'headteacher', 'it')
  OR EXISTS (SELECT 1 FROM public.midterm_reports r JOIN public.teacher_class_assignments a ON a.class_name = r.class_name
    WHERE r.id::text = split_part(storage.objects.name, '/', 1) AND a.teacher_user_id = auth.uid() AND public.current_school_role() = 'teacher' AND NOT r.is_deleted)
));
DROP POLICY IF EXISTS midterm_report_pdf_delete ON storage.objects;
CREATE POLICY midterm_report_pdf_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'midterm-reports' AND public.current_school_role() IN ('dean_of_studies', 'it'));

-- Outbox mail is sent server-side; the function targets these canonical roles.
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
    JOIN public.users u ON u.id = a.teacher_user_id AND u.role = 'teacher';

    INSERT INTO public.midterm_notification_outbox (recipient_user_id, recipient_email, event_type, payload)
    SELECT u.id, u.email, 'dean_midterm_review',
      jsonb_build_object('official_date', NEW.official_date, 'action_options', jsonb_build_array('approve', 'extend_deadline', 'regenerate'))
    FROM public.users u WHERE u.role IN ('dean_of_studies', 'it');
  END IF;
  RETURN NEW;
END;
$$;

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
  FROM public.users u WHERE u.role IN ('dean_of_studies', 'it');
  RETURN NEW;
END;
$$;
