@echo off
cd /d "%~dp0"
set "PORT=4319"
echo Poetry Atelier: http://localhost:4319/
echo Keep this window open while using AI. Press Ctrl+C to stop.
node --max-old-space-size=4096 server.js
pause
