@echo off
REM ============================================================
REM  Capital Agro ERP - Run web client only (port 5173)
REM  Requires the API server to be running (run-server.bat).
REM ============================================================
setlocal
cd /d "%~dp0"

echo Starting web client on http://localhost:5173 ...
echo Press Ctrl+C to stop.
echo.
call npm run dev --workspace client
