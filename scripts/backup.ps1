param(
  [string]$PostgresContainer = "birgus_pg",
  [string]$PostgresUser = "postgres",
  [string]$Database = "birgus",
  [string]$BackupRoot = "backups",
  [int]$KeepDays = 14
)

$ErrorActionPreference = "Stop"

function Invoke-Docker([string[]]$Arguments) {
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Docker command failed: docker $($Arguments -join ' ')"
  }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
$root = Join-Path (Resolve-Path $BackupRoot) "birgus-$timestamp"
$archive = "$root.zip"
New-Item -ItemType Directory -Force -Path $root | Out-Null

try {
  $running = (& docker inspect --format '{{.State.Running}}' $PostgresContainer).Trim()
  if ($LASTEXITCODE -ne 0 -or $running -ne "true") {
    throw "PostgreSQL container '$PostgresContainer' is not running."
  }
  Invoke-Docker @("exec", $PostgresContainer, "sh", "-lc", "pg_dump -U '$PostgresUser' -Fc -d '$Database' -f /tmp/birgus.dump")
  Invoke-Docker @("cp", "${PostgresContainer}:/tmp/birgus.dump", (Join-Path $root "postgres.dump"))
  Invoke-Docker @("exec", $PostgresContainer, "rm", "-f", "/tmp/birgus.dump")

  $storagePaths = @("garage/meta", "garage/data", "ocr_service/storage") | Where-Object { Test-Path $_ }
  if ($storagePaths.Count -gt 0) {
    $storageRoot = Join-Path $root "storage"
    New-Item -ItemType Directory -Force -Path $storageRoot | Out-Null
    Copy-Item -Recurse -Force $storagePaths $storageRoot
  }

  $files = Get-ChildItem -File -Recurse $root | ForEach-Object {
    [PSCustomObject]@{ path = $_.FullName.Substring($root.Length + 1); sha256 = (Get-FileHash $_.FullName -Algorithm SHA256).Hash; bytes = $_.Length }
  }
  [PSCustomObject]@{
    createdAt = (Get-Date).ToUniversalTime().ToString("o")
    postgresContainer = $PostgresContainer
    database = $Database
    files = $files
  } | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $root "manifest.json")

  Compress-Archive -Path (Join-Path $root "*") -DestinationPath $archive -Force
  Remove-Item -Recurse -Force $root
  Get-ChildItem -Path (Resolve-Path $BackupRoot) -Filter "birgus-*.zip" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } | Remove-Item -Force
  Write-Host "Backup completed: $archive"
} catch {
  if (Test-Path $root) { Remove-Item -Recurse -Force $root }
  throw
}
