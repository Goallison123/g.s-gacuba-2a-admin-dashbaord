-- Synthetic, repeatable fixtures for local/staging feature verification.
-- WARNING: apply only to a local or staging database, never production.
-- All rows use TEST-SEED identifiers, TEST classes, example.test addresses and
-- fictional phone numbers. Gamma deliberately has no marks. This migration does
-- not create Auth accounts, change the school's official date/settings, or send
-- email/SMS. Campaigns and content fixtures remain drafts.

INSERT INTO public.school_students (
  id, registry_code, registration_number, full_name, parent_name, email, phone,
  class_name, stream, fee_status, fee_amount, created_at, updated_at
) VALUES
  ('71000000-0000-4000-8000-000000000001', 'TEST-SEED-001', 'TEST-SEED-001', 'Test Learner Alpha', 'Test Parent Alpha', 'alpha.parent@example.test', '+250780000101', 'TEST-S1-A', 'Science', 'Paid', '120000 RWF', now(), now()),
  ('71000000-0000-4000-8000-000000000002', 'TEST-SEED-002', 'TEST-SEED-002', 'Test Learner Beta', 'Test Parent Beta', 'beta.parent@example.test', '+250780000102', 'TEST-S1-A', 'Partial', '60000 RWF', now(), now()),
  ('71000000-0000-4000-8000-000000000003', 'TEST-SEED-003', 'TEST-SEED-003', 'Test Learner Gamma', 'Test Parent Gamma', 'gamma.parent@example.test', '+250780000103', 'TEST-S1-B', 'Unpaid', '0 RWF', now(), now())
ON CONFLICT (id) DO UPDATE SET
  registry_code = EXCLUDED.registry_code,
  registration_number = EXCLUDED.registration_number,
  full_name = EXCLUDED.full_name,
  parent_name = EXCLUDED.parent_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  class_name = EXCLUDED.class_name,
  stream = EXCLUDED.stream,
  fee_status = EXCLUDED.fee_status,
  fee_amount = EXCLUDED.fee_amount,
  updated_at = now();

-- Assign the first existing test/teacher account if one is already provisioned.
INSERT INTO public.teacher_class_assignments (teacher_user_id, class_name)
SELECT u.id, 'TEST-S1-A'
FROM public.users u
WHERE u.role = 'teacher'
  AND u.email ILIKE '%@example.test'
ORDER BY u.created_at, u.id
LIMIT 1
ON CONFLICT (teacher_user_id, class_name) DO NOTHING;

INSERT INTO public.midterm_subjects (id, class_name, subject_name, is_enabled)
VALUES
  ('72000000-0000-4000-8000-000000000001', 'TEST-S1-A', 'Test Mathematics', true),
  ('72000000-0000-4000-8000-000000000002', 'TEST-S1-A', 'Test English', true),
  ('72000000-0000-4000-8000-000000000003', 'TEST-S1-A', 'Test Science', true),
  ('72000000-0000-4000-8000-000000000004', 'TEST-S1-B', 'Test History', true),
  ('72000000-0000-4000-8000-000000000005', 'TEST-S1-B', 'Test Geography', true)
ON CONFLICT (id) DO UPDATE SET
  class_name = EXCLUDED.class_name,
  subject_name = EXCLUDED.subject_name,
  is_enabled = EXCLUDED.is_enabled;

-- Previous-period report exercises history, duplicate names/period identity,
-- report viewer, comments, PDF generation and parent-contact snapshots.
-- Suppress only external-email outbox notifications while creating synthetic
-- reports. Keep report-contact snapshots and auto-compilation triggers active.
ALTER TABLE public.midterm_reports DISABLE TRIGGER midterm_report_review_after_insert;

INSERT INTO public.midterm_reports (
  id, student_id, student_name, class_name, period, average, review_status,
  report_data, generated_at, teacher_comment
) VALUES (
  '73000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001',
  'Test Learner Alpha', 'TEST-S1-A', '2025 Mid-Term', 78.00, 'approved',
  jsonb_build_object('rows', jsonb_build_array(
    jsonb_build_object('subject_id', '72000000-0000-4000-8000-000000000001', 'subject', 'Test Mathematics', 'mark', 82, 'weight', 8, 'grade', 'A'),
    jsonb_build_object('subject_id', '72000000-0000-4000-8000-000000000002', 'subject', 'Test English', 'mark', 74, 'weight', 7, 'grade', 'B')
  )),
  timestamptz '2025-10-10 09:00:00+00', 'Good effort; continue practising.'
)
ON CONFLICT (id) DO UPDATE SET
  student_id = EXCLUDED.student_id, student_name = EXCLUDED.student_name,
  class_name = EXCLUDED.class_name, period = EXCLUDED.period,
  average = EXCLUDED.average, review_status = EXCLUDED.review_status,
  report_data = EXCLUDED.report_data, generated_at = EXCLUDED.generated_at,
  teacher_comment = EXCLUDED.teacher_comment;

