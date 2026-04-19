@echo off
chcp 65001 >nul
title Visionex File Organizer

:: ترحيب صوتي عام
powershell -Command "(New-Object -ComObject SAPI.SpVoice).Speak('Welcome. I will help you organize your files now.')"

echo ======================================================
echo           أداة تنظيم الملفات التلقائية
echo ======================================================
echo.

:: إنشاء المجلدات إذا لم تكن موجودة
if not exist "Images" mkdir "Images"
if not exist "Documents" mkdir "Documents"
if not exist "Programs" mkdir "Programs"
if not exist "Compressed" mkdir "Compressed"
if not exist "Videos_Music" mkdir "Videos_Music"

echo [+] Organizing files...

:: نقل الصور
move *.jpg "Images" >nul 2>&1
move *.png "Images" >nul 2>&1
move *.jpeg "Images" >nul 2>&1
move *.gif "Images" >nul 2>&1

:: نقل المستندات
move *.pdf "Documents" >nul 2>&1
move *.docx "Documents" >nul 2>&1
move *.txt "Documents" >nul 2>&1
move *.xlsx "Documents" >nul 2>&1

:: نقل البرامج والملفات التنفيذية
move *.exe "Programs" >nul 2>&1
move *.msi "Programs" >nul 2>&1

:: نقل الملفات المضغوطة
move *.zip "Compressed" >nul 2>&1
move *.rar "Compressed" >nul 2>&1

:: نقل الفيديو والصوت
move *.mp4 "Videos_Music" >nul 2>&1
move *.mp3 "Videos_Music" >nul 2>&1

echo [OK] All files are now organized into folders.
echo.
echo ======================================================
echo Visit: visionex.app | it is built for you
echo ======================================================

:: رسالة الختام
powershell -Command "(New-Object -ComObject SAPI.SpVoice).Speak('Your files are now organized. Remember to visit visionex dot app, it is built for you.')"

timeout /t 7
exit