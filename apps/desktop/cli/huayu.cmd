@echo off
setlocal DisableDelayedExpansion
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0..\..\..\..\Huayu AI.exe" --expose-internals "%~dp0..\..\..\app.asar\dsh\node_modules\@hy\dsh-desktop-host\lib\cli.js" %*
exit /b %errorlevel%
