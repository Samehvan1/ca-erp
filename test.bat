@echo off
REM ============================================================
REM  Capital Agro ERP - Run the test suite (server)
REM ============================================================
setlocal
cd /d "%~dp0"

echo Running server tests...
call npm test
if errorlevel 1 goto :error

echo.
echo All tests passed.
goto :eof

:error
echo.
echo *** Tests FAILED. ***
exit /b 1
