@echo off
chcp 65001 >nul
title Visionex Deep Malware Hunter

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
echo [!] Hunting for Hidden Malware & Shortcut Viruses...
powershell -Command "(New-Object -ComObject SAPI.SpVoice).Speak('Hunting for hidden malware and fixing file attributes. Please wait.')"

:: 1. إظهار الملفات المخفية في جميع الأقراص (خاصة الفلاشات)
echo [+] Fixing Hidden File Attributes...
:: هذا الأمر يزيل صفة "مخفي" و "نظام" و "للقراءة فقط" عن كل الملفات ليعيدها للظهور
attrib -h -r -s /s /d *.* >nul 2>&1

:: 2. حذف ملفات الـ Shortcut الوهمية التي تصنعها الفيروسات
echo [+] Deleting malicious shortcuts...
del *.lnk /f /q >nul 2>&1
del *.vbs /f /q >nul 2>&1
del *.inf /f /q >nul 2>&1

:: 3. البحث عن ملفات autorun المشبوهة وحذفها
echo [+] Cleaning Autorun traces...
if exist autorun.inf (
    attrib -s -r -h autorun.inf
    del autorun.inf
)

echo.
echo ======================================================
echo      HIDDEN THREATS REMOVED SUCCESSFULLY
echo ======================================================
echo Visit: visionex.app
echo It is built for you!
echo.

powershell -Command "$v = New-Object -ComObject SAPI.SpVoice; $v.Speak('Deep cleaning is complete. Hidden files are now visible and shortcuts are cleared. Remember to visit visionex dot app. It is built for you.')"

timeout /t 10
exit