-- Pre-create Alpha's current report before inserting marks. Beta has no report;
-- completing Beta's enabled subjects exercises the auto-compilation trigger.
INSERT INTO public.midterm_reports (
  id, student_id, student_name, class_name, period, average, review_status,
  report_data, generated_at, teacher_comment
) VALUES (
  '73000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000001',
  'Test Learner Alpha', 'TEST-S1-A', to_char(current_date, 'YYYY') || ' Mid-Term',
  79.50, 'pending',
  jsonb_build_object('rows', jsonb_build_array(
    jsonb_build_object('subject_id', '72000000-0000-4000-8000-000000000001', 'subject', 'Test Mathematics', 'mark', 85, 'weight', 9, 'grade', 'A'),
    jsonb_build_object('subject_id', '72000000-0000-4000-8000-000000000002', 'subject', 'Test English', 'mark', 74, 'weight', 7, 'grade', 'B')
  )), now() - interval '1 day', 'Test report awaiting review.'
)
ON CONFLICT (id) DO UPDATE SET
  student_id = EXCLUDED.student_id, student_name = EXCLUDED.student_name,
  class_name = EXCLUDED.class_name, period = EXCLUDED.period,
  average = EXCLUDED.average, review_status = EXCLUDED.review_status,
  report_data = EXCLUDED.report_data, generated_at = EXCLUDED.generated_at,
  teacher_comment = EXCLUDED.teacher_comment;

