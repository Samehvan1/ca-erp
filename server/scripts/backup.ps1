# Capital Agro ERP - PostgreSQL backup script
# Usage:  pwsh scripts/backup.ps1 [-Database capital_agro] [-Keep 14] [-OutDir ../backups]
# Requires: pg_dump on PATH (PostgreSQL 18+ client tools)
# Produces: <OutDir>/capital_agro_YYYYMMDD_HHMMSS.dump  (custom format, compressed)
# Retention: keeps the newest $Keep backups, deletes older ones.

param(
  [string]$Database = "capital_agro",
  [int]$Keep = 14,
  [string]$OutDir = (Join-Path (Split-Path $PSScriptRoot -Parent) "backups")
)

$ErrorActionPreference = "Stop"

# Resolve connection from server/.env so credentials live in one place
$envPath = Join-Path $PSScriptRoot "..\.env"
$conn = @{}
if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*DATABASE_URL="?postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(\w+)"?\s*$') {
      $conn = @{ user = $Matches[1]; pass = $Matches[2]; host = $Matches[3]; port = $Matches[4]; db = $Matches[5] }
    }
  }
}
if (-not $conn.ContainsKey("db")) { throw "DATABASE_URL not found in server/.env" }
if ($Database -eq "capital_agro") { $Database = $conn.db }

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) { throw "pg_dump not found on PATH. Install PostgreSQL client tools." }

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$file = Join-Path $OutDir "${Database}_${stamp}.dump"

$env:PGPASSWORD = $conn.pass
& $pgDump.Source "--host=$($conn.host)" "--port=$($conn.port)" "--username=$($conn.user)" "--dbname=$Database" "--format=custom" "--file=$file" "--no-owner" "--no-privileges"
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }
Remove-Item Env:PGPASSWORD

$size = [Math]::Round((Get-Item $file).Length / 1MB, 2)
"Backup written: $file ($size MB)"

# Retention: keep newest $Keep
$old = Get-ChildItem $OutDir -Filter "${Database}_*.dump" | Sort-Object Name -Descending | Select-Object -Skip $Keep
foreach ($f in $old) { Remove-Item $f.FullName; "Pruned: $($f.Name)" }
"Retention: keeping newest $Keep backups."