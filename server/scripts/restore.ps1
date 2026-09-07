# Capital Agro ERP - PostgreSQL restore script
# Usage:  pwsh scripts/restore.ps1 -File ..\backups\capital_agro_20260829_220000.dump [-Database capital_agro]
# Requires: pg_restore on PATH (PostgreSQL 18+ client tools)
# WARNING: Drops and recreates the target database. Run against a test DB first.

param(
  [Parameter(Mandatory = $true)][string]$File,
  [string]$Database = "capital_agro"
)

$ErrorActionPreference = "Stop"

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

if (-not (Test-Path $File)) { throw "Backup file not found: $File" }
$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
if (-not $pgRestore) { throw "pg_restore not found on PATH. Install PostgreSQL client tools." }

$env:PGPASSWORD = $conn.pass
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) { throw "psql not found on PATH." }

# Terminate connections and drop/recreate so restore starts clean
& $psql.Source "--host=$($conn.host)" "--port=$($conn.port)" "--username=$($conn.user)" "--dbname=postgres" "-c" "DROP DATABASE IF EXISTS $Database WITH (FORCE);" | Out-Null
& $psql.Source "--host=$($conn.host)" "--port=$($conn.port)" "--username=$($conn.user)" "--dbname=postgres" "-c" "CREATE DATABASE $Database;" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Database recreate failed" }

& $pgRestore.Source "--host=$($conn.host)" "--port=$($conn.port)" "--username=$($conn.user)" "--dbname=$Database" "--no-owner" "--no-privileges" $File
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE" }
Remove-Item Env:PGPASSWORD

"Restore complete: $File -> $Database"