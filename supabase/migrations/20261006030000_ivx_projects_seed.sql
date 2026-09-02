-- IVX — the first projects, one per subject.
--
-- Every brief and every rubric criterion is written in Arabic and English, the
-- same jsonb-keyed-by-language-tag shape the rest of IVX uses. A third
-- language is a key, not a migration.
--
-- Two rules the briefs follow, and they are not style preferences:
--
--   * Nothing here requires sight. No "look at the chart", no "arrange the
--     shapes", no colour as the carrier of meaning. Where a brief would
--     otherwise need a picture, `accessible` says the same thing in words.
--   * The work is text. A student submits writing, working, or code as
--     characters — which is what a screen reader, a braille display and a
--     phone keyboard all handle, and what the grader can actually read.
--
-- Rubric weights total 100 in every row. Nothing enforces that in the schema
-- (a CHECK would block a half-written draft during authoring), so it is
-- checked by the test suite instead.

INSERT INTO public.ivx_projects
  (slug, subject_slug, title, brief, accessible, rubric, skills, level, est_minutes, xp_award, sort_order)
VALUES

-- ── Mathematics ─────────────────────────────────────────────────────────────
('math.shopping-budget', 'math',
 '{"en":"A month of shopping, on a budget","ar":"شهر من التسوّق بميزانية محدودة"}',
 '{"en":"You have 800 for a month of household shopping. Plan four weeks of spending. For each week list what you would buy and what it costs, then work out the weekly total and the running total. Finish by answering two questions in your own words: which week was tightest and why, and what you would change if the budget dropped by 15 percent. Show your arithmetic — the working matters as much as the answer.","ar":"لديك 800 لمشتريات المنزل لمدة شهر. خطّط إنفاق أربعة أسابيع. اكتب لكل أسبوع ما ستشتريه وكم يكلّف، ثم احسب مجموع الأسبوع والمجموع التراكمي. أنهِ بإجابة سؤالين بأسلوبك: أي أسبوع كان الأصعب ولماذا، وما الذي ستغيّره لو انخفضت الميزانية 15 بالمئة. أظهر خطوات حسابك — الطريقة لا تقل أهمية عن الناتج."}',
 '{"en":"Write everything as plain lines of text, for example: week one, rice 40, oil 25, week total 65. No table and no picture is needed.","ar":"اكتب كل شيء كأسطر نصية بسيطة، مثل: الأسبوع الأول، أرز 40، زيت 25، مجموع الأسبوع 65. لا حاجة إلى جدول أو صورة."}',
 '[{"id":"c1","weight":30,"criterion":{"en":"The arithmetic is correct and the running totals actually follow from the weekly ones.","ar":"العمليات الحسابية صحيحة والمجاميع التراكمية تنتج فعلاً من مجاميع الأسابيع."}},
   {"id":"c2","weight":25,"criterion":{"en":"The percentage reduction is applied correctly to the right number.","ar":"نسبة التخفيض مطبَّقة بشكل صحيح على الرقم الصحيح."}},
   {"id":"c3","weight":25,"criterion":{"en":"The plan is realistic: the four weeks cover a month of actual needs rather than filler.","ar":"الخطة واقعية: الأسابيع الأربعة تغطي احتياجات شهر حقيقي لا مجرد حشو."}},
   {"id":"c4","weight":20,"criterion":{"en":"The two written answers give reasons, not just a restatement of the numbers.","ar":"الإجابتان المكتوبتان تقدّمان أسباباً لا مجرد إعادة لذكر الأرقام."}}]',
 ARRAY['math.percentages','math.multiplication'], 3, 50, 70, 10),

