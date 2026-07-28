@echo off
REM Starts the Relay site (Vite frontend) and backend (proxy server) together.
setlocal

cd /d "%~dp0"

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
