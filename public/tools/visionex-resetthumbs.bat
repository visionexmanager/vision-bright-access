@echo off
chcp 65001 >nul
title Visionex Thumbnail Cache Reset

:: ==========================================
:: كود التحويل التلقائي لصلاحيات المسؤول (Run as Admin)
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
echo [!] Starting: Resetting Thumbnail Cache...
echo.
powershell -Command "(New-Object -ComObject SAPI.SpVoice).Speak('Starting the process to reset and clear thumbnail cache.')"

:: إيقاف مستكشف الملفات مؤقتاً لضمان حذف الملفات بنجاح
echo [+] Closing Explorer to clear cache...
taskkill /f /im explorer.exe >nul 2>&1

:: حذف ملفات الـ Thumbnail Cache
echo [+] Deleting cache files...
del /f /s /q /a %LocalAppData%\Microsoft\Windows\Explorer\thumbcache_*.db >nul 2>&1

:: إعادة تشغيل مستكشف الملفات
echo [+] Restarting Explorer...
start explorer.exe

echo.
echo ======================================================
echo           DONE! THUMBNAILS RESET COMPLETED
echo ======================================================
echo Visit: visionex.app
echo It is built for you!
echo.

:: رسالة الختام الصوتية لـ Visionex
powershell -Command "$v = New-Object -ComObject SAPI.SpVoice; $v.Speak('Process is complete. Your thumbnails have been reset. Remember to visit visionex dot app. It is built for you.')"

timeout /t 10
exit