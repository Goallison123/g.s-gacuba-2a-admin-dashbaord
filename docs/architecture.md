# Architecture and feature map

## Existing repository boundary

The checked-out project is a browser application, not a Django/Python monorepo. The deployed frontend currently lives at the repository root and uses React, TypeScript, Vite, and Supabase. Database schema and role policies live under `supabase/migrations`; the notification email worker lives under `supabase/functions`.

```text
.
├── src/                         React/Vite application
│   ├── App.tsx                  Login, routes, role-based navigation
│   ├── pages/
│   │   ├── MidTermEngine.tsx    Mid-term administration, reports, PDF/SMS workflows
│   │   ├── Students.tsx         Dean of Studies registry CRUD and CSV import
│   │   ├── UserManagement.tsx   IT-only role assignment screen
│   │   └── TeacherStudentRegister.tsx  Teacher names/classes-only register
│   ├── components/modals/       Existing full-screen notification composer
│   └── utils/
│       ├── midterm.ts           Testable report/grade/recipient rules
│       └── studentCsv.ts        CSV parser, mapping, validation
├── supabase/
│   ├── migrations/              Registry, mid-term schema and RLS policies
│   │   └── 20261015100000_create_users_and_rbac.sql  Canonical user roles and RLS policies
│   └── functions/
│       └── dispatch-midterm-emails/  Resend-backed outbox worker
├── docs/                        Architecture, verification, changelog
└── package.json                 Vite scripts and JavaScript dependencies
```

There is no `api/` Django application, Python dependency manifest, or Django settings/URL structure in this workspace. No new `web/`/`api/` move was made: the Vite root layout is assumed by the existing build/deployment scripts, and moving it would break existing entry points. A future Django API should be introduced as a separately scoped project migration rather than represented by an empty `api/` directory.

## Mid-Term data flow

1. Dean of Studies creates class subjects, assigns teachers by Supabase Auth user UUID, and sets the official date.
2. A database trigger records in-platform teacher alerts and Dean of Studies review/email outbox events.
3. Teachers can read only their assigned classes and submit marks until a report exists. RLS independently enforces this; front-end route hiding is not the security boundary.
4. Once each enabled subject has a mark (a zero is a recorded mark), a database trigger automatically compiles a report if marks changed since the last generation. Zero-mark subjects are omitted from report rows. The Dean of Studies can also run a batch generation from the page.
5. Every report row stores the period, student/class identity snapshot, subject rows, average, author, and generation time. Parent contact details are snapshotted to a Dean-of-Studies/IT-only table so they cannot be read through teacher report queries.
6. The Dean of Studies can review/edit marks and comments, delete a report, force-regenerate one student report, and review recipients immediately after generation.
7. PDFs are private Supabase Storage objects. A PDF younger than seven days is reused; a missing/older PDF is regenerated at download time and replaces the same object. The report metadata and historical report remain stored.

## Roles

| Role | Application access | Database enforcement |
|---|---|---|
| Teacher | Assigned-class register (names/classes only), mark entry, assigned-class report history, PDF downloads | `teacher_class_assignments`; student/mark/report row policies; teacher mark writes blocked after report creation |
| Dean of Studies | Registry CRUD/import/export, assignments, subjects, dates, report management, SMS review | `public.users.role`; privileged table/storage policies |
| Headteacher | Overview, management report reading/PDF, fees and meeting campaign drafts | Read-only report access; campaign insert/dispatch access; no mid-term SMS ledger access |
| IT | User role management and technical administration | `public.users.role`; privileged table/storage policies |

`public.users` is the role source of truth. Its `role` is constrained to exactly `dean_of_studies`, `headteacher`, `teacher`, or `it`. Authenticated users can read their own profile; IT can read and change role assignments. The auth-user trigger provisions new accounts as teachers by default. Database policies call `current_school_role()` to read this profile, so user-editable JWT metadata cannot grant permissions.

## Required setup

1. Apply migrations in timestamp order, including `20261015090000_create_midterm_engine.sql` and `20261015100000_create_users_and_rbac.sql`. Apply `20261015110000_seed_school_test_data.sql` **only to local/staging databases, never production**.
2. Review backfilled `public.users` records and set each user's role to one of the four supported values. Unrecognized pre-existing roles default to `teacher`; assign role changes from an IT account.
3. Create `teacher_class_assignments` rows for each teacher/class from the Dean of Studies page using the teacher's Supabase Auth UUID.
4. Add enabled `midterm_subjects` rows (or use the Dean of Studies' subject controls) for each class before teachers enter marks.
5. Deploy `supabase/functions/dispatch-midterm-emails` and configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `MIDTERM_EMAIL_FROM`. Schedule authenticated POST invocations from Supabase Scheduled Functions or a secured scheduler. Never expose the service key to the browser.
6. Configure an SMS provider worker separately before treating draft campaigns as sent. Dispatch ledgers persist recipient UUIDs and unique fingerprints, but the UI deliberately reports campaigns as queued drafts until a provider is connected.

The test-data migration seeds clearly labelled `TEST-*` students, classes, marks, periods, report snapshots, SMS draft/duplicate fingerprints, content, contacts, and inquiries. It does not create login accounts, change the official mid-term date, or dispatch email/SMS. Create test accounts through Supabase Auth; use IT to assign roles. A teacher account using an `@example.test` address is assigned to `TEST-S1-A` automatically when the seed migration runs; otherwise, assign the class manually for teacher-RLS tests.

## External service limits

- Email delivery is not active until the Edge Function is deployed, secrets are configured, and a schedule invokes it.
- SMS provider dispatch is not included; existing and new campaigns are safely stored as drafts/scheduled campaign records only.
- The automatic compilation trigger compiles once all *enabled* subjects have a mark. Report batch generation remains available for incomplete classes.
- PDF expiry is checked when a user requests a download. Old storage objects are overwritten on regeneration; an independent cleanup/scheduler is optional.
- The existing gallery/news tables are managed by the pre-existing application and may have external project-level policies not represented in these migrations. Verify their deployed RLS before expanding staff access.