-- ── Languages ───────────────────────────────────────────────────────────────
('lang.explain-to-a-child', 'languages',
 '{"en":"Explain something hard to a seven-year-old","ar":"اشرح شيئاً صعباً لطفل في السابعة"}',
 '{"en":"Pick something you understand well and a seven-year-old does not — why the sky is blue, how a loan works, what a virus is. Write two versions of the same explanation, about 150 words each: one for the child, one for an adult who has never studied it. Then write a short paragraph on what you changed between them and why. Judge yourself on whether the child version is genuinely simpler, not merely shorter.","ar":"اختر شيئاً تفهمه جيداً ولا يفهمه طفل في السابعة — لماذا السماء زرقاء، كيف يعمل القرض، ما هو الفيروس. اكتب نسختين من الشرح نفسه، نحو 150 كلمة لكل منهما: واحدة للطفل وواحدة لبالغ لم يدرس الموضوع. ثم اكتب فقرة قصيرة عمّا غيّرته بينهما ولماذا. قِس نفسك بما إذا كانت نسخة الطفل أبسط فعلاً لا أقصر فقط."}',
 '{}',
 '[{"id":"c1","weight":30,"criterion":{"en":"The child version uses everyday words and short sentences, and does not simply delete the hard parts.","ar":"نسخة الطفل تستخدم كلمات يومية وجملاً قصيرة، ولا تكتفي بحذف الأجزاء الصعبة."}},
   {"id":"c2","weight":25,"criterion":{"en":"The adult version is accurate and adds the detail the child version left out.","ar":"نسخة البالغ دقيقة وتضيف التفاصيل التي أسقطتها نسخة الطفل."}},
   {"id":"c3","weight":25,"criterion":{"en":"The reflection names specific choices — a word swapped, an analogy added — rather than generalities.","ar":"التأمل يذكر خيارات محددة — كلمة استُبدلت، تشبيه أُضيف — لا عموميات."}},
   {"id":"c4","weight":20,"criterion":{"en":"Both versions are grammatical and read naturally aloud.","ar":"النسختان سليمتان نحوياً وتُقرآن بطلاقة عند النطق."}}]',
 ARRAY['lang.en-vocabulary','lang.ar-grammar'], 3, 45, 60, 20),

-- ── Science ─────────────────────────────────────────────────────────────────
('sci.kitchen-experiment', 'science',
 '{"en":"An experiment you can run in a kitchen","ar":"تجربة يمكن إجراؤها في المطبخ"}',
 '{"en":"Design and run a small experiment using only what is in a kitchen — how fast sugar dissolves at different temperatures, whether a heavier object really falls faster, how long ice takes to melt in still air versus moving air. Write it up as: the question, what you expected and why, exactly what you did, what happened, and what you now think. Change one thing at a time and say what you kept the same. If it did not work, write that up honestly — a failed experiment described well scores better than a tidy one that was never run.","ar":"صمّم ونفّذ تجربة صغيرة بما يوجد في المطبخ فقط — كم يذوب السكر بسرعة عند درجات حرارة مختلفة، هل يسقط الجسم الأثقل أسرع فعلاً، كم يستغرق الثلج ليذوب في هواء ساكن مقابل هواء متحرك. اكتبها هكذا: السؤال، ما توقّعته ولماذا، ما فعلته بالضبط، ما حدث، وما ترى الآن. غيّر عاملاً واحداً فقط وقل ما الذي أبقيته ثابتاً. إذا لم تنجح فاكتب ذلك بصدق — تجربة فاشلة موصوفة جيداً تتفوق على تجربة مرتّبة لم تُجرَ أبداً."}',
 '{"en":"Describe measurements in words and numbers, for example: the ice took nine minutes in still air and five in front of a fan. No photograph or diagram is required.","ar":"صف القياسات بالكلمات والأرقام، مثل: استغرق الثلج تسع دقائق في الهواء الساكن وخمساً أمام مروحة. لا حاجة إلى صورة أو رسم."}',
 '[{"id":"c1","weight":30,"criterion":{"en":"One variable changes and the rest are held constant, and the write-up says which.","ar":"عامل واحد يتغيّر والباقي ثابت، والكتابة تحدد أيّها."}},
   {"id":"c2","weight":25,"criterion":{"en":"The prediction comes before the result and gives a reason.","ar":"التوقّع مذكور قبل النتيجة ومعه سبب."}},
   {"id":"c3","weight":25,"criterion":{"en":"The observations are specific — times, amounts, counts — not just \"it was faster\".","ar":"الملاحظات محددة — أوقات، كميات، أعداد — لا مجرد «كان أسرع»."}},
   {"id":"c4","weight":20,"criterion":{"en":"The conclusion follows from what was observed, including when it contradicts the prediction.","ar":"الاستنتاج ينبع مما لوحظ فعلاً، حتى حين يناقض التوقّع."}}]',
 ARRAY['sci.forces','sci.cells'], 4, 60, 80, 30),

