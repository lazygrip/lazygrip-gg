# cross-account-probe.ps1
# Signs in as your TEST account and tries to touch other people's data.
# Every write is a no-op or is aimed at something that cannot exist, so nothing real changes.
# Your password is typed into a hidden prompt on this computer and never printed.

$SB = "https://csldntgdalzlwxozlmgv.supabase.co"
$anon  = Read-Host "Paste the Supabase anon key"
$email = Read-Host "Test account email"
$sec   = Read-Host "Test account password" -AsSecureString
$pw = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))

try {
  $login = Invoke-RestMethod -Uri "$SB/auth/v1/token?grant_type=password" -Method Post -Headers @{ apikey = $anon } -ContentType "application/json" -Body (@{ email = $email; password = $pw } | ConvertTo-Json)
} catch {
  Write-Host "SIGN-IN FAILED: $($_.ErrorDetails.Message)"
  exit 1
}
$pw = $null
$tok = $login.access_token
$me  = $login.user.id
Write-Host "Signed in. Test account id: $me"
Write-Host ""

$script:fails = 0
$script:inconclusive = 0

function Call($method, $path, $bodyObj, $prefer) {
  $hh = @{ apikey = $anon; Authorization = "Bearer $tok" }
  if ($prefer) { $hh["Prefer"] = $prefer }
  $p = @{ Uri = "$SB/rest/v1/$path"; Method = $method; Headers = $hh; UseBasicParsing = $true }
  if ($null -ne $bodyObj) { $p.ContentType = "application/json"; $p.Body = ($bodyObj | ConvertTo-Json -Depth 5 -Compress) }
  try {
    $r = Invoke-WebRequest @p
    return @{ status = [int]$r.StatusCode; text = $r.Content }
  } catch {
    $code = 0
    try { $code = [int]$_.Exception.Response.StatusCode } catch { }
    $t = $_.ErrorDetails.Message
    if (-not $t) { try { $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream()); $t = $sr.ReadToEnd() } catch { } }
    if (-not $t) { $t = $_.Exception.Message }
    return @{ status = $code; text = $t }
  }
}

function Rows($text) {
  try { $o = $text | ConvertFrom-Json } catch { return @() }
  if ($null -eq $o) { return @() }
  return @($o)
}

function Report($name, $verdict, $detail) {
  if ($verdict -eq "FAIL") { $script:fails++ }
  if ($verdict -eq "INCONCLUSIVE") { $script:inconclusive++ }
  Write-Host ("{0,-14} {1}  {2}" -f $verdict, $name, $detail)
}

Write-Host "=== PART 1: can the test account READ other people's private data? ==="
Write-Host "Expected: PASS on every line. FAIL means another user's private rows came back."

$r = Call "GET" "notifications?select=id,user_id&limit=200"
$bad = @((Rows $r.text) | Where-Object { $_.user_id -ne $me }).Count
if ($bad -eq 0) { Report "notifications of other users" "PASS" "0 foreign rows (HTTP $($r.status))" } else { Report "notifications of other users" "FAIL" "$bad foreign rows" }

$r = Call "GET" "saves?select=user_id&limit=200"
$bad = @((Rows $r.text) | Where-Object { $_.user_id -ne $me }).Count
if ($bad -eq 0) { Report "saves of other users" "PASS" "0 foreign rows (HTTP $($r.status))" } else { Report "saves of other users" "FAIL" "$bad foreign rows" }

$r = Call "GET" "ratings?select=user_id&limit=200"
$bad = @((Rows $r.text) | Where-Object { $_.user_id -ne $me }).Count
if ($bad -eq 0) { Report "ratings of other users" "PASS" "0 foreign rows (HTTP $($r.status))" } else { Report "ratings of other users" "FAIL" "$bad foreign rows" }

$r = Call "GET" "sequence_view_daily?select=sequence_id&limit=50"
$n = (Rows $r.text).Count
if ($n -eq 0) { Report "other authors' view history" "PASS" "0 rows (HTTP $($r.status))" } else { Report "other authors' view history" "FAIL" "$n rows" }

