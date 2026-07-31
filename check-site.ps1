# LazyGrip Monthly Health Check
# Run this from the repo root: C:\Users\edost\Documents\GitHub\lazygrip-gg
# Usage: .\check-site.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " LazyGrip Health Check - $(Get-Date -Format 'yyyy-MM-dd')" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Make sure we're up to date first
Write-Host "[1/7] Pulling latest code..." -ForegroundColor Yellow
git pull
Write-Host ""

Write-Host "[2/7] Installing dependencies..." -ForegroundColor Yellow
npm install
Write-Host ""

# 2. Dependency vulnerabilities
Write-Host "[3/7] Checking for known vulnerabilities (npm audit)..." -ForegroundColor Yellow
npm audit
Write-Host ""
Write-Host "  --> Read the list above. 'high'/'critical' in a package under" -ForegroundColor Gray
Write-Host "      node_modules/next, node_modules/dompurify, node_modules/@supabase" -ForegroundColor Gray
Write-Host "      matters most (shipped to the live site). Anything only under" -ForegroundColor Gray
Write-Host "      eslint/@typescript-eslint is dev-tooling only, lower urgency." -ForegroundColor Gray
Write-Host ""

# 3. Type errors
Write-Host "[4/7] Checking types (tsc --noEmit)..." -ForegroundColor Yellow
npx tsc --noEmit
if ($LASTEXITCODE -eq 0) {
    Write-Host "  --> Clean, no type errors." -ForegroundColor Green
} else {
    Write-Host "  --> Type errors found above. Worth fixing before next deploy." -ForegroundColor Red
}
Write-Host ""

# 4. Lint
Write-Host "[5/7] Linting..." -ForegroundColor Yellow
npm run lint
Write-Host ""

# 5. Build
Write-Host "[6/7] Building (confirms the site actually compiles)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "  --> Build succeeded." -ForegroundColor Green
} else {
    Write-Host "  --> BUILD FAILED. This is the most important check - do not deploy." -ForegroundColor Red
}
Write-Host ""

# 6. Search for risky code patterns
Write-Host "[7/7] Scanning code for risky patterns..." -ForegroundColor Yellow
Write-Host ""

Write-Host "  Checking for hardcoded fallback secrets (env var || 'string')..." -ForegroundColor Gray
$fallbacks = git grep -n "process.env\..*||"
if ($fallbacks) {
    Write-Host "  --> FOUND, review these manually:" -ForegroundColor Red
    Write-Host $fallbacks
} else {
    Write-Host "  --> None found. Clean." -ForegroundColor Green
}
Write-Host ""

Write-Host "  Checking for hardcoded secret-looking values..." -ForegroundColor Gray
$secrets = git grep -niE "(api[_-]?key|secret|password)\s*=\s*[`"']"
if ($secrets) {
    Write-Host "  --> FOUND, review these manually (some may be false positives):" -ForegroundColor Red
    Write-Host $secrets
} else {
    Write-Host "  --> None found. Clean." -ForegroundColor Green
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Done. Scroll up to review any red items." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
