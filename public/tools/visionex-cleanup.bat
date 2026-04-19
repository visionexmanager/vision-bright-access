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

title Visionex Critical Optimizer
color 0c
set "vbsfile=%temp%\talk.vbs"

echo ===================================================
echo    WARNING: SYSTEM OPTIMIZATION IN PROGRESS
echo    PLEASE DO NOT PRESS ANY KEY UNTIL FINISHED
echo ===================================================

:: رسالة تحذيرية في البداية بالصوت
echo CreateObject("SAPI.SpVoice").Speak "Optimization is starting. Please do not touch your keyboard or press any key until the process is complete for your safety." > "%vbsfile%"
cscript //nologo "%vbsfile%"

:: تغيير اللون ليوحي بالعمل (اللون الأحمر للتحذير)
color 0c

:: 1. تنظيف الملفات المؤقتة
echo Cleaning files...
echo CreateObject("SAPI.SpVoice").Speak "Cleaning temporary files" > "%vbsfile%"
cscript //nologo "%vbsfile%"
del /s /f /q C:\Windows\Temp\*.* >nul 2>&1
del /s /f /q %temp%\*.* >nul 2>&1

:: 2. تنظيف الـ DNS
color 0b
echo Flushing DNS...
echo CreateObject("SAPI.SpVoice").Speak "Flushing D N S cache" > "%vbsfile%"
cscript //nologo "%vbsfile%"
ipconfig /flushdns >nul 2>&1

:: 3. تنظيف السجلات
echo Cleaning Logs...
echo CreateObject("SAPI.SpVoice").Speak "Removing system logs" > "%vbsfile%"
cscript //nologo "%vbsfile%"
cd /d C:\
del *.log /a /s /q /f >nul 2>&1

:: 4. تنظيف القرص
echo Running Disk Cleanup...
echo CreateObject("SAPI.SpVoice").Speak "Starting disk cleanup" > "%vbsfile%"
cscript //nologo "%vbsfile%"
cleanmgr /sagerun:1 /verylowdisk

:: 5. إفراغ السلة
echo Emptying Recycle Bin...
echo CreateObject("SAPI.SpVoice").Speak "Emptying recycle bin" > "%vbsfile%"
cscript //nologo "%vbsfile%"
powershell.exe -command "Clear-RecycleBin -Confirm:$false -ErrorAction SilentlyContinue" >nul 2>&1

:: 6. الخاتمة الترحيبية المخصصة
echo Done!
echo CreateObject("SAPI.SpVoice").Speak "Welcome %USERNAME%. Optimization complete. Don't forget to visit visionex dot app. It is built for you." > "%vbsfile%"
cscript //nologo "%vbsfile%"

:: تنظيف الملف المؤقت
if exist "%vbsfile%" del "%vbsfile%"

color 0a
echo ===================================================
echo    SUCCESS: Welcome %USERNAME%!
echo    Visionex project is ready for development.
echo ===================================================
timeout /t 10
exit