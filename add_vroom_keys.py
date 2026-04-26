import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

en_keys = {
    'vroom.participants': 'participant(s)',
    'vroom.unmute': 'Unmute',
    'vroom.mute': 'Mute',
    'vroom.leaveRoom': 'Leave room',
    'vroom.hint': 'Tap mic to mute/unmute • Tap phone to leave',
    'vroom.connecting': 'Connecting to room…',
    'vroom.notConfigured': 'Voice rooms not configured yet',
    'vroom.configDesc': 'The admin needs to configure VITE_LIVEKIT_URL and deploy the Edge Function to enable this feature.',
    'vroom.backToCommunity': 'Back to Community',
    'vroom.live': 'Live',
    'vroom.leave': 'Leave',
    'vroom.tokenError': 'Failed to get room token',
    'vroom.connectionError': 'Connection error',
}

translations = {
    'ar': {
        'vroom.participants': 'مشارك',
        'vroom.unmute': 'تشغيل الميكروفون',
        'vroom.mute': 'كتم الميكروفون',
        'vroom.leaveRoom': 'مغادرة الغرفة',
        'vroom.hint': 'انقر على الميكروفون للكتم / الرفع • انقر الهاتف للمغادرة',
        'vroom.connecting': 'جاري الاتصال بالغرفة...',
        'vroom.notConfigured': 'الغرف الصوتية غير مفعّلة بعد',
        'vroom.configDesc': 'يحتاج المدير إلى ضبط VITE_LIVEKIT_URL وإعداد Edge Function لتفعيل هذه الميزة.',
        'vroom.backToCommunity': 'العودة للمجتمع',
        'vroom.live': 'مباشر',
        'vroom.leave': 'مغادرة',
        'vroom.tokenError': 'فشل الحصول على رمز الغرفة',
        'vroom.connectionError': 'خطأ في الاتصال',
    },
    'de': {
        'vroom.participants': 'Teilnehmer',
        'vroom.unmute': 'Stummschaltung aufheben',
        'vroom.mute': 'Mikrofon stummschalten',
        'vroom.leaveRoom': 'Raum verlassen',
        'vroom.hint': 'Tippe auf Mikrofon zum Stummschalten • Tippe auf Telefon zum Verlassen',
        'vroom.connecting': 'Verbinde mit Raum...',
        'vroom.notConfigured': 'Sprachräume noch nicht konfiguriert',
        'vroom.configDesc': 'Der Admin muss VITE_LIVEKIT_URL konfigurieren und die Edge Function deployen.',
        'vroom.backToCommunity': 'Zurück zur Community',
        'vroom.live': 'Live',
        'vroom.leave': 'Verlassen',
        'vroom.tokenError': 'Raumtoken konnte nicht abgerufen werden',
        'vroom.connectionError': 'Verbindungsfehler',
    },
    'es': {
        'vroom.participants': 'participante(s)',
        'vroom.unmute': 'Activar micrófono',
        'vroom.mute': 'Silenciar micrófono',
        'vroom.leaveRoom': 'Salir de la sala',
        'vroom.hint': 'Toca el micrófono para silenciar • Toca el teléfono para salir',
        'vroom.connecting': 'Conectando a la sala...',
        'vroom.notConfigured': 'Las salas de voz aún no están configuradas',
        'vroom.configDesc': 'El administrador necesita configurar VITE_LIVEKIT_URL y desplegar la Edge Function.',
        'vroom.backToCommunity': 'Volver a la comunidad',
        'vroom.live': 'En vivo',
        'vroom.leave': 'Salir',
        'vroom.tokenError': 'No se pudo obtener el token de la sala',
        'vroom.connectionError': 'Error de conexión',
    },
    'fr': {
        'vroom.participants': 'participant(s)',
        'vroom.unmute': 'Activer le microphone',
        'vroom.mute': 'Couper le microphone',
        'vroom.leaveRoom': 'Quitter la salle',
        'vroom.hint': 'Appuyez sur le micro pour couper • Appuyez sur le téléphone pour partir',
        'vroom.connecting': 'Connexion à la salle...',
        'vroom.notConfigured': 'Salles vocales pas encore configurées',
        'vroom.configDesc': "L'administrateur doit configurer VITE_LIVEKIT_URL et déployer la Edge Function.",
        'vroom.backToCommunity': 'Retour à la communauté',
        'vroom.live': 'En direct',
        'vroom.leave': 'Quitter',
        'vroom.tokenError': 'Impossible d\'obtenir le jeton de salle',
        'vroom.connectionError': 'Erreur de connexion',
    },
    'pt': {
        'vroom.participants': 'participante(s)',
        'vroom.unmute': 'Ativar microfone',
        'vroom.mute': 'Silenciar microfone',
        'vroom.leaveRoom': 'Sair da sala',
        'vroom.hint': 'Toque no microfone para silenciar • Toque no telefone para sair',
        'vroom.connecting': 'Conectando à sala...',
        'vroom.notConfigured': 'Salas de voz ainda não configuradas',
        'vroom.configDesc': 'O administrador precisa configurar VITE_LIVEKIT_URL e implantar a Edge Function.',
        'vroom.backToCommunity': 'Voltar à comunidade',
        'vroom.live': 'Ao vivo',
        'vroom.leave': 'Sair',
        'vroom.tokenError': 'Falha ao obter token da sala',
        'vroom.connectionError': 'Erro de conexão',
    },
    'ru': {
        'vroom.participants': 'участник(ов)',
        'vroom.unmute': 'Включить микрофон',
        'vroom.mute': 'Отключить микрофон',
        'vroom.leaveRoom': 'Покинуть комнату',
        'vroom.hint': 'Нажмите микрофон для отключения • Нажмите телефон для выхода',
        'vroom.connecting': 'Подключение к комнате...',
        'vroom.notConfigured': 'Голосовые комнаты ещё не настроены',
        'vroom.configDesc': 'Администратор должен настроить VITE_LIVEKIT_URL и развернуть Edge Function.',
        'vroom.backToCommunity': 'Вернуться в сообщество',
        'vroom.live': 'В эфире',
        'vroom.leave': 'Выйти',
        'vroom.tokenError': 'Не удалось получить токен комнаты',
        'vroom.connectionError': 'Ошибка соединения',
    },
    'tr': {
        'vroom.participants': 'katılımcı',
        'vroom.unmute': 'Mikrofonu aç',
        'vroom.mute': 'Mikrofonu kapat',
        'vroom.leaveRoom': 'Odadan ayrıl',
        'vroom.hint': 'Mikrofona dokunarak sessize al • Telefona dokunarak ayrıl',
        'vroom.connecting': 'Odaya bağlanıyor...',
        'vroom.notConfigured': 'Sesli odalar henüz yapılandırılmadı',
        'vroom.configDesc': 'Yöneticinin VITE_LIVEKIT_URL yapılandırması ve Edge Function dağıtması gerekiyor.',
        'vroom.backToCommunity': 'Topluluğa dön',
        'vroom.live': 'Canlı',
        'vroom.leave': 'Ayrıl',
        'vroom.tokenError': 'Oda jetonu alınamadı',
        'vroom.connectionError': 'Bağlantı hatası',
    },
    'zh': {
        'vroom.participants': '位参与者',
        'vroom.unmute': '取消静音',
        'vroom.mute': '静音麦克风',
        'vroom.leaveRoom': '离开房间',
        'vroom.hint': '点击麦克风静音/取消 • 点击电话离开',
        'vroom.connecting': '正在连接房间...',
        'vroom.notConfigured': '语音房间尚未配置',
        'vroom.configDesc': '管理员需要配置VITE_LIVEKIT_URL并部署Edge Function。',
        'vroom.backToCommunity': '返回社区',
        'vroom.live': '直播',
        'vroom.leave': '离开',
        'vroom.tokenError': '获取房间令牌失败',
        'vroom.connectionError': '连接错误',
    },
}

anchor = '"svcReq.successToast":'

# First add to en.ts
with open('src/i18n/en.ts', encoding='utf-8') as f:
    content = f.read()
lines_to_add = []
for k, v in en_keys.items():
    if f'"{k}"' not in content:
        escaped = v.replace('"', '\\"')
        lines_to_add.append(f'  "{k}": "{escaped}",')
if lines_to_add:
    block = '\n' + '\n'.join(lines_to_add)
    idx = content.find(anchor)
    end = content.index('\n', idx) + 1
    content = content[:end] + block + '\n' + content[end:]
    with open('src/i18n/en.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  DONE en: +{len(lines_to_add)} keys')

# Then all other languages
for lang, keys in translations.items():
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
    if idx == -1:
        print(f'  ERROR {lang}: anchor not found')
        continue
    end = content.index('\n', idx) + 1
    content = content[:end] + block + '\n' + content[end:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  DONE {lang}: +{len(lines_to_add)} keys')

print('All done.')
