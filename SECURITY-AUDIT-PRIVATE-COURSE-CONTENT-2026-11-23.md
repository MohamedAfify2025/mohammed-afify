# Private Course Content Security Audit — 23 November 2026

**Repository:** `MohamedAfify2025/mohammed-afify`  
**Baseline reviewed:** `main` branch, `academy/` folder, `assets/js/membership-access-control.js`  
**Severity:** High — blocks opening paid course content as a genuinely private service.  
**Database writes:** None.

## Executive finding

The current access controller is a browser-side presentation gate, not a server-side content boundary. Its own source comment states that GitHub Pages HTML and public media URLs remain public. The static lesson pages still contain video embed addresses in their HTML.

## Evidence from the current repository

- The `academy/` directory contains 22 HTML files in the current repository tree.
- All 22 inspected HTML files load `assets/js/membership-access-control.js`.
- Across those pages, 168 iframe elements were counted. 167 YouTube video IDs were identified within the video-bearing pages; counts are per page and may include the same ID more than once across pages.
- Pages with hard-coded YouTube embeds include:
  - `academy/accounting-lesson-u1-01.html` — 1 embed.
  - `academy/business-administration.html` — 3 embeds.
  - `academy/data-analysis.html` — 8 embeds.
  - `academy/excel.html` — 102 embeds.
  - `academy/icdl.html` — 9 embeds.
  - `academy/powerpoint.html` — 9 embeds.
  - `academy/programming.html` — 5 iframe elements, including 4 distinct YouTube IDs in that page.
  - `academy/scratch.html` — 9 embeds.
  - `academy/windows.html` — 12 embeds.
  - `academy/word.html` — 10 embeds.
- The iframe `src` values are present directly in the static HTML. Hiding the `main` element during verification does not prevent the browser from requesting an iframe whose `src` is already present.
- When a user has no matching course subscription, `membership-access-control.js` replaces the visible page content with an access notice. That unauthorized branch does not clear the page's existing iframe `src` attributes. The helper `applyCapabilities()` removes video sources only when a course is authorized but its `can_watch_video` capability is false; it is not called when no authorized course row is found.
- `academy/accounting-lesson-u1-01.html` and `academy/accounting-quiz-u1.html` load the access controller but do not contain the early `m-access-checking` preload gate found in most other academy pages. This also creates a risk of a brief content flash before the deferred JavaScript runs.
- `public-site/` is a separate static marketing package. The checked public entry page does not load the Supabase SDK/configuration or link directly to private account/admin pages. Keep this separation.

## What this means

- Login plus JavaScript hiding does not make public HTML, lesson markup, YouTube IDs, PDFs, or public media URLs private.
- A user can inspect static page source or network requests. Unlisted YouTube videos are not equivalent to protected streaming; anyone who obtains the embed/watch URL may be able to share it.
- The current controller improves the signed-in experience and can hide UI elements based on subscription state, but it must not be treated as the security boundary for paid content.

## Required remediation before opening paid content

1. Keep `public-site/` limited to the public profile, service descriptions, course catalogue/preview, and public announcements.
2. Move private lesson bodies, quiz answer keys, files, and video playback references out of static `academy/*.html` files.
3. Store private files in a non-public storage bucket and issue short-lived signed URLs only after a server-side/RLS check verifies the user's active subscription and exact course capability.
4. For video, use private/tokenized playback or another hosting mode that supports revocable access and domain/token controls. Do not rely on unlisted YouTube IDs for paid lessons.
5. Serve lesson content/assessment data through authenticated server-side functions/RPCs. Never send answer keys or confidential lesson payloads to an unauthorized browser.
6. Add acceptance tests for:
   - direct URL access by a logged-out visitor;
   - a logged-in student with no subscription to the course;
   - an approved student with an unpaid or suspended subscription;
   - a student whose active plan lacks `can_watch_video` or `can_download`;
   - a valid active subscriber;
   - revoking/suspending a subscription and confirming new signed URLs are no longer issued.
7. Convert existing iframe sources only as part of the private delivery migration. Moving a URL from `src` to `data-src` is merely a loading-delay measure; it does not make the URL secret.

## Release decision

**Do not open paid lesson pages as private yet.** The public marketing site can be made available separately, but paid courses remain blocked from a security acceptance standpoint until media and lesson delivery are moved behind server-side access checks. This report does not change any course page, media URL, database object, or production deployment.
