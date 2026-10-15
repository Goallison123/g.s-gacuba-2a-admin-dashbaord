# Changelog

## v1.0.0 — Mid-Term Engine and access-control update

### Added
- Mid-Term Engine route with class subject configuration, mark entry, generated report history, class/year/average filters, and no-marks/below-average register filters.
- Incremental report generation based on mark timestamps and automatic database compilation once all enabled subjects for a student have a mark.
- Dean of Studies report review actions, individual mark/comment editing, deletion, and single-student regeneration.
- Current parent contact snapshots stored separately from teacher-readable academic report rows.
- Private report PDF storage with a seven-day cache lifetime and on-demand PDF regeneration.
- Role-scoped student, subject, mark, report, notification, and PDF policies plus teacher/class assignment storage.
- Added `public.users` with the only supported roles: Dean of Studies, Headteacher, Teacher, and IT; database RLS now uses that profile table as the role source of truth.
- Added an IT-only Users & Roles screen for assigning the four supported roles.
- Added a local/staging-only synthetic data migration covering student registry, marks, reports, contacts, SMS drafts/deduplication, content, inquiries, and auto-compilation scenarios.
- Full-screen SMS composition, scrollable recipient preview, invalid-record skipping, and unique dispatch fingerprints.
- Student registration number and stream support in manual entry and CSV import, with parent email/phone validation.
- Mid-Term notification outbox and an Edge Function that sends queued email notifications through Resend.
- Unit tests for report compilation, mark timestamps, grading, SMS phone checks, and CSV validation.

### Operational notes
- This repository is a Vite/React + Supabase application. It contains no Python/Django API implementation. The existing application was not moved into new `web/` and `api/` roots because doing so would be a breaking deployment/layout change without an API project to move. The current structure and backend boundary are documented in [architecture.md](architecture.md).
- Email and SMS delivery need provider credentials and deployment. The email Edge Function is included; SMS campaigns are deduplicated and queued as drafts, but this repository does not contain an SMS gateway worker.
- Automatic report compilation is database-triggered when all enabled class subjects have marks. Automatic email delivery requires scheduling the included email function.
- Apply `20261015100000_create_users_and_rbac.sql` after the Mid-Term migration. Review role backfills; unrecognized existing accounts default to Teacher and should be reassigned by IT where needed.
- PDF cache validity is enforced on download requests. Expired PDFs are regenerated and overwrite their private storage object; no background cleanup job is required.
