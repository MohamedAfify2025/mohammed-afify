# Private Course Media Pilot — Supabase + Cloudflare Stream

**Status:** draft implementation scaffold; not deployed and not connected to Cloudflare or Supabase TEST/LIVE.  
**Pilot course:** `training-pilot` by default. This is a locked test mapping only; replace it with the exact Membership V2 course slug before enabling access for real students.  
**Database writes:** none. No SQL migration is included.

## Why this pilot exists

The current static academy pages embed public YouTube URLs directly in HTML. A browser-side login or JavaScript gate cannot make those files or media URLs private. Do not regard this function as a completed security release until the page/player migration and the acceptance checks below are finished.

## Request flow

1. The signed-in browser calls **issue-course-playback-token** with its Supabase session JWT and a JSON body containing course_slug and lesson_slug.
2. Supabase Edge Functions keep their default JWT verification enabled. The handler also calls Supabase Auth getUser(accessToken) to verify the session.
3. The handler calls the existing public.get_my_active_courses_v2() RPC as the signed-in user. It issues a token only when the exact course row has can_view_course_page = true and can_watch_video = true.
4. The server looks up the Cloudflare Stream UID in the server-side COURSE_MEDIA_MAP_JSON secret. The UID is never returned to the browser.
5. Before token creation, the function retrieves Cloudflare video metadata and fails closed unless readyToStream = true, requireSignedURLs = true, and allowedOrigins contains the exact requesting website host. Wildcard Stream origins are deliberately rejected.
6. The function calls Cloudflare's POST /accounts/{account_id}/stream/{video_uid}/token endpoint with a 10-minute TEST expiry (configurable from 5 to 60 minutes) and returns only the signed iframe URL.
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

## PowerShell end-to-end TEST run

Run the automation from the Windows computer that has the source video. The script performs the upload through the Cloudflare API itself; no manual dashboard upload, curl, or Python upload client is needed.

### One-time prerequisites

- Install Git and Node.js 20 or later.
- Have the isolated Supabase TEST project ready, with the current Membership V2 schema and the existing get_my_active_courses_v2() RPC.
- Create a Cloudflare API token restricted to the relevant account with Stream Read and Stream Edit permissions.
- Prepare one video that you own or are authorized to use. Cloudflare supports common formats such as MP4, MOV, WebM, MKV, and AVI; maximum file size is under 30 GB.
- A dedicated TEST student with an active subscription and can_watch_video = true is optional. The upload and function deployment do not require a student login key.

### Run the script

From PowerShell:

~~~powershell
git clone https://github.com/MohamedAfify2025/mohammed-afify.git
cd mohammed-afify
git checkout feature/private-course-media-pilot-2026-11-23

node tests/course-playback.test.mjs

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\Deploy-PrivateCourseMediaPilot-TEST.ps1
~~~

The script asks for the TEST Project Ref, a local video path, course slug (defaults to the isolated `training-pilot` mapping), lesson slug, website origin, Cloudflare Account ID, and Cloudflare API token. The Supabase Publishable Key is requested only if you opt into the optional end-to-end test with an existing active TEST student. Token/key/password inputs are hidden. It then:

1. Refuses to run unless the repository branch is the dedicated TEST pilot branch and the project ref differs from the project currently configured by the website.
2. Runs the Node helper tests and confirms the Edge Function has verify_jwt = true.
3. Verifies the Cloudflare API token can access Stream.
4. Uploads files under 200 MB using multipart upload; files 200 MB or larger use resumable TUS with 50 MB chunks and bounded retries.
5. Sets requireSignedURLs = true and allowedOrigins to the exact host for the TEST website, then reads the video back to verify the settings.
6. Waits for Cloudflare encoding, derives the Stream Customer Code from the playback manifest, and prepares the single course/lesson-to-video mapping.
7. Authenticates the Supabase CLI, writes Cloudflare settings to a temporary environment file, sets the TEST secrets (including a 10-minute token TTL for this pilot) only on the specified TEST project, then deletes the temporary file.
8. Deploys only issue-course-playback-token to TEST using API deployment.
9. Optionally signs in a dedicated TEST student and calls the Edge Function. The signed iframe URL is not printed to the console.

The script does not run SQL, does not change the existing academy HTML pages, and does not deploy to LIVE. It includes a hard stop for the Supabase ref currently used by the site's browser config. Keep the video path, API token, student password, and signed playback URL out of GitHub and chat.

Before uploading, the script prints the exact file name and size and requires you to type `UPLOAD`. If you use local Live Server on port 5500, enter exactly http://localhost:5500 when the script asks for the website origin. For another test domain, enter its exact origin instead; the Cloudflare allowed-origin entry is derived from that host.

### What the script configures automatically

- ALLOWED_ORIGINS
- CF_ACCOUNT_ID
- CF_STREAM_API_TOKEN
- CF_STREAM_CUSTOMER_CODE
- COURSE_MEDIA_MAP_JSON
- STREAM_TOKEN_TTL_SECONDS = 600 (10 minutes for the TEST pilot)

Supabase injects SUPABASE_URL and SUPABASE_PUBLISHABLE_KEYS. The script does not try to add reserved SUPABASE_ secrets. It uses the Supabase CLI through an existing installation or npx.


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
- No TEST token request, real Cloudflare API call, Deno type check, Supabase RPC test, PowerShell upload, or end-to-end player test has yet been performed from this repository work.
- Add rate limiting and operational alerts before production rollout; the current scaffold doesn't throttle repeated token requests.
- Do not merge this draft or open the paid Excel course to students until every TEST acceptance case passes and the page migration is reviewed.
