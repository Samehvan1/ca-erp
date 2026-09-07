@echo off
REM ============================================================
REM  Capital Agro ERP - One-time setup
REM  Installs dependencies, generates Prisma client, applies the
REM  schema to the database, and seeds sample data.
REM
REM  Prerequisites:
REM    - Node.js 18+ and npm installed
REM    - PostgreSQL running
REM    - server\.env configured (copy from server\.env.example)
REM ============================================================
setlocal
cd /d "%~dp0"

echo.
echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 goto :error

echo.
echo [2/4] Generating Prisma client...
call npm run db:generate --workspace server
if errorlevel 1 goto :error

echo.
echo [3/4] Applying schema to database (prisma db push)...
call npm run db:push --workspace server
if errorlevel 1 goto :error

echo.
echo [4/4] Seeding sample data...
call npm run seed --workspace server
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  Setup complete!
echo  Start the system with:  run.bat
echo  Login: admin@capitalagro.com / Admin@123
echo ============================================================
goto :eof

:error
echo.
echo *** Setup FAILED. Check the error above. ***
exit /b 1
