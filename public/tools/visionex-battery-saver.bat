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

title Visionex Battery Saver - توفير الطاقة
color 0e
set "vbsfile=%temp%\talk.vbs"

echo ===================================================
echo    Visionex Battery Saver - Optimizing Power
echo ===================================================

:: رسالة البداية بالصوت
echo CreateObject("SAPI.SpVoice").Speak "Starting battery optimization. Please do not press any key. We are extending your battery life now." > "%vbsfile%"
cscript //nologo "%vbsfile%"

:: 1. تفعيل وضع توفير الطاقة (Power Scheme)
echo Setting Power Plan to Power Saver...
powercfg /setactive a1841308-3541-4fab-bc81-f71556f20b4a >nul 2>&1

:: 2. تقليل سطوع الشاشة (إلى 50% لتوفير الطاقة)
echo Adjusting Screen Brightness...
powershell -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,50)" >nul 2>&1

:: 3. إغلاق الخدمات غير الضرورية التي تستهلك المعالج
echo Closing high-power background tasks...
echo CreateObject("SAPI.SpVoice").Speak "Closing background applications" > "%vbsfile%"
cscript //nologo "%vbsfile%"
taskkill /f /im "OneDrive.exe" >nul 2>&1
taskkill /f /im "Teams.exe" >nul 2>&1

:: 4. تعطيل الـ Bluetooth (اختياري لتوفير الطاقة)
echo Optimizing Wireless Devices...
powershell -Command "Get-PnpDevice | Where-Object { $_.FriendlyName -like '*Bluetooth*' } | Disable-PnpDevice -Confirm:$false" >nul 2>&1

:: 5. تقليل زمن إغلاق الشاشة عند عدم الاستخدام (إلى دقيقتين)
echo Setting Screen Timeout...
powercfg /timeout-ac-monitor 2 >nul 2>&1
powercfg /timeout-dc-monitor 2 >nul 2>&1

:: 6. الخاتمة
color 0a
echo Done!
echo CreateObject("SAPI.SpVoice").Speak "Battery optimization complete. Welcome %USERNAME%. Your laptop will now last longer. Visit visionex dot app for more professional tools." > "%vbsfile%"
cscript //nologo "%vbsfile%"

:: تنظيف الملف المؤقت
if exist "%vbsfile%" del "%vbsfile%"

echo ===================================================
echo    SUCCESS! Battery Optimized.
echo    Welcome %USERNAME% to Visionex World.
echo ===================================================
timeout /t 10
exit