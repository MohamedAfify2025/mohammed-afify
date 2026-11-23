import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getCourseVideoUid,
  hasVideoCapability,
  isStreamOriginAllowed,
  normalizeSlug,
  normalizeTokenTtl,
  parseCourseMediaManifest,
} from "../_shared/course-playback.mjs";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store, max-age=0",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Vary": "Origin",
};

function allowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS") || "";
  return raw.split(",").map((value) => value.trim()).filter(Boolean);
}

function makeHeaders(origin: string | null, allowOrigin: boolean): Headers {
  const headers = new Headers(JSON_HEADERS);
  if (allowOrigin && origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info");
  }
  return headers;
}

function jsonResponse(
  status: number,
  payload: Record<string, unknown>,
  origin: string | null,
  allowOrigin = false,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: makeHeaders(origin, allowOrigin),
  });
}

function readRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("Missing required function secret: " + name);
  return value;
}

function isValidOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      parsed.origin === value && !value.includes("*");
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const origins = allowedOrigins();

  if (origins.length === 0 || origins.some((value) => !isValidOrigin(value))) {
    return jsonResponse(500, { error: "Playback service origin allowlist is not configured safely." }, null);
  }
  if (!origin || !origins.includes(origin)) {
    return jsonResponse(403, { error: "A trusted browser origin is required." }, null);
  }

  if (req.method === "OPTIONS") {
    const headers = makeHeaders(origin, true);
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." }, origin, true);
  }

  try {
    const authorization = req.headers.get("authorization") || "";
    const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
    if (!bearerMatch) {
      return jsonResponse(401, { error: "Authentication is required." }, origin, true);
    }
    const accessToken = bearerMatch[1].trim();

    const body = await req.json().catch(() => null);
    const courseSlug = normalizeSlug(body?.course_slug);
    const lessonSlug = normalizeSlug(body?.lesson_slug);
    if (!courseSlug || !lessonSlug) {
      return jsonResponse(400, { error: "Valid course_slug and lesson_slug values are required." }, origin, true);
    }

    const supabaseUrl = readRequiredEnv("SUPABASE_URL");
    const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY");
    if (!publishableKey) throw new Error("Missing Supabase publishable/anon key.");

    const supabase = createClient(supabaseUrl, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: "Bearer " + accessToken },
      },
    });

    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userResult?.user?.id) {
      return jsonResponse(401, { error: "The Supabase session is invalid or expired." }, origin, true);
    }

    const { data: accessRows, error: accessError } = await supabase.rpc("get_my_active_courses_v2");
    if (accessError) {
      console.error("Membership access RPC failed:", accessError.message);
      return jsonResponse(503, { error: "Course access could not be verified." }, origin, true);
    }
    if (!hasVideoCapability(accessRows, courseSlug)) {
      return jsonResponse(403, {
        error: "This active subscription does not include video access to the requested course.",
      }, origin, true);
    }

    const manifest = parseCourseMediaManifest(readRequiredEnv("COURSE_MEDIA_MAP_JSON"));
    const videoUid = getCourseVideoUid(manifest, courseSlug, lessonSlug);
    if (!videoUid) {
      return jsonResponse(404, { error: "The requested lesson is not configured for private playback." }, origin, true);
    }

    const accountId = readRequiredEnv("CF_ACCOUNT_ID");
    const apiToken = readRequiredEnv("CF_STREAM_API_TOKEN");
    const customerCode = readRequiredEnv("CF_STREAM_CUSTOMER_CODE");
    if (!/^[a-z0-9]{1,64}$/i.test(customerCode)) {
      throw new Error("CF_STREAM_CUSTOMER_CODE is invalid.");
    }
    const ttl = normalizeTokenTtl(Deno.env.get("STREAM_TOKEN_TTL_SECONDS"));
    const expiresAt = Math.floor(Date.now() / 1000) + ttl;
    const videoEndpoint = "https://api.cloudflare.com/client/v4/accounts/" +
      encodeURIComponent(accountId) + "/stream/" + encodeURIComponent(videoUid);

    // Fail closed: never mint a signed token for a video that is still publicly
    // playable by UID, or whose Cloudflare hotlink allowlist excludes this origin.
    const videoResponse = await fetch(videoEndpoint, {
      method: "GET",
      headers: { "Authorization": "Bearer " + apiToken },
      signal: AbortSignal.timeout(10000),
    });
    const videoPayload = await videoResponse.json().catch(() => null);
    if (!videoResponse.ok || videoPayload?.success !== true || !videoPayload?.result) {
      console.error("Cloudflare Stream metadata lookup failed:", videoResponse.status);
      return jsonResponse(502, { error: "The private video configuration could not be verified." }, origin, true);
    }
    if (videoPayload.result.requireSignedURLs !== true) {
      return jsonResponse(409, { error: "This video is not configured to require signed playback URLs." }, origin, true);
    }
    if (!isStreamOriginAllowed(videoPayload.result.allowedOrigins, origin)) {
      return jsonResponse(403, { error: "This video is not restricted to the requesting website origin." }, origin, true);
    }

    const tokenEndpoint = videoEndpoint + "/token";
    const cfResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ exp: expiresAt }),
      signal: AbortSignal.timeout(10000),
    });

    const cfPayload = await cfResponse.json().catch(() => null);
    const token = cfPayload?.result?.token;
    if (!cfResponse.ok || cfPayload?.success !== true || typeof token !== "string" || !token) {
      console.error("Cloudflare Stream token API rejected the request:", cfResponse.status);
      return jsonResponse(502, { error: "The private video service could not issue a playback token." }, origin, true);
    }

    const iframeUrl = "https://customer-" + customerCode +
      ".cloudflarestream.com/" + token + "/iframe";

    return jsonResponse(200, {
      course_slug: courseSlug,
      lesson_slug: lessonSlug,
      iframeUrl,
      expires_at: new Date(expiresAt * 1000).toISOString(),
      expires_in_seconds: ttl,
    }, origin, true);
  } catch (error) {
    console.error("Playback token request failed:", error instanceof Error ? error.message : "Unknown error");
    return jsonResponse(500, { error: "Playback token could not be issued." }, origin, true);
  }
});
