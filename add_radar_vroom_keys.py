import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

radar_keys = {
    'ar': {
        'radar.errSelectImage': 'يرجى اختيار ملف صورة',
        'radar.errFileSize': 'حجم الصورة يتجاوز 10 ميغابايت',
        'radar.errAnalysis': 'فشل التحليل. حاول مجداً.',
        'radar.badgeAudio': 'تحليل صوتي',
        'radar.badgeCamera': 'كاميرا مباشرة',
        'radar.badgeAccessible': 'إمكانية الوصول',
        'radar.ariaCamera': 'بث الكاميرا المباشر',
        'radar.ariaUpload': 'منطقة رفع الصورة',
        'radar.speechObjects': 'الأشياء:',
        'radar.speechText': 'النصوص:',
        'radar.speechPeople': 'الأشخاص:',
        'radar.speechEnvironment': 'البيئة:',
        'radar.speechSafety': 'السلامة:',
        'radar.speechTip': 'نصيحة:',
    },
    'de': {
        'radar.errSelectImage': 'Bitte eine Bilddatei auswählen',
        'radar.errFileSize': 'Bild überschreitet 10 MB',
        'radar.errAnalysis': 'Analyse fehlgeschlagen. Bitte erneut versuchen.',
        'radar.badgeAudio': 'Audiobeschreibung',
        'radar.badgeCamera': 'Live-Kamera',
        'radar.badgeAccessible': 'Barrierefrei',
        'radar.ariaCamera': 'Live-Kamera-Feed',
        'radar.ariaUpload': 'Bild-Upload-Bereich',
        'radar.speechObjects': 'Objekte:',
        'radar.speechText': 'Text:',
        'radar.speechPeople': 'Personen:',
        'radar.speechEnvironment': 'Umgebung:',
        'radar.speechSafety': 'Sicherheit:',
        'radar.speechTip': 'Tipp:',
    },
    'es': {
        'radar.errSelectImage': 'Por favor selecciona un archivo de imagen',
        'radar.errFileSize': 'La imagen supera 10 MB',
        'radar.errAnalysis': 'Análisis fallido. Por favor intenta de nuevo.',
        'radar.badgeAudio': 'Descripción de audio',
        'radar.badgeCamera': 'Cámara en vivo',
        'radar.badgeAccessible': 'Accesible',
        'radar.ariaCamera': 'Transmisión de cámara en vivo',
        'radar.ariaUpload': 'Área de carga de imagen',
        'radar.speechObjects': 'Objetos:',
        'radar.speechText': 'Texto:',
        'radar.speechPeople': 'Personas:',
        'radar.speechEnvironment': 'Entorno:',
        'radar.speechSafety': 'Seguridad:',
        'radar.speechTip': 'Consejo:',
    },
    'fr': {
        'radar.errSelectImage': "Veuillez sélectionner un fichier image",
        'radar.errFileSize': "L'image dépasse 10 Mo",
        'radar.errAnalysis': "Analyse échouée. Veuillez réessayer.",
        'radar.badgeAudio': 'Description audio',
        'radar.badgeCamera': 'Caméra en direct',
        'radar.badgeAccessible': 'Accessible',
        'radar.ariaCamera': 'Flux caméra en direct',
        'radar.ariaUpload': "Zone de téléchargement d'image",
        'radar.speechObjects': 'Objets :',
        'radar.speechText': 'Texte :',
        'radar.speechPeople': 'Personnes :',
        'radar.speechEnvironment': 'Environnement :',
        'radar.speechSafety': 'Sécurité :',
        'radar.speechTip': 'Conseil :',
    },
    'pt': {
        'radar.errSelectImage': 'Por favor selecione um arquivo de imagem',
        'radar.errFileSize': 'Imagem excede 10 MB',
        'radar.errAnalysis': 'Análise falhou. Por favor tente novamente.',
        'radar.badgeAudio': 'Descrição de áudio',
        'radar.badgeCamera': 'Câmera ao vivo',
        'radar.badgeAccessible': 'Acessível',
        'radar.ariaCamera': 'Feed de câmera ao vivo',
        'radar.ariaUpload': 'Área de upload de imagem',
        'radar.speechObjects': 'Objetos:',
        'radar.speechText': 'Texto:',
        'radar.speechPeople': 'Pessoas:',
        'radar.speechEnvironment': 'Ambiente:',
        'radar.speechSafety': 'Segurança:',
        'radar.speechTip': 'Dica:',
    },
    'ru': {
        'radar.errSelectImage': 'Пожалуйста, выбери��е файл изображения',
        'radar.errFileSize': 'Изображение превышает 10 МБ',
        'radar.errAnalysis': 'Анализ не удался. Попробуйте снова.',
        'radar.badgeAudio': 'Аудио описание',
        'radar.badgeCamera': 'Живая камера',
        'radar.badgeAccessible': 'Доступно',
        'radar.ariaCamera': 'Прямой эфир с камеры',
        'radar.ariaUpload': 'Область загрузки изображения',
        'radar.speechObjects': 'Объекты:',
        'radar.speechText': 'Текст:',
        'radar.speechPeople': 'Люди:',
        'radar.speechEnvironment': 'Среда:',
        'radar.speechSafety': 'Безопасность:',
        'radar.speechTip': 'Совет:',
    },
    'tr': {
        'radar.errSelectImage': 'Lütfen bir resim dosyası seçin',
        'radar.errFileSize': 'Resim 10 MB sınırını aşıyor',
        'radar.errAnalysis': 'Analiz başarısız. Lütfen tekrar deneyin.',
        'radar.badgeAudio': 'Sesli Açıklama',
        'radar.badgeCamera': 'Canlı Kamera',
        'radar.badgeAccessible': 'Erişilebilir',
        'radar.ariaCamera': 'Canlı kamera akışı',
        'radar.ariaUpload': 'Görsel yükleme alanı',
        'radar.speechObjects': 'Nesneler:',
        'radar.speechText': 'Metin:',
        'radar.speechPeople': 'İnsanlar:',
        'radar.speechEnvironment': 'Ortam:',
        'radar.speechSafety': 'Güvenlik:',
        'radar.speechTip': 'İpucu:',
    },
    'zh': {
        'radar.errSelectImage': '请选择一个图片文件',
        'radar.errFileSize': '图片超过10MB',
        'radar.errAnalysis': '分析失败，请重试。',
        'radar.badgeAudio': '音频描述',
        'radar.badgeCamera': '实时摄像头',
        'radar.badgeAccessible': '无障碍',
        'radar.ariaCamera': '实时摄像头画面',
        'radar.ariaUpload': '图片上传区域',
        'radar.speechObjects': '物体：',
        'radar.speechText': '文字：',
        'radar.speechPeople': '人物：',
        'radar.speechEnvironment': '环境：',
        'radar.speechSafety': '安全：',
        'radar.speechTip': '提示：',
    },
}

anchor = '"svcReq.successToast":'

for lang, keys in radar_keys.items():
    path = f'src/i18n/{lang}.ts'
    with open(path, encoding='utf-8') as f:
        content = f.read()
    lines_to_add = []
    for k, v in keys.items():
        if f'"{k}"' not in content:
            escaped = v.replace('"', '\\"')
            lines_to_add.append(f'  "{k}": "{escaped}",')
    if not lines_to_add:
        print(f'  SKIP {lang}')
        continue
    block = '\n' + '\n'.join(lines_to_add)
    idx = content.find(anchor)
    end = content.index('\n', idx) + 1
    content = content[:end] + block + '\n' + content[end:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  DONE {lang}: +{len(lines_to_add)} keys')

print('All done.')