-- ── Programming ─────────────────────────────────────────────────────────────
('prog.accessible-page', 'programming',
 '{"en":"A page that works without a mouse","ar":"صفحة تعمل بدون فأرة"}',
 '{"en":"Write the HTML for a single page about something you care about: a heading, two sections, a list, a link, and a form with two fields and a submit button. Every field must have a real label, the heading levels must go in order, and the page must be usable by pressing Tab alone. Then write a short paragraph explaining how somebody using a screen reader would move through it, in order. Paste the HTML as text.","ar":"اكتب شيفرة HTML لصفحة واحدة عن موضوع يهمّك: عنوان رئيسي، قسمان، قائمة، رابط، ونموذج فيه حقلان وزر إرسال. يجب أن يكون لكل حقل تسمية حقيقية، وأن تتسلسل مستويات العناوين بالترتيب، وأن تكون الصفحة قابلة للاستخدام بمفتاح Tab وحده. ثم اكتب فقرة قصيرة تشرح كيف سيتنقل فيها شخص يستخدم قارئ شاشة، بالترتيب. الصق الشيفرة كنص."}',
 '{"en":"Paste the code as plain text. Describe the structure in words as well, so the explanation stands on its own.","ar":"الصق الشيفرة كنص عادي. صف البنية بالكلمات أيضاً ليكون الشرح مفهوماً بذاته."}',
 '[{"id":"c1","weight":30,"criterion":{"en":"Every form field has a label that is actually associated with it, not placeholder text standing in for one.","ar":"لكل حقل في النموذج تسمية مرتبطة به فعلاً، لا نص عنصر نائب يحل محلها."}},
   {"id":"c2","weight":25,"criterion":{"en":"Headings are in order with no level skipped, and the landmarks make sense.","ar":"العناوين مرتبة دون تخطي مستوى، والمعالم منطقية."}},
   {"id":"c3","weight":25,"criterion":{"en":"The HTML is valid and would render — tags closed, attributes quoted.","ar":"الشيفرة سليمة وقابلة للعرض — الوسوم مغلقة والسمات بين علامتَي اقتباس."}},
   {"id":"c4","weight":20,"criterion":{"en":"The written walk-through matches the code that was submitted.","ar":"الشرح المكتوب يطابق الشيفرة المُسلَّمة."}}]',
 ARRAY['prog.web-html','prog.thinking'], 4, 60, 80, 40),

-- ── Artificial intelligence ─────────────────────────────────────────────────
('ai.spot-the-confident-mistake', 'ai',
 '{"en":"Catch an AI being confidently wrong","ar":"اضبط ذكاءً اصطناعياً مخطئاً بثقة"}',
 '{"en":"Ask any AI assistant three questions you already know the answer to — one factual, one about arithmetic, one about something local to where you live. Record what you asked and what it said. Mark each answer right, wrong, or partly right, and say how you know. Then write a paragraph on which kinds of question it handled worst, and what you would check before trusting it on something you could not verify yourself.","ar":"اسأل أي مساعد ذكاء اصطناعي ثلاثة أسئلة تعرف إجاباتها مسبقاً — واحد معلوماتي، وواحد حسابي، وواحد عن شيء محلي في مكان سكنك. سجّل ما سألت وما أجاب. صنّف كل إجابة صحيحة أو خاطئة أو صحيحة جزئياً، وقل كيف عرفت. ثم اكتب فقرة عن أنواع الأسئلة التي تعامل معها بأسوأ شكل، وما الذي ستتحقق منه قبل أن تثق به في أمر لا تستطيع التأكد منه بنفسك."}',
 '{}',
 '[{"id":"c1","weight":30,"criterion":{"en":"All three exchanges are recorded in enough detail that a reader could repeat them.","ar":"الحوارات الثلاثة مسجّلة بتفصيل يكفي ليعيدها قارئ آخر."}},
   {"id":"c2","weight":25,"criterion":{"en":"Each verdict is justified by a source or by first-hand knowledge, not by an impression.","ar":"كل حكم مبرَّر بمصدر أو بمعرفة مباشرة لا بانطباع."}},
   {"id":"c3","weight":25,"criterion":{"en":"The pattern identified is supported by the three examples given.","ar":"النمط المستنتج مدعوم بالأمثلة الثلاثة المذكورة."}},
   {"id":"c4","weight":20,"criterion":{"en":"The checking strategy is something the student could actually carry out.","ar":"استراتيجية التحقق قابلة للتنفيذ فعلاً من قِبل الطالب."}}]',
 ARRAY['ai.what-is-ai','ai.responsible'], 3, 45, 60, 50),

