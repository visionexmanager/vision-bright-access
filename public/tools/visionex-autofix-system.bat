@echo off
chcp 65001 >nul
title Visionex System Repair Tool

:: ==========================================
:: تشغيل كمسؤول تلقائياً
:: ==========================================
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    goto UACPrompt
) else ( goto gotAdmin )
:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B
:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"
:: ==========================================

cls
echo ======================================================
echo          Welcome, %USERNAME%
echo ======================================================
powershell -Command "(New-Object -ComObject SAPI.SpVoice).Speak('Welcome %USERNAME%')"

echo.
echo [!] ATTENTION: Please do not touch the computer now.
echo.
powershell -Command "(New-Object -ComObject SAPI.SpVoice).Speak('Please do not touch the computer while the file is running')"

echo [+] Starting Stage 1: System Image Health...
dism /online /cleanup-image /restorehealth /quiet /norestart
echo [OK] Stage 1 Completed.
echo.

echo [+] Starting Stage 2: System File Repair...
sfc /scannow
echo [OK] Stage 2 Completed.
echo.

echo ======================================================
echo           DONE! SYSTEM IS OPTIMIZED
echo ======================================================
echo Visit: visionex.app
echo It is built for you!
echo.

:: طريقة نطق مضمونة ومجربة لنظام ويندوز
powershell -Command "$v = New-Object -ComObject SAPI.SpVoice; $v.Speak('Maintenance is complete. Remember to visit visionex dot app. It is built for you.')"

timeout /t 10
exit