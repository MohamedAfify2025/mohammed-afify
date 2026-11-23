#requires -Version 5.1
<#
.SYNOPSIS
  Upload one pilot video to Cloudflare Stream, secure it, configure Supabase TEST,
  deploy the Edge Function, and optionally run an end-to-end student smoke test.
.DESCRIPTION
  TEST ONLY. Refuses the Supabase project currently configured by the public site.
  No SQL migrations are executed. No production deployment is performed.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$KnownSiteProjectRef = "ybsjnubrswqksvktgmay"
$ExpectedBranch = "feature/private-course-media-pilot-2026-11-23"
$MaxStreamBytes = 30GB
$TusThresholdBytes = 200MB
$TusChunkBytes = 50MB

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}
function Stop-With([string]$Message) { throw $Message }

function Convert-SecureStringToPlainText([Security.SecureString]$Value) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Invoke-SupabaseCli([string[]]$CliArguments) {
    $supabaseCommand = Get-Command "supabase" -ErrorAction SilentlyContinue
    if ($supabaseCommand) {
        & $supabaseCommand.Source @CliArguments
    } else {
        & npx --yes supabase@latest @CliArguments
    }
    if ($LASTEXITCODE -ne 0) {
        Stop-With "Supabase CLI failed (exit code $LASTEXITCODE). Review the command output."
    }
}

function Invoke-CloudflareApi {
    param(
        [Parameter(Mandatory = $true)][ValidateSet("GET", "POST")][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][string]$ApiToken,
        [object]$Body
    )
    $headers = @{ Authorization = "Bearer $ApiToken" }
    if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Depth 12 -Compress
        return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -ContentType "application/json" -Body $json -TimeoutSec 120
    }
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -TimeoutSec 120
}

function Get-HeaderValue {
    param($Headers, [string]$Name)
    if ($Headers.Contains($Name)) {
        $values = $Headers.GetValues($Name)
        if ($values -and $values.Count -gt 0) { return [string]$values[0] }
    }
    return $null
}

function New-CloudflareHttpClient {
    $client = [System.Net.Http.HttpClient]::new()
    $client.Timeout = [TimeSpan]::FromHours(3)
    return $client
}

function Upload-CloudflareBasic {
    param(
        [System.Net.Http.HttpClient]$Client,
        [string]$Endpoint,
        [string]$ApiToken,
        [string]$FilePath
    )
    $fileStream = $null
    $request = $null
    $multipart = $null
    try {
        $fileStream = [System.IO.File]::OpenRead($FilePath)
        $fileContent = [System.Net.Http.StreamContent]::new($fileStream)
        $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/octet-stream")
        $multipart = [System.Net.Http.MultipartFormDataContent]::new()
        $multipart.Add($fileContent, "file", [System.IO.Path]::GetFileName($FilePath))
        $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, [Uri]$Endpoint)
        $request.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $ApiToken)
        $request.Content = $multipart

        Write-Host "Uploading with multipart API (<200 MB)..."
        $response = $Client.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
        $responseText = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if (-not $response.IsSuccessStatusCode) {
            Stop-With "Cloudflare upload failed with HTTP $([int]$response.StatusCode): $responseText"
        }
        $payload = $responseText | ConvertFrom-Json
        if ($payload.success -ne $true -or -not $payload.result.uid) {
            Stop-With "Cloudflare upload response did not contain a video UID."
        }
        $response.Dispose()
        return [string]$payload.result.uid
    }
    finally {
        if ($request) { $request.Dispose() }
        if ($multipart) { $multipart.Dispose() }
        if ($fileStream) { $fileStream.Dispose() }
    }
}