INSERT INTO public.student_midterm_marks (
  id, student_id, class_name, period, subject_id, mark, entered_at, updated_at
) VALUES
  ('74000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002', 'TEST-S1-A', to_char(current_date, 'YYYY') || ' Mid-Term', '72000000-0000-4000-8000-000000000001', 60, now(), now()),
  ('74000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 'TEST-S1-A', to_char(current_date, 'YYYY') || ' Mid-Term', '72000000-0000-4000-8000-000000000002', 72, now(), now()),
  ('74000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000002', 'TEST-S1-A', to_char(current_date, 'YYYY') || ' Mid-Term', '72000000-0000-4000-8000-000000000003', 0, now(), now()),
  ('74000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000001', 'TEST-S1-A', to_char(current_date, 'YYYY') || ' Mid-Term', '72000000-0000-4000-8000-000000000001', 85, now(), now()),
  ('74000000-0000-4000-8000-000000000005', '71000000-0000-4000-8000-000000000001', 'TEST-S1-A', to_char(current_date, 'YYYY') || ' Mid-Term', '72000000-0000-4000-8000-000000000002', 74, now(), now()),
  ('74000000-0000-4000-8000-000000000006', '71000000-0000-4000-8000-000000000001', 'TEST-S1-A', to_char(current_date, 'YYYY') || ' Mid-Term', '72000000-0000-4000-8000-000000000003', 0, now(), now())
ON CONFLICT (student_id, period, subject_id) DO UPDATE SET
  class_name = EXCLUDED.class_name,
  mark = EXCLUDED.mark,
  entered_at = EXCLUDED.entered_at,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.school_contacts (
  id, parent_name, student_name, class_name, phone, email, preferred_channel, status
) VALUES
  ('75000000-0000-4000-8000-000000000001', 'Test Parent Alpha', 'Test Learner Alpha', 'TEST-S1-A', '+250780000101', 'alpha.parent@example.test', 'SMS', 'Active'),
  ('75000000-0000-4000-8000-000000000002', 'Test Parent Beta', 'Test Learner Beta', 'TEST-S1-A', '+250780000102', 'beta.parent@example.test', 'SMS', 'Active'),
  ('75000000-0000-4000-8000-000000000003', 'Test Parent Gamma', 'Test Learner Gamma', 'TEST-S1-B', '+250780000103', 'gamma.parent@example.test', 'SMS', 'Active')
ON CONFLICT (id) DO UPDATE SET
  parent_name = EXCLUDED.parent_name, student_name = EXCLUDED.student_name,
  class_name = EXCLUDED.class_name, phone = EXCLUDED.phone, email = EXCLUDED.email,
  preferred_channel = EXCLUDED.preferred_channel, status = EXCLUDED.status;

INSERT INTO public.notification_campaigns (
  id, title, message, channels, recipient_count, status, scheduled_for, category
) VALUES
  ('76000000-0000-4000-8000-000000000001', 'TEST · Term fees reminder', 'TEST DATA: Test Learner Beta has a remaining balance. Contact the school office for details.', ARRAY['SMS'], 2, 'Draft', NULL, 'FEES'),
  ('76000000-0000-4000-8000-000000000002', 'TEST · Parent meeting invitation', 'TEST DATA: Families in TEST-S1-A are invited to the school meeting on 20 November.', ARRAY['SMS'], 2, 'Draft', NULL, 'GENERAL'),
  ('76000000-0000-4000-8000-000000000003', 'TEST · Examination report ready', 'TEST DATA: Mid-term reports are ready for collection.', ARRAY['SMS'], 1, 'Draft', NULL, 'Examination result')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, message = EXCLUDED.message, channels = EXCLUDED.channels,
  recipient_count = EXCLUDED.recipient_count, status = EXCLUDED.status,
  scheduled_for = EXCLUDED.scheduled_for, category = EXCLUDED.category;

INSERT INTO public.sms_campaign_dispatches (fingerprint, campaign_id, recipient_ids)
VALUES (
  'FEES|Dear Parent, remaining school fees balance for {FULLNAME} is {FEES}. Please settle promptly.|71000000-0000-4000-8000-000000000001,71000000-0000-4000-8000-000000000002,71000000-0000-4000-8000-000000000003',
  '76000000-0000-4000-8000-000000000001',
  ARRAY['71000000-0000-4000-8000-000000000001'::uuid, '71000000-0000-4000-8000-000000000002'::uuid, '71000000-0000-4000-8000-000000000003'::uuid]
)
ON CONFLICT (fingerprint) DO UPDATE SET
  campaign_id = EXCLUDED.campaign_id, recipient_ids = EXCLUDED.recipient_ids;

INSERT INTO public.midterm_sms_dispatches (fingerprint, period, campaign_id, recipient_count)
VALUES ('73000000-0000-4000-8000-000000000002:G.S Gacuba: Your child’s mid-term report is ready. Please contact the school for details.', to_char(current_date, 'YYYY') || ' Mid-Term', '76000000-0000-4000-8000-000000000003', 1)
ON CONFLICT (fingerprint) DO UPDATE SET
  period = EXCLUDED.period, campaign_id = EXCLUDED.campaign_id,
  recipient_count = EXCLUDED.recipient_count;

-- In-platform sample alerts for explicitly-created @example.test accounts.
-- Marked delivered so a scheduled email worker will never send fixture messages.
WITH fixture_alerts AS (
  SELECT u.id AS recipient_user_id, u.email AS recipient_email,
         'teacher_midterm_date_set'::text AS event_type,
         jsonb_build_object('official_date', '2026-11-16', 'class_name', a.class_name, 'test_fixture', true) AS payload
  FROM public.users u
  JOIN public.teacher_class_assignments a ON a.teacher_user_id = u.id AND a.class_name = 'TEST-S1-A'
  WHERE u.role = 'teacher' AND u.email ILIKE '%@example.test'
  UNION ALL
  SELECT u.id, u.email, 'dean_midterm_review',
         jsonb_build_object('official_date', '2026-11-16', 'action_options', jsonb_build_array('approve', 'extend_deadline', 'regenerate'), 'test_fixture', true)
  FROM public.users u
  WHERE u.role IN ('dean_of_studies', 'it') AND u.email ILIKE '%@example.test'
  UNION ALL
  SELECT u.id, u.email, 'midterm_report_ready_for_dean',
         jsonb_build_object('report_id', '73000000-0000-4000-8000-000000000002', 'student_name', 'Test Learner Alpha', 'class_name', 'TEST-S1-A', 'period', to_char(current_date, 'YYYY') || ' Mid-Term', 'average', 79.5, 'action_options', jsonb_build_array('approve', 'extend_deadline', 'regenerate'), 'test_fixture', true)
  FROM public.users u
  WHERE u.role IN ('dean_of_studies', 'it') AND u.email ILIKE '%@example.test'
)
INSERT INTO public.midterm_notification_outbox (
  recipient_user_id, recipient_email, event_type, payload, delivered_at
)
SELECT f.recipient_user_id, f.recipient_email, f.event_type, f.payload, now()
FROM fixture_alerts f
WHERE NOT EXISTS (
  SELECT 1 FROM public.midterm_notification_outbox old
  WHERE old.recipient_user_id = f.recipient_user_id
    AND old.event_type = f.event_type
    AND old.payload @> f.payload
);

INSERT INTO public.school_content (
  id, title, content_type, excerpt, image_url, status, published_at,
  author, category, description, summary, content, read_time, image
) VALUES
  ('77000000-0000-4000-8000-000000000001', 'TEST · Welcome to G.S. Gacuba', 'News', 'Synthetic sample article for testing the content manager.', NULL, 'Draft', NULL,
   'Test Editor', 'School news', 'Test-only news item; do not publish to the public site.', 'A fixture article for content editing workflows.', ARRAY['TEST DATA: This content is synthetic.', 'It is safe to edit or delete.'], '1 min read', NULL),
  ('77000000-0000-4000-8000-000000000002', 'TEST · Science fair gallery', 'Gallery', 'Synthetic gallery item for testing content filters.', 'https://example.test/test-gallery.jpg', 'Draft', NULL,
   'Test Editor', 'School events', 'Placeholder image for local/staging testing only.', 'Synthetic gallery fixture.', ARRAY[]::text[], NULL, 'https://example.test/test-gallery.jpg')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, content_type = EXCLUDED.content_type,
  excerpt = EXCLUDED.excerpt, image_url = EXCLUDED.image_url,
  status = EXCLUDED.status, published_at = EXCLUDED.published_at,
  author = EXCLUDED.author, category = EXCLUDED.category,
  description = EXCLUDED.description, summary = EXCLUDED.summary,
  content = EXCLUDED.content, read_time = EXCLUDED.read_time, image = EXCLUDED.image;

INSERT INTO public.school_inquiries (
  id, visitor_name, email, phone, topic, message, status
) VALUES
  ('78000000-0000-4000-8000-000000000001', 'Test Visitor One', 'visitor.one@example.test', '+250780000201', 'Admissions', 'TEST DATA: Please share the admissions process for a future term.', 'New'),
  ('78000000-0000-4000-8000-000000000002', 'Test Visitor Two', 'visitor.two@example.test', '+250780000202', 'School fees', 'TEST DATA: I would like to confirm the fee schedule.', 'In progress')
ON CONFLICT (id) DO UPDATE SET
  visitor_name = EXCLUDED.visitor_name, email = EXCLUDED.email,
  phone = EXCLUDED.phone, topic = EXCLUDED.topic,
  message = EXCLUDED.message, status = EXCLUDED.status;

ALTER TABLE public.midterm_reports ENABLE TRIGGER midterm_report_review_after_insert;

-- Optional content tables are queried by the app but are not defined in this
-- repository's migrations. Seed them only when their expected schema exists.
DO $$
BEGIN
  IF to_regclass('public.gallery_items') IS NOT NULL
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_items' AND column_name IN ('id', 'src', 'title', 'category', 'description', 'status', 'order')) = 7 THEN
    EXECUTE $seed_gallery$
      INSERT INTO public.gallery_items (id, src, title, category, description, status, "order")
      VALUES ('79000000-0000-4000-8000-000000000001', 'https://example.test/test-gallery.jpg', 'TEST · Science fair gallery', 'School events', 'Synthetic test gallery entry.', 'Draft', 999)
      ON CONFLICT (id) DO UPDATE SET src = EXCLUDED.src, title = EXCLUDED.title,
        category = EXCLUDED.category, description = EXCLUDED.description,
        status = EXCLUDED.status, "order" = EXCLUDED."order"
    $seed_gallery$;
  END IF;

  IF to_regclass('public.news_items') IS NOT NULL
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'news_items' AND column_name IN ('id', 'title', 'date', 'category', 'summary', 'content', 'author', 'read_time', 'image_url', 'status', 'published_at')) = 11 THEN
    EXECUTE $seed_news$
      INSERT INTO public.news_items (id, title, date, category, summary, content, author, read_time, image_url, status, published_at)
      VALUES ('79000000-0000-4000-8000-000000000002', 'TEST · Welcome to G.S. Gacuba', '15 October 2026', 'School news', 'Synthetic test article.', ARRAY['TEST DATA: This article is fictional.'], 'Test Editor', '1 min read', NULL, 'Draft', NULL)
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, date = EXCLUDED.date,
        category = EXCLUDED.category, summary = EXCLUDED.summary, content = EXCLUDED.content,
        author = EXCLUDED.author, read_time = EXCLUDED.read_time,
        image_url = EXCLUDED.image_url, status = EXCLUDED.status,
        published_at = EXCLUDED.published_at
    $seed_news$;
  END IF;
END $$;

-- Auth users are deliberately not created by migrations. Create test logins in
-- Supabase Auth; they are provisioned as Teacher by default, then assign a role
-- from Users & Roles. To assign the first test teacher to the seeded class, run:
-- INSERT INTO public.teacher_class_assignments (teacher_user_id, class_name)
-- SELECT id, 'TEST-S1-A' FROM public.users WHERE role = 'teacher'
-- ORDER BY created_at, id LIMIT 1 ON CONFLICT DO NOTHING;
