@echo off
REM ============================================================
REM  Capital Agro ERP - Run API server only (port 4000)
REM ============================================================
setlocal
cd /d "%~dp0"

echo Starting API server on http://localhost:4000 ...
echo Health check: http://localhost:4000/health
echo Press Ctrl+C to stop.
echo.
call npm run dev --workspace server