function Upload-CloudflareTus {
    param(
        [System.Net.Http.HttpClient]$Client,
        [string]$Endpoint,
        [string]$ApiToken,
        [string]$FilePath
    )
    $fileInfo = Get-Item -LiteralPath $FilePath
    $length = [int64]$fileInfo.Length
    $fileName = [System.IO.Path]::GetFileName($FilePath)
    $fileType = switch ([System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()) {
        ".mp4" { "video/mp4" }
        ".mov" { "video/quicktime" }
        ".m4v" { "video/x-m4v" }
        ".webm" { "video/webm" }
        ".mkv" { "video/x-matroska" }
        ".avi" { "video/x-msvideo" }
        default { "application/octet-stream" }
    }
    $encodedName = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($fileName))
    $encodedType = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($fileType))
    $metadata = "name $encodedName,filetype $encodedType"

    $create = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, [Uri]$Endpoint)
    $create.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $ApiToken)
    $create.Headers.Add("Tus-Resumable", "1.0.0")
    $create.Headers.Add("Upload-Length", [string]$length)
    $create.Headers.Add("Upload-Metadata", $metadata)
    $createResponse = $Client.SendAsync($create).GetAwaiter().GetResult()
    if (-not $createResponse.IsSuccessStatusCode) {
        $createText = $createResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        Stop-With "Cloudflare TUS session creation failed (HTTP $([int]$createResponse.StatusCode)): $createText"
    }
    $uploadUri = $createResponse.Headers.Location
    if (-not $uploadUri) { Stop-With "Cloudflare TUS response did not include upload Location." }
    if (-not $uploadUri.IsAbsoluteUri) { $uploadUri = [Uri]::new([Uri]$Endpoint, $uploadUri) }
    $videoUid = Get-HeaderValue $createResponse.Headers "stream-media-id"
    if (-not $videoUid) { Stop-With "Cloudflare TUS response did not include stream-media-id; stopping rather than guessing the UID." }
    $create.Dispose()
    $createResponse.Dispose()

    $fileStream = $null
    try {
        $fileStream = [System.IO.File]::OpenRead($FilePath)
        $buffer = New-Object byte[] ([int]$TusChunkBytes)
        [int64]$offset = 0

        while ($offset -lt $length) {
            $fileStream.Position = $offset
            $remaining = $length - $offset
            $wanted = [int][Math]::Min([int64]$TusChunkBytes, $remaining)
            $read = 0
            while ($read -lt $wanted) {
                $count = $fileStream.Read($buffer, $read, $wanted - $read)
                if ($count -le 0) { Stop-With "Unexpected end of file during TUS upload." }
                $read += $count
            }

            $patch = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new("PATCH"), $uploadUri)
            $patch.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $ApiToken)
            $patch.Headers.Add("Tus-Resumable", "1.0.0")
            $patch.Headers.Add("Upload-Offset", [string]$offset)
            $patch.Content = [System.Net.Http.ByteArrayContent]::new($buffer, 0, $read)
            $patch.Content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/offset+octet-stream")

            $chunkAccepted = $false
            for ($retry = 1; $retry -le 5 -and -not $chunkAccepted; $retry++) {
                $patchResponse = $null
                $patch = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new("PATCH"), $uploadUri)
                $patch.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $ApiToken)
                $patch.Headers.Add("Tus-Resumable", "1.0.0")
                $patch.Headers.Add("Upload-Offset", [string]$offset)
                $patch.Content = [System.Net.Http.ByteArrayContent]::new($buffer, 0, $read)
                $patch.Content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/offset+octet-stream")
                try {
                    $patchResponse = $Client.SendAsync($patch).GetAwaiter().GetResult()
                    if (-not $patchResponse.IsSuccessStatusCode) {
                        $patchText = $patchResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                        Stop-With "TUS chunk upload failed (HTTP $([int]$patchResponse.StatusCode)): $patchText"
                    }
                    $nextOffset = Get-HeaderValue $patchResponse.Headers "Upload-Offset"
                    if (-not $nextOffset) { Stop-With "TUS response did not include Upload-Offset." }
                    $offset = [int64]$nextOffset
                    $chunkAccepted = $true
                }
                catch {
                    $head = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Head, $uploadUri)
                    $head.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $ApiToken)
                    $head.Headers.Add("Tus-Resumable", "1.0.0")
                    $headResponse = $Client.SendAsync($head).GetAwaiter().GetResult()
                    if (-not $headResponse.IsSuccessStatusCode) { Stop-With "TUS upload interrupted and its resume offset could not be recovered." }
                    $serverOffset = Get-HeaderValue $headResponse.Headers "Upload-Offset"
                    if (-not $serverOffset) { Stop-With "TUS HEAD response did not include Upload-Offset." }
                    $serverOffsetValue = [int64]$serverOffset
                    $head.Dispose()
                    $headResponse.Dispose()
                    if ($serverOffsetValue -gt $offset) {
                        $offset = $serverOffsetValue
                        $chunkAccepted = $true
                        Write-Warning "Cloudflare accepted the previous chunk despite a lost response. Continuing from byte $offset."
                    } elseif ($retry -lt 5) {
                        Write-Warning "Upload interrupted before this chunk was acknowledged. Retry $retry of 5."
                        Start-Sleep -Seconds ([Math]::Min(15, 2 * $retry))
                    } else {
                        throw
                    }
                }
                finally {
                    if ($patchResponse) { $patchResponse.Dispose() }
                    $patch.Dispose()
                }
            }
            if (-not $chunkAccepted) { Stop-With "TUS could not acknowledge the current chunk after five attempts." }

            $percent = [Math]::Round(($offset / [double]$length) * 100, 1)
            Write-Progress -Activity "Uploading to Cloudflare Stream (TUS)" -Status "$percent% ($offset / $length bytes)" -PercentComplete $percent
        }
        Write-Progress -Activity "Uploading to Cloudflare Stream (TUS)" -Completed
        return [string]$videoUid
    }
    finally {
        if ($fileStream) { $fileStream.Dispose() }
    }
}

