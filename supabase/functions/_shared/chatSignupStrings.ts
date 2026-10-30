// The words of the chat sign-up, in all twenty languages.
//
// Kept apart from `whatsappStrings.ts` because WhatsApp and Messenger both use
// them and only one of the two is a WhatsApp module. Same rules as there: every
// sentence a sender can read exists in every supported language, and none of
// them says whether an email address already has an account.
//
// Placeholders: `{url}` the sign-up page, `{terms}` the terms page. The `here`
// phrase is what the sender types to register inside the chat; the parser in
// `chatSignup.ts` accepts exactly the phrase the offer printed, so the words
// the offer teaches always work.
//
// Pure data. No Deno, no fetch, no database.

import { type SupportedLanguage } from "./whatsappLanguages.ts";

export type SignupKey =
  | "offer"
  | "askName"
  | "askEmail"
  | "codeSent"
  | "created"
  | "linked"
  | "nameInvalid"
  | "cancelled";

type Pack = Record<SignupKey, string> & { here: string };

export const SIGNUP_STRINGS: Record<SupportedLanguage, Pack> = {
  en: {
    here: "register here",
    offer: "You don't have a Visionex account yet. To sign up I need a name and an email address, then I email you a six-digit code. Two ways: on the website: {url} — or right here in this chat: send «register here».",
    askName: "Great. What name should the account use? (Send 0 to cancel.)",
    askEmail: "Now send the email address for the account. I'll email it a six-digit code. No password is needed here.",
    codeSent: "A six-digit code is on its way to that address. Send it to me here — it's good for ten minutes. Sending the code means you accept the terms: {terms}. Send 0 to cancel.",
    created: "Done — your Visionex account is created, and this chat is linked and verified. To log in on the website, use «Forgot password» with the same email and choose a password.",
    linked: "That email already belongs to a Visionex account, so I linked this chat to it instead of creating a new one.",
    nameInvalid: "Please send just your name: 2 to 80 characters, with no link or email address.",
    cancelled: "Sign-up cancelled. Nothing was created.",
  },
  ar: {
    here: "سجل هنا",
    offer: "ليس لديك حساب في Visionex بعد. للتسجيل أحتاج اسمك وبريدك الإلكتروني، ثم أرسل لك رمزاً من ست خانات. لديك طريقتان: عبر الموقع: {url} — أو هنا في هذه المحادثة: أرسل «سجل هنا».",
    askName: "ممتاز. ما الاسم الذي تريده للحساب؟ (أرسل 0 للإلغاء.)",
    askEmail: "أرسل الآن البريد الإلكتروني للحساب. سأرسل إليه رمزاً من ست خانات. لا تحتاج كلمة مرور هنا.",
    codeSent: "الرمز في طريقه إلى ذلك البريد. أرسله لي هنا — صالح لعشر دقائق. بإرسال الرمز توافق على الشروط: {terms}. أرسل 0 للإلغاء.",
    created: "تم — أُنشئ حسابك في Visionex وارتبطت هذه المحادثة به وتم توثيقه. لتدخل إلى الموقع استخدم «نسيت كلمة المرور» بالبريد نفسه واختر كلمة مرور.",
    linked: "هذا البريد لديه حساب في Visionex أصلاً، فربطت هذه المحادثة به بدل إنشاء حساب جديد.",
    nameInvalid: "أرسل اسمك فقط: من حرفين إلى 80 حرفاً، بلا روابط ولا بريد إلكتروني.",
    cancelled: "أُلغي التسجيل. لم يُنشأ شيء.",
  },
  ur: {
    here: "یہاں رجسٹر",
    offer: "آپ کا ابھی Visionex اکاؤنٹ نہیں ہے۔ سائن اپ کے لیے مجھے نام اور ای میل چاہیے، پھر میں چھ ہندسوں کا کوڈ بھیجوں گا۔ دو طریقے: ویب سائٹ پر: {url} — یا یہیں اس چیٹ میں: «یہاں رجسٹر» لکھیں۔",
    askName: "ٹھیک ہے۔ اکاؤنٹ کے لیے کون سا نام رکھوں؟ (منسوخ کرنے کے لیے 0 بھیجیں۔)",
    askEmail: "اب اکاؤنٹ کا ای میل پتہ بھیجیں۔ میں اس پر چھ ہندسوں کا کوڈ بھیجوں گا۔ یہاں پاس ورڈ کی ضرورت نہیں۔",
    codeSent: "چھ ہندسوں کا کوڈ اس پتے پر روانہ ہو چکا ہے۔ یہیں مجھے بھیج دیں — دس منٹ تک کارآمد ہے۔ کوڈ بھیجنے کا مطلب ہے آپ شرائط مانتے ہیں: {terms}۔ منسوخی کے لیے 0 بھیجیں۔",
    created: "ہو گیا — آپ کا Visionex اکاؤنٹ بن گیا اور یہ چیٹ اس سے جڑ کر تصدیق شدہ ہو گئی۔ ویب سائٹ پر لاگ اِن کے لیے اسی ای میل سے «پاس ورڈ بھول گئے» استعمال کر کے پاس ورڈ چنیں۔",
    linked: "اس ای میل پر پہلے سے Visionex اکاؤنٹ ہے، اس لیے نیا بنانے کے بجائے میں نے یہ چیٹ اسی سے جوڑ دی۔",
    nameInvalid: "صرف اپنا نام بھیجیں: 2 سے 80 حروف، بغیر لنک یا ای میل کے۔",
    cancelled: "سائن اپ منسوخ۔ کچھ نہیں بنایا گیا۔",
  },
  hi: {
    here: "यहाँ रजिस्टर",
    offer: "आपका अभी Visionex खाता नहीं है। साइन अप के लिए मुझे नाम और ईमेल चाहिए, फिर मैं छह अंकों का कोड भेजूँगा। दो तरीके: वेबसाइट पर: {url} — या यहीं इस चैट में: «यहाँ रजिस्टर» भेजें।",
    askName: "ठीक है। खाते के लिए कौन-सा नाम रखूँ? (रद्द करने के लिए 0 भेजें।)",
    askEmail: "अब खाते का ईमेल पता भेजें। मैं उस पर छह अंकों का कोड भेजूँगा। यहाँ पासवर्ड की ज़रूरत नहीं।",
    codeSent: "छह अंकों का कोड उस पते पर भेजा जा चुका है। उसे यहीं मुझे भेजें — दस मिनट तक मान्य। कोड भेजने का मतलब है आप शर्तें मानते हैं: {terms}। रद्द करने के लिए 0 भेजें।",
    created: "हो गया — आपका Visionex खाता बन गया और यह चैट उससे जुड़कर सत्यापित हो गई। वेबसाइट पर लॉग इन के लिए उसी ईमेल से «पासवर्ड भूल गए» चुनकर पासवर्ड बनाएँ।",
    linked: "इस ईमेल पर पहले से Visionex खाता है, इसलिए नया बनाने के बजाय मैंने यह चैट उसी से जोड़ दी।",
    nameInvalid: "सिर्फ़ अपना नाम भेजें: 2 से 80 अक्षर, बिना लिंक या ईमेल के।",
    cancelled: "साइन अप रद्द। कुछ नहीं बना।",
  },
  id: {
    here: "daftar di sini",
    offer: "Anda belum punya akun Visionex. Untuk mendaftar saya butuh nama dan alamat email, lalu saya kirim kode enam angka. Dua cara: lewat situs: {url} — atau langsung di chat ini: kirim «daftar di sini».",
    askName: "Baik. Nama apa yang dipakai untuk akun? (Kirim 0 untuk batal.)",
    askEmail: "Sekarang kirim alamat email untuk akun. Saya kirim kode enam angka ke sana. Tidak perlu kata sandi di sini.",
    codeSent: "Kode enam angka sedang menuju alamat itu. Kirimkan kodenya di sini — berlaku sepuluh menit. Mengirim kode berarti Anda menyetujui ketentuan: {terms}. Kirim 0 untuk batal.",
    created: "Selesai — akun Visionex Anda dibuat, dan chat ini tertaut serta terverifikasi. Untuk masuk di situs, pakai «Lupa kata sandi» dengan email yang sama lalu pilih kata sandi.",
    linked: "Email itu sudah punya akun Visionex, jadi chat ini saya tautkan ke akun tersebut, bukan membuat akun baru.",
    nameInvalid: "Kirim namanya saja: 2 sampai 80 karakter, tanpa tautan atau alamat email.",
    cancelled: "Pendaftaran dibatalkan. Tidak ada yang dibuat.",
  },
  ja: {
    here: "ここで登録",
    offer: "Visionex のアカウントがまだありません。登録には名前とメールアドレスが必要で、6桁のコードをお送りします。方法は2つ：サイトで {url} ／ このチャットで「ここで登録」と送信。",
    askName: "了解です。アカウントに使う名前を送ってください。（0 で中止）",
    askEmail: "次に、アカウント用のメールアドレスを送ってください。6桁のコードをお送りします。ここではパスワードは不要です。",
    codeSent: "6桁のコードをそのアドレスに送りました。ここに送り返してください。10分間有効です。コードを送ると利用規約に同意したことになります：{terms}。0 で中止。",
    created: "完了です。Visionex アカウントを作成し、このチャットを紐づけて認証しました。サイトにログインするには、同じメールで「パスワードを忘れた」からパスワードを設定してください。",
    linked: "そのメールには既に Visionex アカウントがあるため、新規作成せずにこのチャットを紐づけました。",
    nameInvalid: "名前だけを送ってください。2〜80文字、リンクやメールアドレスは不可です。",
    cancelled: "登録を中止しました。何も作成されていません。",
  },
  it: {
    here: "registrati qui",
    offer: "Non hai ancora un account Visionex. Per iscriverti mi servono un nome e un indirizzo email, poi ti mando un codice di sei cifre. Due modi: sul sito: {url} — oppure qui nella chat: scrivi «registrati qui».",
    askName: "Perfetto. Che nome usare per l'account? (Scrivi 0 per annullare.)",
    askEmail: "Ora mandami l'indirizzo email dell'account. Ti invio un codice di sei cifre. Qui non serve nessuna password.",
    codeSent: "Un codice di sei cifre sta arrivando a quell'indirizzo. Mandamelo qui — vale dieci minuti. Inviando il codice accetti i termini: {terms}. Scrivi 0 per annullare.",
    created: "Fatto — il tuo account Visionex è creato e questa chat è collegata e verificata. Per accedere al sito usa «Password dimenticata» con la stessa email e scegli una password.",
    linked: "Quell'email ha già un account Visionex, quindi ho collegato questa chat a quello invece di crearne uno nuovo.",
    nameInvalid: "Mandami solo il tuo nome: da 2 a 80 caratteri, senza link o indirizzi email.",
    cancelled: "Registrazione annullata. Non è stato creato nulla.",
  },
  ko: {
    here: "여기서 가입",
    offer: "아직 Visionex 계정이 없으시네요. 가입에는 이름과 이메일이 필요하고, 6자리 코드를 보내 드립니다. 방법은 두 가지: 웹사이트 {url} — 또는 이 채팅에서 «여기서 가입»을 보내세요.",
    askName: "좋아요. 계정에 사용할 이름을 보내 주세요. (취소는 0)",
    askEmail: "이제 계정에 쓸 이메일 주소를 보내 주세요. 6자리 코드를 보내 드립니다. 여기서는 비밀번호가 필요 없습니다.",
    codeSent: "6자리 코드가 그 주소로 가고 있습니다. 여기로 보내 주세요. 10분간 유효합니다. 코드를 보내면 약관에 동의한 것으로 봅니다: {terms}. 취소는 0.",
    created: "완료 — Visionex 계정이 만들어졌고 이 채팅이 연결·인증되었습니다. 웹사이트에 로그인하려면 같은 이메일로 «비밀번호 찾기»를 눌러 비밀번호를 정하세요.",
    linked: "그 이메일에는 이미 Visionex 계정이 있어서 새로 만들지 않고 이 채팅을 그 계정에 연결했습니다.",
    nameInvalid: "이름만 보내 주세요. 2~80자, 링크나 이메일 주소는 안 됩니다.",
    cancelled: "가입이 취소되었습니다. 아무것도 만들어지지 않았습니다.",
  },
  nl: {
    here: "hier registreren",
    offer: "Je hebt nog geen Visionex-account. Om je aan te melden heb ik een naam en e-mailadres nodig, en dan mail ik een code van zes cijfers. Twee manieren: op de website: {url} — of hier in de chat: stuur «hier registreren».",
    askName: "Prima. Welke naam moet het account krijgen? (Stuur 0 om te annuleren.)",
    askEmail: "Stuur nu het e-mailadres voor het account. Ik mail er een code van zes cijfers naartoe. Hier is geen wachtwoord nodig.",
    codeSent: "Een code van zes cijfers is onderweg naar dat adres. Stuur hem hier naar me — tien minuten geldig. Door de code te sturen ga je akkoord met de voorwaarden: {terms}. Stuur 0 om te annuleren.",
    created: "Klaar — je Visionex-account is gemaakt en deze chat is gekoppeld en geverifieerd. Om op de website in te loggen, gebruik je «Wachtwoord vergeten» met hetzelfde e-mailadres en kies je een wachtwoord.",
    linked: "Dat e-mailadres heeft al een Visionex-account, dus ik heb deze chat daaraan gekoppeld in plaats van een nieuw account te maken.",
    nameInvalid: "Stuur alleen je naam: 2 tot 80 tekens, zonder link of e-mailadres.",
    cancelled: "Aanmelden geannuleerd. Er is niets aangemaakt.",
  },
  pl: {
    here: "zarejestruj tutaj",
    offer: "Nie masz jeszcze konta Visionex. Do rejestracji potrzebuję imienia i adresu e-mail, a potem wyślę sześciocyfrowy kod. Dwie drogi: na stronie: {url} — albo tutaj w czacie: wyślij «zarejestruj tutaj».",
    askName: "Dobrze. Jakiej nazwy użyć dla konta? (Wyślij 0, aby anulować.)",
    askEmail: "Teraz wyślij adres e-mail konta. Wyślę na niego sześciocyfrowy kod. Hasło nie jest tu potrzebne.",
    codeSent: "Sześciocyfrowy kod jest w drodze na ten adres. Wyślij mi go tutaj — ważny dziesięć minut. Wysłanie kodu oznacza akceptację regulaminu: {terms}. Wyślij 0, aby anulować.",
    created: "Gotowe — konto Visionex zostało utworzone, a ten czat jest połączony i zweryfikowany. Aby zalogować się na stronie, użyj «Zapomniałem hasła» z tym samym e-mailem i ustaw hasło.",
    linked: "Ten e-mail ma już konto Visionex, więc połączyłem z nim ten czat zamiast tworzyć nowe konto.",
    nameInvalid: "Wyślij samo imię: od 2 do 80 znaków, bez linków i adresów e-mail.",
    cancelled: "Rejestracja anulowana. Nic nie utworzono.",
  },
  vi: {
    here: "đăng ký tại đây",
    offer: "Bạn chưa có tài khoản Visionex. Để đăng ký tôi cần tên và địa chỉ email, rồi tôi gửi mã sáu chữ số. Có hai cách: trên website: {url} — hoặc ngay trong cuộc trò chuyện này: gửi «đăng ký tại đây».",
    askName: "Được rồi. Tài khoản dùng tên gì? (Gửi 0 để hủy.)",
    askEmail: "Giờ hãy gửi địa chỉ email của tài khoản. Tôi sẽ gửi mã sáu chữ số tới đó. Không cần mật khẩu ở đây.",
    codeSent: "Mã sáu chữ số đang trên đường tới địa chỉ đó. Gửi mã cho tôi tại đây — có hiệu lực mười phút. Gửi mã nghĩa là bạn chấp nhận điều khoản: {terms}. Gửi 0 để hủy.",
    created: "Xong — tài khoản Visionex đã được tạo, cuộc trò chuyện này đã được liên kết và xác minh. Để đăng nhập website, dùng «Quên mật khẩu» với cùng email rồi chọn mật khẩu.",
    linked: "Email đó đã có tài khoản Visionex, nên tôi liên kết cuộc trò chuyện này với nó thay vì tạo tài khoản mới.",
    nameInvalid: "Chỉ gửi tên của bạn: 2 đến 80 ký tự, không có liên kết hay địa chỉ email.",
    cancelled: "Đã hủy đăng ký. Không có gì được tạo.",
  },
  bn: {
    here: "এখানে নিবন্ধন",
    offer: "আপনার এখনও Visionex অ্যাকাউন্ট নেই। নিবন্ধনের জন্য নাম ও ইমেইল লাগবে, তারপর ছয় অঙ্কের কোড পাঠাব। দুই উপায়: ওয়েবসাইটে: {url} — অথবা এই চ্যাটেই: «এখানে নিবন্ধন» পাঠান।",
    askName: "ঠিক আছে। অ্যাকাউন্টের জন্য কোন নাম দেব? (বাতিল করতে 0 পাঠান।)",
    askEmail: "এবার অ্যাকাউন্টের ইমেইল ঠিকানা পাঠান। সেখানে ছয় অঙ্কের কোড পাঠাব। এখানে পাসওয়ার্ড লাগবে না।",
    codeSent: "ছয় অঙ্কের কোড ওই ঠিকানায় রওনা হয়েছে। কোডটি এখানেই পাঠান — দশ মিনিট বৈধ। কোড পাঠালে আপনি শর্তাবলি মেনে নিলেন: {terms}। বাতিল করতে 0 পাঠান।",
    created: "হয়ে গেছে — আপনার Visionex অ্যাকাউন্ট তৈরি হয়েছে এবং এই চ্যাট যুক্ত ও যাচাই হয়েছে। ওয়েবসাইটে লগ ইন করতে একই ইমেইলে «পাসওয়ার্ড ভুলে গেছেন» ব্যবহার করে পাসওয়ার্ড বেছে নিন।",
    linked: "ওই ইমেইলে আগে থেকেই Visionex অ্যাকাউন্ট আছে, তাই নতুন না বানিয়ে এই চ্যাট সেটির সঙ্গে যুক্ত করলাম।",
    nameInvalid: "শুধু আপনার নাম পাঠান: ২ থেকে ৮০ অক্ষর, কোনো লিংক বা ইমেইল ছাড়া।",
    cancelled: "নিবন্ধন বাতিল। কিছু তৈরি হয়নি।",
  },
  fa: {
    here: "اینجا ثبت نام",
    offer: "هنوز حساب Visionex ندارید. برای ثبت‌نام نام و ایمیل لازم است، بعد کدی شش‌رقمی می‌فرستم. دو راه: در وب‌سایت: {url} — یا همین‌جا در این گفتگو: «اینجا ثبت نام» را بفرستید.",
    askName: "خوب. حساب با چه نامی ساخته شود؟ (برای لغو 0 بفرستید.)",
    askEmail: "حالا نشانی ایمیل حساب را بفرستید. کدی شش‌رقمی به آن می‌فرستم. اینجا رمز عبور لازم نیست.",
    codeSent: "کد شش‌رقمی به آن نشانی در راه است. همین‌جا برایم بفرستیدش — ده دقیقه اعتبار دارد. فرستادن کد یعنی پذیرفتن شرایط: {terms}. برای لغو 0 بفرستید.",
    created: "انجام شد — حساب Visionex شما ساخته شد و این گفتگو به آن متصل و تأیید شد. برای ورود به وب‌سایت با همان ایمیل «فراموشی رمز عبور» را بزنید و رمز انتخاب کنید.",
    linked: "این ایمیل از قبل حساب Visionex دارد، پس به‌جای ساخت حساب تازه این گفتگو را به همان متصل کردم.",
    nameInvalid: "فقط نام خود را بفرستید: ۲ تا ۸۰ نویسه، بدون پیوند یا نشانی ایمیل.",
    cancelled: "ثبت‌نام لغو شد. چیزی ساخته نشد.",
  },
  es: {
    here: "registrarme aquí",
    offer: "Aún no tienes una cuenta de Visionex. Para registrarte necesito un nombre y un correo, y te envío un código de seis dígitos. Dos formas: en el sitio web: {url} — o aquí mismo en el chat: envía «registrarme aquí».",
    askName: "Perfecto. ¿Qué nombre uso para la cuenta? (Envía 0 para cancelar.)",
    askEmail: "Ahora envíame el correo de la cuenta. Le mandaré un código de seis dígitos. Aquí no hace falta contraseña.",
    codeSent: "Un código de seis dígitos va camino de esa dirección. Envíamelo aquí — vale diez minutos. Al enviar el código aceptas los términos: {terms}. Envía 0 para cancelar.",
    created: "Listo — tu cuenta de Visionex está creada y este chat queda vinculado y verificado. Para entrar en el sitio usa «Olvidé mi contraseña» con el mismo correo y elige una contraseña.",
    linked: "Ese correo ya tiene una cuenta de Visionex, así que vinculé este chat a ella en lugar de crear otra.",
    nameInvalid: "Envía solo tu nombre: de 2 a 80 caracteres, sin enlaces ni correos.",
    cancelled: "Registro cancelado. No se creó nada.",
  },
  de: {
    here: "hier registrieren",
    offer: "Du hast noch kein Visionex-Konto. Zum Registrieren brauche ich einen Namen und eine E-Mail-Adresse, dann schicke ich dir einen sechsstelligen Code. Zwei Wege: auf der Website: {url} — oder direkt hier im Chat: sende «hier registrieren».",
    askName: "Gut. Welchen Namen soll das Konto tragen? (Sende 0 zum Abbrechen.)",
    askEmail: "Sende mir jetzt die E-Mail-Adresse für das Konto. Ich schicke einen sechsstelligen Code dorthin. Ein Passwort brauchst du hier nicht.",
    codeSent: "Ein sechsstelliger Code ist auf dem Weg zu dieser Adresse. Sende ihn mir hier — er gilt zehn Minuten. Mit dem Senden des Codes akzeptierst du die Bedingungen: {terms}. Sende 0 zum Abbrechen.",
    created: "Fertig — dein Visionex-Konto ist erstellt, und dieser Chat ist verknüpft und verifiziert. Zum Anmelden auf der Website nutze «Passwort vergessen» mit derselben E-Mail und wähle ein Passwort.",
    linked: "Diese E-Mail hat schon ein Visionex-Konto, daher habe ich diesen Chat damit verknüpft, statt ein neues anzulegen.",
    nameInvalid: "Sende nur deinen Namen: 2 bis 80 Zeichen, ohne Link oder E-Mail-Adresse.",
    cancelled: "Registrierung abgebrochen. Es wurde nichts erstellt.",
  },
  pt: {
    here: "registar aqui",
    offer: "Ainda não tens conta Visionex. Para te registares preciso de um nome e de um e-mail, e envio-te um código de seis dígitos. Duas formas: no site: {url} — ou aqui mesmo no chat: envia «registar aqui».",
    askName: "Ótimo. Que nome uso na conta? (Envia 0 para cancelar.)",
    askEmail: "Agora envia o e-mail da conta. Mando-lhe um código de seis dígitos. Aqui não é preciso palavra-passe.",
    codeSent: "Um código de seis dígitos vai a caminho desse endereço. Envia-mo aqui — vale dez minutos. Ao enviar o código aceitas os termos: {terms}. Envia 0 para cancelar.",
    created: "Pronto — a tua conta Visionex foi criada e este chat ficou associado e verificado. Para entrar no site usa «Esqueci a palavra-passe» com o mesmo e-mail e escolhe uma palavra-passe.",
    linked: "Esse e-mail já tem conta Visionex, por isso associei este chat a ela em vez de criar outra.",
    nameInvalid: "Envia só o teu nome: 2 a 80 caracteres, sem links nem e-mails.",
    cancelled: "Registo cancelado. Nada foi criado.",
  },
  zh: {
    here: "在这里注册",
    offer: "你还没有 Visionex 账户。注册需要姓名和邮箱，我会发给你一个六位验证码。两种方式：在网站 {url} 注册，或直接在这个聊天里发送「在这里注册」。",
    askName: "好的。账户使用什么名字？（发送 0 取消。）",
    askEmail: "现在发送账户的邮箱地址，我会往那里发六位验证码。这里不需要密码。",
    codeSent: "六位验证码正发往该邮箱。请在这里发给我，十分钟内有效。发送验证码即表示你接受条款：{terms}。发送 0 取消。",
    created: "完成——你的 Visionex 账户已创建，这个聊天已关联并通过验证。要登录网站，请用同一邮箱点「忘记密码」并设置密码。",
    linked: "该邮箱已有 Visionex 账户，所以我把这个聊天关联到了它，而不是新建账户。",
    nameInvalid: "请只发送你的名字：2 到 80 个字符，不含链接或邮箱。",
    cancelled: "注册已取消，未创建任何内容。",
  },
  tr: {
    here: "burada kaydol",
    offer: "Henüz bir Visionex hesabın yok. Kayıt için bir ada ve e-postaya ihtiyacım var, sonra sana altı haneli bir kod gönderirim. İki yol: web sitesinde: {url} — ya da doğrudan bu sohbette: «burada kaydol» yaz.",
    askName: "Tamam. Hesap hangi adı kullansın? (İptal için 0 yaz.)",
    askEmail: "Şimdi hesabın e-posta adresini gönder. Oraya altı haneli bir kod göndereceğim. Burada parola gerekmez.",
    codeSent: "Altı haneli kod o adrese doğru yolda. Bana buradan gönder — on dakika geçerli. Kodu göndermek şartları kabul etmek demektir: {terms}. İptal için 0 yaz.",
    created: "Tamam — Visionex hesabın oluşturuldu, bu sohbet bağlandı ve doğrulandı. Web sitesine girmek için aynı e-postayla «Şifremi unuttum» seçip bir parola belirle.",
    linked: "Bu e-postanın zaten bir Visionex hesabı var, bu yüzden yenisini açmak yerine bu sohbeti ona bağladım.",
    nameInvalid: "Sadece adını gönder: 2 ile 80 karakter, bağlantı veya e-posta olmadan.",
    cancelled: "Kayıt iptal edildi. Hiçbir şey oluşturulmadı.",
  },
  fr: {
    here: "inscription ici",
    offer: "Vous n'avez pas encore de compte Visionex. Pour vous inscrire il me faut un nom et une adresse e-mail, puis je vous envoie un code à six chiffres. Deux façons : sur le site : {url} — ou ici dans le chat : envoyez «inscription ici».",
    askName: "Très bien. Quel nom pour le compte ? (Envoyez 0 pour annuler.)",
    askEmail: "Envoyez maintenant l'adresse e-mail du compte. Je lui enverrai un code à six chiffres. Aucun mot de passe n'est nécessaire ici.",
    codeSent: "Un code à six chiffres est en route vers cette adresse. Envoyez-le-moi ici — valable dix minutes. En envoyant le code vous acceptez les conditions : {terms}. Envoyez 0 pour annuler.",
    created: "C'est fait — votre compte Visionex est créé et ce chat est lié et vérifié. Pour vous connecter sur le site, utilisez «Mot de passe oublié» avec le même e-mail et choisissez un mot de passe.",
    linked: "Cette adresse a déjà un compte Visionex, j'ai donc lié ce chat à celui-ci au lieu d'en créer un nouveau.",
    nameInvalid: "Envoyez seulement votre nom : 2 à 80 caractères, sans lien ni adresse e-mail.",
    cancelled: "Inscription annulée. Rien n'a été créé.",
  },
  ru: {
    here: "зарегистрироваться здесь",
    offer: "У вас ещё нет аккаунта Visionex. Для регистрации нужны имя и e-mail, затем я пришлю шестизначный код. Два способа: на сайте: {url} — или прямо в этом чате: отправьте «зарегистрироваться здесь».",
    askName: "Хорошо. Какое имя указать в аккаунте? (Отправьте 0 для отмены.)",
    askEmail: "Теперь отправьте e-mail для аккаунта. Я пришлю на него шестизначный код. Пароль здесь не нужен.",
    codeSent: "Шестизначный код уже летит на этот адрес. Отправьте его мне сюда — действует десять минут. Отправляя код, вы принимаете условия: {terms}. Отправьте 0 для отмены.",
    created: "Готово — аккаунт Visionex создан, а этот чат привязан и подтверждён. Чтобы войти на сайт, нажмите «Забыли пароль» с тем же e-mail и задайте пароль.",
    linked: "У этого e-mail уже есть аккаунт Visionex, поэтому я привязал к нему этот чат вместо создания нового.",
    nameInvalid: "Отправьте только имя: от 2 до 80 символов, без ссылок и e-mail.",
    cancelled: "Регистрация отменена. Ничего не создано.",
  },
};

export function signupSay(key: SignupKey, language: string): string {
  const pack = (SIGNUP_STRINGS as Record<string, Pack>)[language] ?? SIGNUP_STRINGS.en;
  return pack[key];
}