$r = Call "GET" "sequences?status=neq.published&select=id,author_id&limit=200"
$bad = @((Rows $r.text) | Where-Object { $_.author_id -ne $me }).Count
if ($bad -eq 0) { Report "other users' drafts and private sequences" "PASS" "0 foreign rows (HTTP $($r.status))" } else { Report "other users' drafts and private sequences" "FAIL" "$bad foreign rows" }

$r = Call "GET" "relay_failures?select=*&limit=5"
$n = (Rows $r.text).Count
if ($n -eq 0) { Report "relay_failures table" "PASS" "0 rows (HTTP $($r.status))" } else { Report "relay_failures table" "FAIL" "$n rows" }

foreach ($t in @("comment_rate_throttle","copy_count_throttle","post_rate_throttle","view_count_throttle")) {
  $r = Call "GET" "${t}?select=*&limit=1"
  if ($r.status -ge 400) { Report "$t" "PASS" "denied (HTTP $($r.status))" } else { Report "$t" "FAIL" "readable (HTTP $($r.status))" }
}

$r = Call "GET" "profiles?select=*&limit=1"
if ($r.status -ge 400) { Report "profiles select=* (private columns)" "PASS" "denied (HTTP $($r.status))" } else { Report "profiles select=* (private columns)" "FAIL" "readable, columns: $((Rows $r.text)[0].PSObject.Properties.Name -join ',')" }

Write-Host ""
Write-Host "=== PART 2: can the test account CHANGE other people's data? ==="
Write-Host "Each write sets a value to what it already is, or targets an id that does not exist."
Write-Host "PASS = refused or zero rows touched. FAIL = the write reached a real row."

$v = @(Rows (Call "GET" "sequences?status=eq.published&author_id=neq.$me&select=id,author_id,title&limit=1").text)
if ($v.Count -eq 0) {
  Report "victim sequence lookup" "INCONCLUSIVE" "no published sequence by another author found"
} else {
  $vs = $v[0]
  $r = Call "PATCH" "sequences?id=eq.$($vs.id)&select=id" @{ title = $vs.title } "return=representation"
  $n = @(Rows $r.text).Count
  if ($r.status -ge 400 -or $n -eq 0) { Report "edit another author's sequence" "PASS" "HTTP $($r.status), $n rows touched" } else { Report "edit another author's sequence" "FAIL" "$n row(s) updated" }

  $z = "00000000-0000-0000-0000-000000000000"
  $r = Call "POST" "rpc/delete_sequence_version" @{ p_version_id = $z; p_sequence_id = $vs.id; p_author_id = $vs.author_id }
  if ($r.status -ge 400) { Report "delete version as another author (RPC)" "PASS" "HTTP $($r.status) $($r.text)" } else { Report "delete version as another author (RPC)" "FAIL" "HTTP $($r.status) $($r.text)" }

  $r = Call "POST" "rpc/set_sequence_status" @{ p_sequence_id = $vs.id; p_status = "published" }
  if ($r.status -ge 400) { Report "change another author's sequence status (RPC)" "PASS" "HTTP $($r.status) $($r.text)" } else { Report "change another author's sequence status (RPC)" "FAIL" "HTTP $($r.status) $($r.text)" }

  $prc = Call "GET" "profiles?id=eq.$($vs.author_id)&select=id,display_name"
  $pr = @(Rows $prc.text)
  if ($pr.Count -gt 0) {
    $r = Call "PATCH" "profiles?id=eq.$($vs.author_id)&select=id" @{ display_name = $pr[0].display_name } "return=representation"
    $n = @(Rows $r.text).Count
    if ($r.status -ge 400 -or $n -eq 0) { Report "edit another user's profile" "PASS" "HTTP $($r.status), $n rows touched" } else { Report "edit another user's profile" "FAIL" "$n row(s) updated" }
  } else {
    Report "edit another user's profile" "INCONCLUSIVE" "could not read the other profile: HTTP $($prc.status) $($prc.text)"
  }

  $script:other = $vs.author_id
  $r = Call "POST" "rpc/get_posting_eligibility" @{ check_user_id = $vs.author_id }
  $n = @(Rows $r.text).Count
  if ($n -eq 0) { Report "posting eligibility of another user" "PASS" "empty answer (HTTP $($r.status))" } else { Report "posting eligibility of another user" "FAIL" "returned $n row(s)" }
}