-- ── General knowledge ───────────────────────────────────────────────────────
('know.place-in-500-words', 'knowledge',
 '{"en":"A place, in 500 words","ar":"مكان، في 500 كلمة"}',
 '{"en":"Choose a country or a city you have never lived in. In about 500 words, cover where it is and what it borders, why people settled there, one thing about it that surprised you, and one thing commonly believed about it that turns out to be wrong. Name your sources. Describe location in words — which sea, which neighbours, how far from what — rather than by pointing at a map.","ar":"اختر بلداً أو مدينة لم تعش فيها. في نحو 500 كلمة، غطِّ أين تقع وما حدودها، ولماذا استقر الناس فيها، وأمراً واحداً فاجأك عنها، وأمراً شائعاً عنها تبيّن أنه غير صحيح. اذكر مصادرك. صف الموقع بالكلمات — أي بحر، أي جيران، كم تبعد عن ماذا — لا بالإشارة إلى خريطة."}',
 '{"en":"Location is described in words throughout, so nothing here depends on seeing a map.","ar":"الموقع موصوف بالكلمات في كل موضع، فلا شيء هنا يعتمد على رؤية خريطة."}',
 '[{"id":"c1","weight":30,"criterion":{"en":"The geography is accurate and described well enough to follow without a map.","ar":"الجغرافيا دقيقة وموصوفة بما يكفي لمتابعتها دون خريطة."}},
   {"id":"c2","weight":25,"criterion":{"en":"The correction of a common belief is genuine and evidenced.","ar":"تصحيح الاعتقاد الشائع حقيقي ومدعوم بدليل."}},
   {"id":"c3","weight":25,"criterion":{"en":"Sources are named and are the kind a reader could check.","ar":"المصادر مذكورة ومن النوع الذي يمكن لقارئ التحقق منه."}},
   {"id":"c4","weight":20,"criterion":{"en":"It is written as prose a person would want to read, not a list of facts.","ar":"مكتوب كنص يرغب المرء في قراءته لا كقائمة معلومات."}}]',
 ARRAY['know.geography'], 3, 60, 70, 60),

