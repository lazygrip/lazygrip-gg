# security-probe.ps1 - read-only outside checks of lazygrip.net and its Supabase API.
# Writes nothing to the site or database. Safe to run any time.

$SB  = "https://csldntgdalzlwxozlmgv.supabase.co"
$KEY = Read-Host "Paste the Supabase anon key (Project Settings, API)"
$h   = @{ apikey = $KEY; Authorization = "Bearer $KEY" }

Write-Host ""
Write-Host "=== PHASE 2: what a stranger can read ==="
Write-Host "Expected: profiles DENIED. After migration 045 all four throttle tables DENIED. notifications OK rows: 0."
$tables = "profiles","sequences","sequence_versions","comments","notifications","slug_aliases","site_config","sequence_view_daily","comment_rate_throttle","copy_count_throttle","post_rate_throttle","view_count_throttle"
foreach ($t in $tables) {
  $url = "$SB/rest/v1/${t}?select=*&limit=1"
  try {
    $r = Invoke-RestMethod -Uri $url -Headers $h
    "{0,-26} OK rows: {1}" -f $t, @($r).Count
  } catch {
    "{0,-26} DENIED {1}" -f $t, $_.Exception.Response.StatusCode.value__
  }
}

Write-Host ""
Write-Host "Unpublished sequences visible to a stranger (must print nothing below this line):"
try {
  $u = "$SB/rest/v1/sequences?select=id,status&status=neq.published&limit=5"
  Invoke-RestMethod -Uri $u -Headers $h | ConvertTo-Json -Compress
} catch {
  "request failed: " + $_.Exception.Response.StatusCode.value__
}

Write-Host ""
Write-Host "=== PHASE 3: write function refuses a stranger ==="
Write-Host "Expected: permission denied for function (after migration 045). Before 045 the function refuses with author_id does not match. Any success is a failure."
$z = "00000000-0000-0000-0000-000000000000"
$body = @{ p_version_id = $z; p_sequence_id = $z; p_author_id = $z } | ConvertTo-Json
try {
  Invoke-RestMethod -Uri "$SB/rest/v1/rpc/delete_sequence_version" -Headers $h -Method Post -ContentType "application/json" -Body $body
  Write-Host "RESULT: call SUCCEEDED (this is a failure, tell Claude)"
} catch {
  $code = ""
  try { $code = [int]$_.Exception.Response.StatusCode } catch { }
  $msg = $_.ErrorDetails.Message
  if (-not $msg) { $msg = $_.Exception.Message }
  "RESULT: refused (HTTP $code) -> " + $msg
}

Write-Host ""
Write-Host "=== PHASE 4a: security headers on the live site ==="
curl.exe -sI https://lazygrip.net | Select-String "content-security|x-frame|x-content|referrer|permissions|strict-transport"

Write-Host ""
Write-Host "=== PHASE 4b: guarded API routes with no login or secret ==="
Write-Host "Expected: 401 or 403 on every line. 200 = missing guard. 500 = bug."
$routes = @(
  "GET /api/cron/patch-reminder",
  "POST /api/relay/discord-comment",
  "POST /api/relay/discord-comment-edit",
  "POST /api/relay/discord-comment-delete",
  "POST /api/relay-identity",
  "POST /api/admin/sequence-thread",
  "POST /api/comments",
  "POST /api/comments/edit",
  "POST /api/comments/delete",
  "POST /api/sequences/delete",
  "POST /api/notify-discord"
)
foreach ($p in $routes) {
  $m, $path = $p -split " "
  $code = curl.exe -s -o NUL -w "%{http_code}" -X $m "https://lazygrip.net$path" -H "Content-Type: application/json" -d "{}"
  "{0,-6}{1,-42}{2}" -f $m, $path, $code
}

Write-Host ""
Write-Host "Done. Copy everything above and paste it back to Claude."
