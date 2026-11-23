# Private Course Media Pilot — Supabase + Cloudflare Stream

**Status:** draft implementation scaffold; not deployed and not connected to Cloudflare or Supabase TEST/LIVE.  
**Pilot course:** **excel** (the course_slug must match the Membership V2 catalogue).  
**Database writes:** none. No SQL migration is included.

## Why this pilot exists

The current static academy pages embed public YouTube URLs directly in HTML. A browser-side login or JavaScript gate cannot make those files or media URLs private. Do not regard this function as a completed security release until the page/player migration and the acceptance checks below are finished.

## Request flow

1. The signed-in browser calls **issue-course-playback-token** with its Supabase session JWT and a JSON body containing course_slug and lesson_slug.
2. Supabase Edge Functions keep their default JWT verification enabled. The handler also calls Supabase Auth getUser(accessToken) to verify the session.
3. The handler calls the existing public.get_my_active_courses_v2() RPC as the signed-in user. It issues a token only when the exact course row has can_view_course_page = true and can_watch_video = true.
4. The server looks up the Cloudflare Stream UID in the server-side COURSE_MEDIA_MAP_JSON secret. The UID is never returned to the browser.
5. Before token creation, the function retrieves Cloudflare video metadata and fails closed unless readyToStream = true, requireSignedURLs = true, and allowedOrigins contains the exact requesting website host. Wildcard Stream origins are deliberately rejected.
6. The function calls Cloudflare's POST /accounts/{account_id}/stream/{video_uid}/token endpoint with a one-hour default expiry (configurable from 5 to 60 minutes) and returns only the signed iframe URL.
7. The browser renders the iframe only after receiving that URL. It must not retain a public YouTube fallback for paid lessons.

## Function secrets

Set these only in the Supabase Edge Function secret store for the isolated TEST project first. Do not commit .env files or paste secret values into chat, HTML, JavaScript, or GitHub.

| Secret | Purpose |
|---|---|
| SUPABASE_URL | Supabase project URL (platform-provided in the Edge Function environment) |
| SUPABASE_PUBLISHABLE_KEYS | Automatically supplied Supabase JSON dictionary; the function reads its default publishable key. Legacy projects can fall back to SUPABASE_ANON_KEY. |
| ALLOWED_ORIGINS | Comma-separated exact website origins, e.g. https://test.example.com,http://localhost:5500 |
| CF_ACCOUNT_ID | Cloudflare account identifier |
| CF_STREAM_API_TOKEN | Cloudflare API token with permissions to read Stream video metadata and create signed playback tokens |
| CF_STREAM_CUSTOMER_CODE | The customer code from the Stream playback hostname |
| COURSE_MEDIA_MAP_JSON | Server-side JSON object mapping course and lesson slugs to 32-character Stream video UIDs |
| STREAM_TOKEN_TTL_SECONDS | Optional integer from 300 to 3600; defaults to 3600 seconds |

Example manifest shape (replace the example UID with the real UID after the source video is uploaded and protected):

~~~json
{
  "excel": {
    "lesson-01": "0123456789abcdef0123456789abcdef",
    "lesson-02": "abcdef0123456789abcdef0123456789"
  }
}
~~~

Do not set COURSE_MEDIA_MAP_JSON until the corresponding Stream videos exist, each paid video has requireSignedURLs = true, readyToStream = true, and allowedOrigins includes the exact website host. For a pilot, upload one rights-cleared video first. Never make an old unlisted YouTube link the fallback.

## Deploy to TEST only

1. Confirm the Supabase project reference is the isolated TEST project and take a verified backup/export before any database work. This pilot currently includes no database migration.
2. Confirm get_my_active_courses_v2() exists in that TEST project and returns course_slug, can_view_course_page, and can_watch_video as expected.
3. Review ALLOWED_ORIGINS and list only the exact TEST website origin(s). Do not use *.
4. Set the function secrets in Supabase TEST. Never use LIVE secrets for TEST. SUPABASE_URL and SUPABASE_PUBLISHABLE_KEYS are supplied by Supabase; do not try to create secrets with the reserved SUPABASE_ prefix.
5. Deploy only the issue-course-playback-token function to TEST. Keep JWT verification enabled; do not set verify_jwt = false.
6. Configure one Cloudflare Stream video as private / requiring signed URLs, and set the exact TEST host in that video's allowed origins.
7. Add a single excel lesson mapping to the function secret, then call the function using the authenticated TEST student account.

## Browser invocation example

The call must use the existing signed-in Supabase client so the student's session JWT is sent in the Authorization header:

~~~js
const { data, error } = await supabase.functions.invoke(
  "issue-course-playback-token",
  { body: { course_slug: "excel", lesson_slug: "lesson-01" } }
);

if (error) throw error;
const iframe = document.createElement("iframe");
iframe.src = data.iframeUrl;
iframe.allow = "accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture";
iframe.allowFullscreen = true;
iframe.referrerPolicy = "no-referrer";
playerContainer.replaceChildren(iframe);
~~~

Do not put the Cloudflare API token, Stream UID, or an unsigned public video URL in browser code. The sample player must be wired only after the Excel lesson page's static public YouTube embeds have been removed as part of the migration.

## Required TEST acceptance matrix

| Scenario | Expected result |
|---|---|
| No Authorization header / signed out | 401; no iframe URL |
| Expired or invalid Supabase JWT | 401; no iframe URL |
| Authenticated, pending profile | 403 or no matching active course row; no iframe URL |
| Approved account with no Excel subscription | 403; no iframe URL |
| Unpaid / suspended / expired subscription | No qualifying row from V2 RPC; no iframe URL |
| Active Excel subscription with can_watch_video = false | 403; no iframe URL |
| Active subscription for another course only | 403; no iframe URL |
| Active Excel subscription with both page and video capabilities | 200; short-lived signed iframe URL |
| Unknown lesson slug | 404; no iframe URL |
| Unknown Stream video or Cloudflare metadata error | Fail closed; no iframe URL |
| Stream video has requireSignedURLs = false | 409; no iframe URL |
| Stream video is not ready yet | 409; no iframe URL |
| Stream video allowedOrigins excludes the request host | 403; no iframe URL |
| Function called from an origin outside the allowlist | 403 |
| Token after its expiry | Cloudflare player refuses playback |

Also test that suspending/revoking the subscription prevents issuance of the next token. A token already issued remains valid until its expiry; short TTL limits, but does not eliminate, that window. With the one-hour default, the revocation test must include the remaining lifetime of an already-issued token.

## Rollout blockers

- The current academy/excel.html page has many hard-coded iframe sources. None have been removed or replaced in this scaffold.
- Source video ownership/usage rights and the full Excel lesson-to-video mapping still need to be confirmed.
- Cloudflare Stream is not verified as available in the connected account; usage and billing must be checked by the account owner.
- No TEST token request, real Cloudflare API call, Deno type check, Supabase RPC test, or end-to-end player test has been performed from this repository work.
- Add rate limiting and operational alerts before production rollout; the current scaffold doesn't throttle repeated token requests.
- Do not merge this draft or open the paid Excel course to students until every TEST acceptance case passes and the page migration is reviewed.
