<#
.SYNOPSIS
  Full automated deployment script for LMS
  - Creates GitHub repo
  - Pushes code
  - Deploys frontend to Vercel
  - Gives Render instructions

.USAGE
  .\deploy.ps1 -GitHubToken "your_github_pat" -GitHubUser "your_github_username"
#>

param(
  [Parameter(Mandatory=$true)] [string]$GitHubToken,
  [Parameter(Mandatory=$true)] [string]$GitHubUser,
  [string]$RepoName = "lms-library-system",
  [string]$VercelToken = ""
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  ℹ  $msg" -ForegroundColor Yellow }

Write-Host "`n╔══════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║   LMS Automated Deployment Script           ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════╝`n" -ForegroundColor Magenta

# ─────────────────────────────────────────────────────────────
# STEP 1: Create GitHub Repository
# ─────────────────────────────────────────────────────────────
Write-Step "STEP 1: Creating GitHub repository '$RepoName'"

$headers = @{
  Authorization = "Bearer $GitHubToken"
  Accept        = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

# Check if repo already exists
try {
  $existing = Invoke-RestMethod -Uri "https://api.github.com/repos/$GitHubUser/$RepoName" -Headers $headers -Method GET
  Write-Info "Repository already exists: $($existing.html_url)"
  $repoUrl = $existing.html_url
  $repoClone = $existing.clone_url
} catch {
  # Create new repo
  $body = @{ name=$RepoName; description="Library Management System - Full Stack"; private=$false; auto_init=$false } | ConvertTo-Json
  $repo = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Headers $headers -Method POST -Body $body -ContentType "application/json"
  Write-Ok "GitHub repository created: $($repo.html_url)"
  $repoUrl  = $repo.html_url
  $repoClone = $repo.clone_url
}

# ─────────────────────────────────────────────────────────────
# STEP 2: Push code to GitHub
# ─────────────────────────────────────────────────────────────
Write-Step "STEP 2: Pushing code to GitHub"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Configure git with token for auth
$remoteWithToken = $repoClone -replace "https://", "https://${GitHubUser}:${GitHubToken}@"

$existingRemote = git remote 2>&1
if ($existingRemote -match "origin") {
  git remote set-url origin $remoteWithToken
  Write-Info "Updated existing remote"
} else {
  git remote add origin $remoteWithToken
  Write-Info "Added remote origin"
}

# Make sure all files are committed
git add -A
$status = git status --porcelain
if ($status) {
  git commit -m "Deploy: LMS full stack application"
  Write-Ok "Committed pending changes"
} else {
  Write-Info "Nothing new to commit"
}

git push -u origin main --force 2>&1
Write-Ok "Code pushed to GitHub: $repoUrl"

# ─────────────────────────────────────────────────────────────
# STEP 3: Deploy Frontend to Vercel
# ─────────────────────────────────────────────────────────────
Write-Step "STEP 3: Deploying Frontend to Vercel"

Set-Location "$scriptDir\frontend"

# Check vercel CLI
$vercelCmd = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelCmd) {
  Write-Info "Installing Vercel CLI..."
  npm install -g vercel | Out-Null
}

if ($VercelToken) {
  Write-Info "Deploying frontend with Vercel token..."
  
  # Create vercel project config
  $vercelConfig = @{
    version = 2
    name = "lms-frontend"
    builds = @(@{ src = "package.json"; use = "@vercel/static-build"; config = @{ distDir = "dist" } })
    routes = @(@{ src = "/(.*)" ; dest = "/index.html" })
  } | ConvertTo-Json -Depth 5
  
  $vercelConfig | Out-File -FilePath "vercel.json" -Encoding utf8
  
  $env:VERCEL_TOKEN = $VercelToken
  $deployOutput = vercel --token $VercelToken --yes --prod 2>&1
  
  # Extract URL from output
  $vercelUrl = ($deployOutput | Select-String -Pattern "https://[^\s]+" | Select-Object -Last 1).Matches.Value
  Write-Ok "Frontend deployed to Vercel: $vercelUrl"
  
} else {
  Write-Info "No Vercel token provided — run this manually:"
  Write-Host "`n  cd lms\frontend" -ForegroundColor White
  Write-Host "  vercel --prod`n" -ForegroundColor White
  $vercelUrl = "https://YOUR-APP.vercel.app"
}

Set-Location $scriptDir

# ─────────────────────────────────────────────────────────────
# STEP 4: Print Render Instructions
# ─────────────────────────────────────────────────────────────
Write-Step "STEP 4: Deploy Backend to Render (manual — takes 2 min)"

Write-Host @"

  Open: https://render.com → Sign in with GitHub

  Click: New + → Web Service
  Repository: $repoUrl
  
  Settings:
  ┌─────────────────────────────────────────────────────┐
  │ Name           : lms-backend                        │
  │ Root Directory : backend                            │
  │ Runtime        : Node                               │
  │ Build Command  : npm install && npm run build &&    │
  │                  npx prisma migrate deploy          │
  │ Start Command  : npm start                          │
  │ Instance Type  : Free                               │
  └─────────────────────────────────────────────────────┘

  Environment Variables to add:
  ┌──────────────────────┬──────────────────────────────────────────────────────────┐
  │ DATABASE_URL         │ (get from neon.tech — free PostgreSQL)                   │
  │ JWT_SECRET           │ lms_jwt_secret_key_x7k2mP9qL4nR8wZ3vB6yH1jF5sA0cE      │
  │ JWT_REFRESH_SECRET   │ lms_refresh_secret_m3nQ8pT1aW6xK4rV9bG2uL5hD0yJ7f      │
  │ JWT_EXPIRES_IN       │ 15m                                                      │
  │ JWT_REFRESH_EXPIRES  │ 7d                                                       │
  │ NODE_ENV             │ production                                               │
  │ FRONTEND_URL         │ $vercelUrl                                               │
  └──────────────────────┴──────────────────────────────────────────────────────────┘

  After Render deploy finishes:
  → Copy your Render URL (e.g. https://lms-backend.onrender.com)
  → Go to Vercel → your project → Settings → Environment Variables
  → Add: VITE_API_URL = https://lms-backend.onrender.com
  → Redeploy frontend

"@ -ForegroundColor White

Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Deployment Complete!                                    ║" -ForegroundColor Green
Write-Host "║                                                          ║" -ForegroundColor Green
Write-Host "║  GitHub : $repoUrl" -ForegroundColor Green
Write-Host "║  Frontend: $vercelUrl" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
