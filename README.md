# Mohammed Afify — Learning & Professional Website

A responsive, bilingual (Arabic/English) static website built with HTML, CSS and vanilla JavaScript for GitHub Pages.

## Current deployment and membership status
Before opening paid lessons, review [the private course-content security audit](SECURITY-AUDIT-PRIVATE-COURSE-CONTENT-2026-11-23.md). JavaScript page gating does not protect static HTML or public video URLs.


Read [MEMBERSHIP-V2-STATUS-2026-11-22.md](MEMBERSHIP-V2-STATUS-2026-11-22.md) before making membership or deployment changes.

The repository contains two distinct website layers:
- The repository root contains the richer membership application and its Supabase client integration.
- `public-site/` is the isolated public-facing Cloudflare Pages package. Verify the Pages build-directory setting before deploying; do not copy private student/admin pages or private learning files into this package.

**Important:** The early `sql/membership-schema.sql` and `sql/real-assessments-v1.sql` are V1 references only. They must not be run against the current Membership V2 database. Follow `sql/MEMBERSHIP_V2_REPAIR_PLAN.md` and the read-only preflight/audit files instead.


## Included
- Arabic RTL and English LTR language toggle
- Responsive navigation for desktop and mobile
- Learning paths: programming, data analysis, management, accounting and Odoo ERP
- Filterable course cards
- Downloadable sample CSV resource
- Service overview and contact form that prepares an email in the visitor's email application
- SEO metadata and SVG favicon

## Publish on GitHub Pages

Repository: https://github.com/MohamedAfify2025/mohammed-afify  
Current site: https://mohamedafify2025.github.io/mohammed-afify/

1. Download and extract this ZIP.
2. Open the repository on GitHub.
3. Upload the files and folders from this package to the repository root. Keep `index.html`, `styles.css`, `script.js`, `assets/`, and `resources/` at the root level.
4. Review the changes, then commit them to the `main` branch.
5. In **Settings → Pages**, verify that deployment uses the `main` branch and `/(root)`.
6. Wait for GitHub Pages to finish deploying, then open the site and test both languages on desktop and mobile.

## Before publishing
1. In `script.js`, replace:
   `const CONTACT_EMAIL = "replace-with-your-email@example.com";`
   with the real email address where you want to receive inquiries.
2. Replace sample course links and descriptions with actual lesson/video URLs when ready.
3. Review the biography and service descriptions to ensure they accurately represent the services you offer.
4. The contact form uses `mailto:`. It does not store submissions on a server. Student account starter pages are included in `membership/`, backed by Supabase after setup. Follow `SETUP-MEMBERSHIP.md` before using them. Payment processing and secure protection of private course files are not configured in this package.

## Local preview
Open `index.html` in a browser. For a more realistic local test, serve the folder with a simple static web server.

## Brand line
**Learn • Analyze • Build • Transform**

## Membership regression test

Run the waived-subscription balance regression test with Node.js 18 or later:

```bash
node tests/payment-remaining.test.mjs
```

The test executes the current `paymentRemaining()` implementation from `assets/js/admin-subscriptions.js` and verifies the payment-selector integration. It does not connect to Supabase or replace database acceptance testing.

## Student accounts and memberships

See [SETUP-MEMBERSHIP.md](SETUP-MEMBERSHIP.md) for the Supabase setup, SQL schema, admin account setup, limitations, and testing checklist.
