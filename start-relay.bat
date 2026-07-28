@echo off
REM Starts the Relay site (Vite frontend) and backend (proxy server) together.
setlocal

cd /d "%~dp0"

echo Stopping any running Relay instances...
for %%P in (5173 8787) do (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P" ^| findstr "LISTENING"') do (
        echo   Killing process %%A on port %%P
        taskkill /F /PID %%A >nul 2>&1
    )
)

if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo npm install failed.
        pause
        exit /b 1
    )
)

echo Starting Relay ^(frontend + backend^)...
call npm run dev

pause
