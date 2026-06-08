@echo off
chcp 65001 >nul
title Visionex Hardware Health Monitor

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
echo [!] Starting Hardware Health Check...
powershell -Command "(New-Object -ComObject SAPI.SpVoice).Speak('Checking your disk and battery status.')"

:: 1. فحص حالة الهارد ديسك
echo [+] Checking Disk Status (S.M.A.R.T)...
wmic diskdrive get model,status
echo.

:: 2. توليد تقرير البطارية (إذا كان لابتوب)
echo [+] Generating Battery Health Report...
powercfg /batteryreport /output "C:\battery_report.html" >nul 2>&1
if exist "C:\battery_report.html" (
    echo [OK] Battery report saved to C:\battery_report.html
) else (
    echo [NOTE] This device does not have a battery.
)

echo.
echo ======================================================
echo      HARDWARE CHECK COMPLETED BY VISIONEX
echo ======================================================
echo Visit: visionex.app
echo It is built for you!
echo.

powershell -Command "$v = New-Object -ComObject SAPI.SpVoice; $v.Speak('Hardware check is complete. Your disk status is displayed on the screen. Remember to visit visionex dot app. It is built for you.')"

timeout /t 15
exit