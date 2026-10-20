@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  set "PARALLEL_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
) else (
  set "PARALLEL_NODE=node"
)
echo Admin: http://127.0.0.1:4181/admin/
echo Website: http://127.0.0.1:4181/
echo Keep this window open while using the administration panel.
"%PARALLEL_NODE%" server/index.mjs
pause