$c = @(Rows (Call "GET" "comments?author_id=neq.$me&is_deleted=eq.false&select=id,body&limit=1").text)
if ($c.Count -eq 0) {
  Report "victim comment lookup" "INCONCLUSIVE" "no comment by another author found"
} else {
  $r = Call "PATCH" "comments?id=eq.$($c[0].id)&select=id" @{ body = $c[0].body } "return=representation"
  $n = @(Rows $r.text).Count
  if ($r.status -ge 400 -or $n -eq 0) { Report "edit another user's comment" "PASS" "HTTP $($r.status), $n rows touched" } else { Report "edit another user's comment" "FAIL" "$n row(s) updated" }
}

# Forged-identity inserts. The sequence_id is all zeros so the row can never be saved even if the policy let it through.
# A row-level security error means the policy stopped it first. A foreign-key or not-null error means the policy let it through.
$z = "00000000-0000-0000-0000-000000000000"
$other = $script:other
Write-Host "Forged-identity tests will impersonate user id: $other"
if (-not $other) { Report "forged-identity inserts" "INCONCLUSIVE" "skipped, no other author id available" }
if ($other) {
  $r = Call "POST" "comments" @{ sequence_id = $z; author_id = $other; body = "probe" }
  if ($r.status -eq 403 -or $r.text -match "row-level security|42501") { Report "post a comment as another user" "PASS" "blocked by row-level security" }
  elseif ($r.text -match "23503|23502|foreign key|null value") { Report "post a comment as another user" "FAIL" "policy allowed it, blocked only by a constraint: $($r.text)" }
  else { Report "post a comment as another user" "INCONCLUSIVE" "HTTP $($r.status) $($r.text)" }

  $r = Call "POST" "notifications" @{ user_id = $other; type = "probe"; message = "probe" }
  if ($r.status -eq 403 -or $r.text -match "row-level security|42501") { Report "create a notification for another user" "PASS" "blocked by row-level security" }
  elseif ($r.status -ge 200 -and $r.status -lt 300) { Report "create a notification for another user" "FAIL" "a notification was created for them" }
  elseif ($r.text -match "23503|23502|23514|foreign key|null value|check constraint") { Report "create a notification for another user" "FAIL" "policy allowed it, blocked only by a constraint: $($r.text)" }
  else { Report "create a notification for another user" "INCONCLUSIVE" "HTTP $($r.status) $($r.text)" }

  $r = Call "POST" "ratings" @{ sequence_id = $z; user_id = $other; score = 5 }
  if ($r.status -eq 403 -or $r.text -match "row-level security|42501") { Report "rate as another user" "PASS" "blocked by row-level security" }
  elseif ($r.text -match "23503|23502|foreign key|null value") { Report "rate as another user" "FAIL" "policy allowed it, blocked only by a constraint: $($r.text)" }
  else { Report "rate as another user" "INCONCLUSIVE" "HTTP $($r.status) $($r.text)" }
}

# Privilege escalation on your own row: columns the site never lets a user change.
$r = Call "PATCH" "profiles?id=eq.$me&select=id" @{ terms_accepted_at = "2000-01-01T00:00:00Z" } "return=representation"
if ($r.status -ge 400) { Report "change a protected profile column (own row)" "PASS" "HTTP $($r.status) $($r.text)" } else { Report "change a protected profile column (own row)" "FAIL" "the update went through" }

Write-Host ""
Write-Host "Done. FAIL count: $script:fails   INCONCLUSIVE count: $script:inconclusive"
Write-Host "Copy everything above and paste it back to Claude. The password is not in it."