function Get-StreamVideo {
    param([string]$AccountId, [string]$VideoUid, [string]$ApiToken)
    $uri = "https://api.cloudflare.com/client/v4/accounts/$AccountId/stream/$VideoUid"
    return (Invoke-CloudflareApi -Method GET -Uri $uri -ApiToken $ApiToken).result
}

function Set-StreamVideoSecurity {
    param(
        [string]$AccountId,
        [string]$VideoUid,
        [string]$ApiToken,
        [string]$AllowedHost,
        [string]$CourseSlug,
        [string]$LessonSlug
    )
    $uri = "https://api.cloudflare.com/client/v4/accounts/$AccountId/stream/$VideoUid"
    $body = @{
        requireSignedURLs = $true
        allowedOrigins = @($AllowedHost)
        meta = @{ course_slug = $CourseSlug; lesson_slug = $LessonSlug; purpose = "private-course-pilot" }
    }
    $null = Invoke-CloudflareApi -Method POST -Uri $uri -ApiToken $ApiToken -Body $body
    $video = Get-StreamVideo -AccountId $AccountId -VideoUid $VideoUid -ApiToken $ApiToken
    if ($video.requireSignedURLs -ne $true) { Stop-With "Verification failed: Cloudflare did not enable requireSignedURLs." }
    if (@($video.allowedOrigins) -notcontains $AllowedHost) { Stop-With "Verification failed: Cloudflare allowedOrigins does not contain $AllowedHost." }
    return $video
}

Write-Step "Pre-flight checks"
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repoRoot "supabase/config.toml"))) {
    Stop-With "Run this script from the checked-out repository's scripts folder."
}
Push-Location $repoRoot
$httpClient = $null
$cloudflareToken = $null
$publishableKey = $null
$tempEnvFile = $null

