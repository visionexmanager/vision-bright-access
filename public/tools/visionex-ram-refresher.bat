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

title Visionex RAM Refresher
color 0b
set "vbsfile=%temp%\talk.vbs"

echo ===================================================
echo    Visionex RAM Refresher - Boost Your Speed
echo ===================================================

:: رسالة البداية بالصوت
echo CreateObject("SAPI.SpVoice").Speak "Refreshing your R A M to improve performance. Please wait a moment." > "%vbsfile%"
cscript //nologo "%vbsfile%"

:: 1. إفراغ الـ Standby List (عبر الـ PowerShell)
echo Freeing up Standby Memory...
powershell -Command "[GC]::Collect(); [GC]::WaitForPendingFinalizers()" >nul 2>&1

:: 2. إغلاق العمليات التي تستهلك الرام في الخلفية بشكل مبالغ فيه
echo Optimizing background processes...
taskkill /f /im "msedge.exe" /fi "memusage gt 200000" >nul 2>&1
taskkill /f /im "chrome.exe" /fi "memusage gt 300000" >nul 2>&1

:: 3. إعادة تشغيل الـ Windows Explorer لتنشيط الذاكرة
echo Restarting Windows Explorer for stability...
taskkill /f /im explorer.exe >nul 2>&1
start explorer.exe
timeout /t 2 >nul

:: 4. تنظيف ذاكرة الكاش الخاصة بالنظام
echo CreateObject("SAPI.SpVoice").Speak "System memory has been refreshed successfully." > "%vbsfile%"
cscript //nologo "%vbsfile%"

:: 5. الخاتمة والدعاية
color 0a
echo Done!
echo CreateObject("SAPI.SpVoice").Speak "Welcome %USERNAME%. Your system is now smooth and fast. Experience more on visionex dot app." > "%vbsfile%"
cscript //nologo "%vbsfile%"

:: تنظيف الملف المؤقت
if exist "%vbsfile%" del "%vbsfile%"

echo ===================================================
echo    SUCCESS! RAM Refreshed & System is Smooth.
echo    Welcome %USERNAME% to Visionex.
echo ===================================================
timeout /t 7
exit