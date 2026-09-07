@echo off
REM ============================================================
REM  Capital Agro ERP - Production build (server + client)
REM ============================================================
setlocal
cd /d "%~dp0"

echo Building server...
call npm run build --workspace server
if errorlevel 1 goto :error

echo.
echo Building client...
call npm run build --workspace client
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  Build complete.
echo  Server output: server\dist\
echo  Client output: client\dist\
echo ============================================================
goto :eof

:error
echo.
echo *** Build FAILED. ***
exit /b 1
