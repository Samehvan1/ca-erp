@echo off
REM ============================================================
REM  Capital Agro ERP - Run server + client together (testing)
REM  Starts the API on port 4000 and the web UI on port 5173.
REM  Close this window to stop both.
REM ============================================================
setlocal
cd /d "%~dp0"

echo Starting Capital Agro ERP...
echo   Server: http://localhost:4000  (API)
echo   Client: http://localhost:5173  (Web UI)
echo   Health: http://localhost:4000/health
echo.
echo Press Ctrl+C in this window to stop both processes.
echo.

REM Start server in a new window, then client in the foreground.
start "CA-ERP Server" cmd /k "cd /d %~dp0 && npm run dev --workspace server"
call npm run dev --workspace client

echo.
echo Client stopped. Closing server window too...
taskkill /FI "WINDOWTITLE eq CA-ERP Server*" /T /F >nul 2>&1
