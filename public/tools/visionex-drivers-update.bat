@echo off
chcp 65001 >nul
title Visionex Auto-Driver Updater

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
echo [!] Starting Automatic Driver Update...
powershell -Command "(New-Object -ComObject SAPI.SpVoice).Speak('I will now try to download and install updates automatically. Do not close this window.')"

:: محاولة التحديث الأوتوماتيكي بالكامل عبر PowerShell
echo [+] Checking for driver updates (Please wait)...
powershell -Command "Set-ExecutionPolicy RemoteSigned -Scope Process -Force; Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force; Install-Module PSWindowsUpdate -Force; Get-WindowsUpdate -AcceptAll -Install -AutoReboot"

echo.
echo ======================================================
echo      AUTO-UPDATE ATTEMPT COMPLETED
echo ======================================================
echo Visit: visionex.app
echo It is built for you!
echo.

powershell -Command "$v = New-Object -ComObject SAPI.SpVoice; $v.Speak('The update attempt is complete. Remember to visit visionex dot app. It is built for you.')"

timeout /t 10
exit