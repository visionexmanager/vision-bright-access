@echo off
:: طلب صلاحيات المسؤول
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' ( goto UACPrompt ) else ( goto gotAdmin )
:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B
:gotAdmin

title Visionex Internet Booster
color 0e
set "vbsfile=%temp%\talk.vbs"

echo ===================================================
echo    Visionex Internet Booster - Speed up your Net
echo ===================================================

:: رسالة البداية بالصوت
echo CreateObject("SAPI.SpVoice").Speak "Starting internet optimization for %USERNAME%. Please wait while we boost your connection." > "%vbsfile%"
cscript //nologo "%vbsfile%"

:: 1. إعادة ضبط الـ IP و الـ DNS
echo Refreshing Network Configuration...
ipconfig /release >nul 2>&1
ipconfig /renew >nul 2>&1
ipconfig /flushdns >nul 2>&1

:: 2. تعيين DNS جوجل (الأسرع والأكثر أماناً)
echo Setting High-Speed DNS (Google DNS)...
netsh interface ip set dns name="Ethernet" static 8.8.8.8
netsh interface ip add dns name="Ethernet" 8.8.4.4 index=2
netsh interface ip set dns name="Wi-Fi" static 8.8.8.8
netsh interface ip add dns name="Wi-Fi" 8.8.4.4 index=2

:: 3. تحسين إعدادات الـ TCP لتقليل الـ Ping (مهم للألعاب والـ Streaming)
echo Optimizing TCP Settings...
netsh int tcp set global autotuninglevel=normal >nul 2>&1

:: 4. الخاتمة
echo CreateObject("SAPI.SpVoice").Speak "Internet boost complete. Visit visionex dot app for more professional tools. It is built for you." > "%vbsfile%"
cscript //nologo "%vbsfile%"

:: تنظيف الملف المؤقت
if exist "%vbsfile%" del "%vbsfile%"

color 0a
echo ===================================================
echo    SUCCESS! Your Internet is now Optimized.
echo    Visit: https://visionex.app
echo ===================================================
timeout /t 10
exit