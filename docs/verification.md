# Verification checklist

## Automated checks

- `npm test` — unit tests for grade boundaries, zero/disabled subject exclusion, change-since-generation, averages, recipient phone validation, and CSV mapping/validation.
- `npm run typecheck` — TypeScript application check.
- `npm run build` — Vite production bundle.
- `npm run lint` — whole-workspace ESLint check.

## Supabase integration / E2E scenarios

Run these against a disposable Supabase project after applying all migrations. Use separate authenticated accounts with trusted `app_metadata.role` claims; do not test RBAC only by hiding UI controls.

1. **Role isolation:** teacher sees only assigned class rows, only student name/class data in registry queries, cannot query another class, cannot update marks after a report, and cannot read parent contact snapshots or send SMS. Headteacher can read management reports and create allowed campaign drafts but cannot create mid-term SMS dispatches. Dean of Studies can manage assignments, subjects, students, reports, date, and SMS review. IT can manage user role assignments.
	- Verify users can read only their own profile, IT can list/change roles, non-IT users cannot update their own role, and direct attempts to set values outside the four-value enum fail.
2. **Date + notifications:** set a date and confirm outbox rows for every assigned teacher plus Dean review recipients. Verify the dashboard notification UI shows teacher alerts. Deploy/schedule the Resend worker and verify delivered timestamps only after provider success.
3. **Marks + compile:** add enabled subjects; enter one mark at a time and verify no auto-report before all enabled subjects are marked. Add the final mark (including zero where appropriate), verify report creation and Dean outbox entry, and confirm zero marks are omitted from rows and averages.
4. **Incremental generation:** run batch generation twice without changing marks (second run creates no duplicate); change a mark and verify a fresh report; change a positive mark to zero and verify the new snapshot excludes it. Force-regenerate one student and confirm other students are unchanged.
5. **Header snapshot:** update parent name/phone/email after an earlier report, regenerate, and verify the new report-contact snapshot uses current profile values while the old snapshot remains unchanged.
6. **PDF lifecycle:** download and verify a stored private PDF; confirm metadata/path, reuse while under seven days, age metadata past seven days and verify regeneration replaces the same private object. Test assigned teacher/headteacher downloads and unauthorized storage access.
7. **SMS safety:** check all/selected recipient preview scrolls with student/class subtitles; incomplete/invalid contacts are skipped and direct profile edits are unavailable; identical recipient/message batches conflict on the unique fingerprint; verify queued draft status and provider delivery separately.
8. **Registry:** create/edit/delete a student, validate required parent email/phone, import a valid CSV with registration number/stream, skip invalid/duplicate records, and verify database values.

External integration scenarios above are not run from this workspace: no production Supabase credentials, provider secrets, deployed Edge Function, or E2E browser test harness are configured here.

## Latest local run

- Unit tests: 7 passed.
- TypeScript: passed.
- Production build: passed; Vite reports a remaining >500 kB shared chunk and stale Browserslist data.
- ESLint: passed. The installed TypeScript 5.6.3 is slightly newer than the version range officially supported by the current typescript-eslint parser, which emits a compatibility warning.

## Test fixtures

`20261015110000_seed_school_test_data.sql` is for a local/staging database only—never production. It creates three fictional students, including a no-marks student, a zero-mark subject, historical/current report snapshots, auto-compilation data, drafts, duplicate-dispatch fingerprints, contacts, content, inquiries, and in-platform notification examples. It does not create Auth accounts, change the official date, or send email/SMS. Sample outbox alerts are marked delivered to exclude them from the email worker. Create `@example.test` accounts through Supabase Auth before testing role-specific navigation and RLS.