try {
    $branch = (& git branch --show-current).Trim()
    if ($branch -ne $ExpectedBranch) { Stop-With "Wrong branch '$branch'. Check out '$ExpectedBranch' before running." }

    $node = Get-Command "node" -ErrorAction SilentlyContinue
    if (-not $node) { Stop-With "Node.js 20+ is required. Install Node.js, then reopen PowerShell." }
    $nodeVersionText = (& node -p "process.versions.node").Trim()
    if ([version]$nodeVersionText -lt [version]"20.0") { Stop-With "Node.js 20 or later is required; found $nodeVersionText." }

    & node (Join-Path $repoRoot "tests/course-playback.test.mjs")
    if ($LASTEXITCODE -ne 0) { Stop-With "Local private playback tests failed." }

    $configText = Get-Content -Raw -LiteralPath (Join-Path $repoRoot "supabase/config.toml")
    if ($configText -notmatch '(?m)^\[functions\.issue-course-playback-token\]\s*\r?\nverify_jwt\s*=\s*true\s*$') {
        Stop-With "supabase/config.toml must explicitly keep verify_jwt = true."
    }

    Write-Host "This script only targets TEST. It will not execute SQL or deploy to LIVE." -ForegroundColor Yellow
    $confirmation = Read-Host "Type TEST to confirm this is the isolated Supabase TEST project"
    if ($confirmation -cne "TEST") { Stop-With "Cancelled: TEST was not confirmed." }

    $testProjectRef = (Read-Host "Supabase TEST Project Ref").Trim()
    if ($testProjectRef -notmatch '^[a-z0-9]{20}$') { Stop-With "The Supabase project ref format is invalid." }
    if ($testProjectRef -eq $KnownSiteProjectRef) {
        Stop-With "Blocked: this ref matches the project currently configured in the repository website. Do not use it for the TEST pilot."
    }

    $videoPath = (Read-Host "Full path to the ONE test video file").Trim('"').Trim()
    if (-not (Test-Path -LiteralPath $videoPath -PathType Leaf)) { Stop-With "Video file not found: $videoPath" }
    $fileInfo = Get-Item -LiteralPath $videoPath
    if ($fileInfo.Length -le 0 -or $fileInfo.Length -ge $MaxStreamBytes) { Stop-With "Video size must be greater than zero and less than 30 GB." }
    $supported = @(".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".flv", ".mpg", ".mpeg", ".3gp")
    if ($supported -notcontains $fileInfo.Extension.ToLowerInvariant()) { Stop-With "Unsupported video file extension." }

    $courseSlug = (Read-Host "Course slug [excel]").Trim()
    if (-not $courseSlug) { $courseSlug = "excel" }
    $courseSlug = $courseSlug.ToLowerInvariant()
    if ($courseSlug -notmatch '^[a-z0-9][a-z0-9-]{0,79}$') { Stop-With "Invalid course slug." }

    $lessonSlug = (Read-Host "Lesson slug [lesson-01]").Trim()
    if (-not $lessonSlug) { $lessonSlug = "lesson-01" }
    $lessonSlug = $lessonSlug.ToLowerInvariant()
    if ($lessonSlug -notmatch '^[a-z0-9][a-z0-9-]{0,79}$') { Stop-With "Invalid lesson slug." }

    $testOriginText = (Read-Host "Exact TEST website origin [http://localhost:5500]").Trim()
    if (-not $testOriginText) { $testOriginText = "http://localhost:5500" }
    $testOriginUri = $null
    if (-not [Uri]::TryCreate($testOriginText, [UriKind]::Absolute, [ref]$testOriginUri) -or
        @("http", "https") -notcontains $testOriginUri.Scheme -or
        $testOriginUri.AbsoluteUri.TrimEnd("/") -ne $testOriginText.TrimEnd("/") -or
        $testOriginText.Contains("*")) { Stop-With "Origin must be one exact http(s) origin, without a path or wildcard." }
    $testOrigin = $testOriginUri.GetLeftPart([UriPartial]::Authority)
    $allowedHost = $testOriginUri.Authority

    $accountId = (Read-Host "Cloudflare Account ID (32-character ID)").Trim()
    if ($accountId -notmatch '^[a-f0-9]{32}$') { Stop-With "Cloudflare Account ID format is invalid." }

    $cloudflareSecure = Read-Host "Cloudflare API token (hidden input)" -AsSecureString
    $cloudflareToken = Convert-SecureStringToPlainText $cloudflareSecure
    if (-not $cloudflareToken) { Stop-With "Cloudflare API token is required." }

    $publishableSecure = Read-Host "Supabase TEST Publishable Key (hidden input; not a service-role key)" -AsSecureString
    $publishableKey = Convert-SecureStringToPlainText $publishableSecure
    if (-not $publishableKey.StartsWith("sb_publishable_") -and -not $publishableKey.StartsWith("eyJ")) {
        Stop-With "Enter a Supabase publishable key, or a legacy anon JWT. Never enter a service_role or secret key."
    }

    Write-Step "Verify Cloudflare API access"
    $httpClient = New-CloudflareHttpClient
    $accountUri = "https://api.cloudflare.com/client/v4/accounts/$accountId/stream"
    $null = Invoke-CloudflareApi -Method GET -Uri "$accountUri?limit=1" -ApiToken $cloudflareToken
    Write-Host "Cloudflare API access verified." -ForegroundColor Green

    Write-Step "Upload one pilot video"
    if ($fileInfo.Length -lt $TusThresholdBytes) {
        $videoUid = Upload-CloudflareBasic -Client $httpClient -Endpoint $accountUri -ApiToken $cloudflareToken -FilePath $fileInfo.FullName
    } else {
        Write-Host "File is 200 MB or larger; using resumable TUS upload."
        $videoUid = Upload-CloudflareTus -Client $httpClient -Endpoint $accountUri -ApiToken $cloudflareToken -FilePath $fileInfo.FullName
    }
    Write-Host "Video uploaded. Stream UID received." -ForegroundColor Green

    Write-Step "Enable signed playback and restrict the TEST origin"
    $video = Set-StreamVideoSecurity -AccountId $accountId -VideoUid $videoUid -ApiToken $cloudflareToken -AllowedHost $allowedHost -CourseSlug $courseSlug -LessonSlug $lessonSlug
    Write-Host "requireSignedURLs verified: $($video.requireSignedURLs)"
    Write-Host "Allowed origin verified: $allowedHost"

    Write-Step "Wait for video processing"
    $ready = $false
    for ($attempt = 1; $attempt -le 60; $attempt++) {
        $video = Get-StreamVideo -AccountId $accountId -VideoUid $videoUid -ApiToken $cloudflareToken
        if ($video.status -and $video.status.state -eq "error") { Stop-With "Cloudflare encoding failed: $($video.status.errorReasonText)" }
        if ($video.readyToStream -eq $true) { $ready = $true; break }
        Write-Progress -Activity "Waiting for Cloudflare Stream encoding" -Status "Check $attempt of 60" -PercentComplete ([int](($attempt / 60) * 100))
        Start-Sleep -Seconds 10
    }
    Write-Progress -Activity "Waiting for Cloudflare Stream encoding" -Completed
    if (-not $ready) { Stop-With "Video is not ready after 10 minutes. Check Stream and rerun later." }
    if ($video.requireSignedURLs -ne $true -or @($video.allowedOrigins) -notcontains $allowedHost) { Stop-With "Final Cloudflare security verification failed." }

    $playbackHls = [string]$video.playback.hls
    if (-not $playbackHls -or $playbackHls -notmatch '^https://customer-([a-z0-9-]+)\.cloudflarestream\.com/') {
        Stop-With "Could not derive Cloudflare Stream Customer Code from the video's HLS playback URL."
    }
    $customerCode = $Matches[1]

    Write-Step "Prepare the private course-to-video map"
    $mediaMap = @{}
    $mediaMap[$courseSlug] = @{}
    $mediaMap[$courseSlug][$lessonSlug] = $videoUid
    $mediaMapJson = $mediaMap | ConvertTo-Json -Depth 8 -Compress

    Write-Step "Authenticate Supabase CLI"
    Invoke-SupabaseCli @("login")

    Write-Step "Set secrets on the isolated TEST project"
    $tempEnvFile = Join-Path ([IO.Path]::GetTempPath()) ("ma-private-media-" + [Guid]::NewGuid().ToString("N") + ".env")
    $envLines = @(
        "ALLOWED_ORIGINS='$testOrigin'"
        "CF_ACCOUNT_ID='$accountId'"
        "CF_STREAM_API_TOKEN='$cloudflareToken'"
        "CF_STREAM_CUSTOMER_CODE='$customerCode'"
        "COURSE_MEDIA_MAP_JSON='$mediaMapJson'"
        "STREAM_TOKEN_TTL_SECONDS='3600'"
    )
    [IO.File]::WriteAllLines($tempEnvFile, $envLines, [Text.UTF8Encoding]::new($false))
    try {
        Invoke-SupabaseCli @("secrets", "set", "--project-ref", $testProjectRef, "--env-file", $tempEnvFile)
    } finally {
        if (Test-Path $tempEnvFile) { Remove-Item -LiteralPath $tempEnvFile -Force }
        $tempEnvFile = $null
    }

    Write-Step "Deploy only the private playback function to TEST"
    Invoke-SupabaseCli @("functions", "deploy", "issue-course-playback-token", "--project-ref", $testProjectRef, "--use-api")

    Write-Step "Optional end-to-end TEST student check"
    $doSmokeTest = (Read-Host "Do you have a dedicated TEST student with active Excel video permission? (Y/N)").Trim()
    if ($doSmokeTest -match '^(Y|YES)$') {
        $studentEmail = (Read-Host "TEST student email").Trim()
        $studentPasswordSecure = Read-Host "TEST student password (hidden input)" -AsSecureString
        $studentPassword = Convert-SecureStringToPlainText $studentPasswordSecure
        try {
            $supabaseUrl = "https://$testProjectRef.supabase.co"
            $authBody = @{ email = $studentEmail; password = $studentPassword } | ConvertTo-Json -Compress
            $authResult = Invoke-RestMethod -Method POST -Uri "$supabaseUrl/auth/v1/token?grant_type=password" -Headers @{ apikey = $publishableKey } -ContentType "application/json" -Body $authBody -TimeoutSec 60
            if (-not $authResult.access_token) { Stop-With "Supabase did not return a student session token." }

            $functionBody = @{ course_slug = $courseSlug; lesson_slug = $lessonSlug } | ConvertTo-Json -Compress
            $functionResult = Invoke-RestMethod -Method POST -Uri "$supabaseUrl/functions/v1/issue-course-playback-token" -Headers @{
                Authorization = "Bearer $($authResult.access_token)"
                apikey = $publishableKey
                Origin = $testOrigin
            } -ContentType "application/json" -Body $functionBody -TimeoutSec 60

            if (-not $functionResult.iframeUrl -or $functionResult.expires_in_seconds -lt 300) {
                Stop-With "Function response did not contain the expected signed playback URL."
            }
            Write-Host "TEST student authorization succeeded." -ForegroundColor Green
            Write-Host "Course: $($functionResult.course_slug); Lesson: $($functionResult.lesson_slug)"
            Write-Host "Signed token lifetime: $($functionResult.expires_in_seconds) seconds"
            Write-Host "Signed iframe URL was intentionally not printed."
        } finally {
            $studentPassword = $null
            $authBody = $null
            $functionBody = $null
        }
    } else {
        Write-Warning "Function deployed, but end-to-end student playback was not tested."
    }

    Write-Step "TEST pilot setup completed"
    Write-Host "Cloudflare upload, signed-URL protection, origin restriction, Supabase secrets, and function deployment completed for TEST." -ForegroundColor Green
    Write-Host "Course: $courseSlug | Lesson: $lessonSlug"
    Write-Host "No SQL migrations or LIVE changes were made."
    Write-Host "Next: migrate the matching lesson player separately; do not leave a public YouTube fallback."
}
catch {
    Write-Error $_
    Write-Host "STOPPED. Review the last successful step before rerunning." -ForegroundColor Red
    throw
}
finally {
    if ($tempEnvFile -and (Test-Path $tempEnvFile)) { Remove-Item -LiteralPath $tempEnvFile -Force -ErrorAction SilentlyContinue }
    if ($httpClient) { $httpClient.Dispose() }
    $cloudflareToken = $null
    $publishableKey = $null
    Pop-Location
}
