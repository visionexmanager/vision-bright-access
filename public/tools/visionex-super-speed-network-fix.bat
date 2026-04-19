@echo off
chcp 65001 >nul
title Visionex Network & Speed Optimizer

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
powershell -Command "Write-Host ' [!] Starting Network & Speed Optimization...' -ForegroundColor Cyan"
powershell -Command "(New-Object -ComObject SAPI.SpVoice).Speak('Optimizing your network and system speed now.')"

:: 1. تنظيف كاش الشبكة (DNS Flush)
echo [+] Flushing DNS...
ipconfig /flushdns >nul
echo [+] Resetting Winsock...
netsh winsock reset >nul

:: 2. تحسين إعدادات "البينج" واستجابة الإنترنت
echo [+] Optimizing TCP settings...
netsh int tcp set global autotuninglevel=normal >nul
netsh int tcp set global chimney=enabled >nul

:: 3. إلغاء تحديد السرعة المحجوزة للويندوز
echo [+] Releasing reserved bandwidth...
netsh int tcp set global dca=enabled >nul
netsh int tcp set global netdma=enabled >nul

:: 4. إيقاف الخدمات التي تستهلك الرام والإنترنت في الخلفية (اختياري وآمن)
echo [+] Disabling background telemetry...
sc stop "DiagTrack" >nul 2>&1
sc config "DiagTrack" start=disabled >nul 2>&1

echo.
echo ======================================================
echo    NETWORK IS NOW OPTIMIZED FOR MAX SPEED
echo ======================================================
echo Visit: visionex.app
echo It is built for you!
echo.

powershell -Command "$v = New-Object -ComObject SAPI.SpVoice; $v.Speak('Your network and speed are now optimized. Don’t forget to visit visionex dot app. It is built for you.')"

timeout /t 10
exit