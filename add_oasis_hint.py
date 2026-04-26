import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

keys = {
    'ar': 'oasis.affirmations.hint',
    'de': 'oasis.affirmations.hint',
    'es': 'oasis.affirmations.hint',
    'fr': 'oasis.affirmations.hint',
    'pt': 'oasis.affirmations.hint',
    'ru': 'oasis.affirmations.hint',
    'tr': 'oasis.affirmations.hint',
    'zh': 'oasis.affirmations.hint',
}

translations = {
    'ar': '{idx} / {total} — اضغط استمع لتسمع الجملة بصوت عالٍ.',
    'de': '{idx} / {total} — Tippe auf Anhören, um es laut vorzulesen.',
    'es': '{idx} / {total} — toca Escuchar para oírlo en voz alta.',
    'fr': '{idx} / {total} — appuyez sur Écouter pour l\'entendre à haute voix.',
    'pt': '{idx} / {total} — toque em Ouvir para ouvi-lo em voz alta.',
    'ru': '{idx} / {total} — нажмите Слушать, чтобы услышать вслух.',
    'tr': '{idx} / {total} — dinlemek için Dinle\'ye dokunun.',
    'zh': '{idx} / {total} — 点击"收听"以朗读。',
}

anchor = '"oasis.affirmations.speaking":'

for lang, val in translations.items():
    path = f'src/i18n/{lang}.ts'
    with open(path, encoding='utf-8') as f:
        content = f.read()
    key = 'oasis.affirmations.hint'
    if f'"{key}"' in content:
        print(f'  SKIP {lang}')
        continue
    escaped = val.replace('"', '\\"')
    new_line = f'\n  "{key}": "{escaped}",'
    idx = content.find(anchor)
    end = content.index('\n', idx) + 1
    content = content[:end] + new_line + '\n' + content[end:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  DONE {lang}')

print('All done.')