-- ── Life skills ─────────────────────────────────────────────────────────────
('life.the-message-you-almost-fell-for', 'life',
 '{"en":"The message you almost fell for","ar":"الرسالة التي كدت تصدّقها"}',
 '{"en":"Find a scam or phishing message — one you received, or a documented example. Write out its text. Then list every signal in it that gives it away, quoting the exact words each time: the urgency, the mismatched sender, the link that is not what it claims, the request that a real organisation would never make. Finish with what you would tell a relative who is about to reply to one, in four sentences they would actually remember.","ar":"ابحث عن رسالة احتيال أو تصيّد — رسالة وصلتك أو مثال موثّق. اكتب نصها. ثم اذكر كل إشارة فيها تفضحها، مقتبساً الكلمات بدقة في كل مرة: الاستعجال، المرسل غير المتطابق، الرابط الذي ليس كما يدّعي، الطلب الذي لا تقدّمه جهة حقيقية أبداً. أنهِ بما ستقوله لقريب يوشك أن يرد على واحدة منها، في أربع جمل يتذكرها فعلاً."}',
 '{}',
 '[{"id":"c1","weight":30,"criterion":{"en":"At least four distinct warning signs are identified, each tied to specific words in the message.","ar":"تحديد أربع إشارات تحذير مختلفة على الأقل، كل منها مرتبطة بكلمات محددة في الرسالة."}},
   {"id":"c2","weight":25,"criterion":{"en":"The explanation says why each signal is suspicious, not just that it is.","ar":"الشرح يبيّن لماذا كل إشارة مريبة، لا أنها مريبة فحسب."}},
   {"id":"c3","weight":25,"criterion":{"en":"The advice is concrete and actionable by somebody who is not technical.","ar":"النصيحة ملموسة وقابلة للتطبيق من شخص غير تقني."}},
   {"id":"c4","weight":20,"criterion":{"en":"No real personal data — names, numbers, account details — is reproduced in the write-up.","ar":"لا تُنسخ أي بيانات شخصية حقيقية — أسماء أو أرقام أو تفاصيل حسابات — في الكتابة."}}]',
 ARRAY['life.online-safety','life.money'], 3, 40, 60, 70),

-- ── Accessibility ───────────────────────────────────────────────────────────
('access.audit-a-page', 'access',
 '{"en":"Audit a page you use every week","ar":"دقّق صفحة تستخدمها كل أسبوع"}',
 '{"en":"Pick a website you use often. Try to complete one real task on it — buy something, book something, find an opening time — using only the keyboard, and then again with the screen reader you know best. Write down every place you got stuck, what you expected to happen, and what happened instead. For three of those problems, describe the fix you would ask for in one sentence each, the way you would say it to somebody who can change the page.","ar":"اختر موقعاً تستخدمه كثيراً. حاول إنجاز مهمة حقيقية فيه — شراء شيء، حجز موعد، معرفة وقت الافتتاح — باستخدام لوحة المفاتيح وحدها، ثم كرّرها بقارئ الشاشة الذي تتقنه. دوّن كل موضع تعثّرت فيه، وما توقّعت حدوثه، وما حدث فعلاً. ولثلاث من هذه المشكلات، صف الإصلاح الذي ستطلبه في جملة واحدة لكل منها، بالطريقة التي ستقولها لشخص يستطيع تعديل الصفحة."}',
 '{}',
 '[{"id":"c1","weight":30,"criterion":{"en":"A real task was attempted end to end, and the write-up follows it in order.","ar":"جرى تنفيذ مهمة حقيقية من أولها إلى آخرها، والكتابة تتبعها بالترتيب."}},
   {"id":"c2","weight":25,"criterion":{"en":"Each problem separates what was expected from what happened.","ar":"كل مشكلة تفصل بين ما كان متوقعاً وما حدث فعلاً."}},
   {"id":"c3","weight":25,"criterion":{"en":"The three fixes are specific enough for a developer to act on without asking a follow-up question.","ar":"الإصلاحات الثلاثة محددة بما يكفي ليتصرف مطوّر بناءً عليها دون سؤال إضافي."}},
   {"id":"c4","weight":20,"criterion":{"en":"Both the keyboard pass and the screen-reader pass are reported, including where they differed.","ar":"تقرير عن جولة لوحة المفاتيح وجولة قارئ الشاشة معاً، وأين اختلفتا."}}]',
 ARRAY['access.screen-readers'], 4, 75, 90, 80)

ON CONFLICT (slug) DO UPDATE SET
  subject_slug = EXCLUDED.subject_slug,
  title        = EXCLUDED.title,
  brief        = EXCLUDED.brief,
  accessible   = EXCLUDED.accessible,
  rubric       = EXCLUDED.rubric,
  skills       = EXCLUDED.skills,
  level        = EXCLUDED.level,
  est_minutes  = EXCLUDED.est_minutes,
  xp_award     = EXCLUDED.xp_award,
  sort_order   = EXCLUDED.sort_order;
