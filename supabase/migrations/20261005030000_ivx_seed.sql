-- IVX — the seed curriculum.
--
-- Representative rather than exhaustive, and deliberately so: the point of a
-- first content set is to prove the architecture carries every shape of
-- question and every subject family, not to be a syllabus. Adding the next
-- thousand questions is an insert, not a migration to this file.
--
-- Every prompt, explanation and hint is here in English and Arabic. Nothing in
-- the schema treats those two as special — a third language is another key.

INSERT INTO public.ivx_subjects (slug, title, description, icon, sort_order) VALUES
  ('math', '{"en":"Mathematics","ar":"الرياضيات"}',
   '{"en":"Numbers, arithmetic, fractions, algebra and beyond","ar":"الأعداد والحساب والكسور والجبر وما بعدها"}', '🔢', 10),
  ('languages', '{"en":"Languages","ar":"اللغات"}',
   '{"en":"Reading, vocabulary, grammar and conversation","ar":"القراءة والمفردات والقواعد والمحادثة"}', '🗣️', 20),
  ('science', '{"en":"Science","ar":"العلوم"}',
   '{"en":"Physics, chemistry, biology, earth and space","ar":"الفيزياء والكيمياء والأحياء والأرض والفضاء"}', '🔬', 30),
  ('programming', '{"en":"Programming","ar":"البرمجة"}',
   '{"en":"Computational thinking, Python, the web and data","ar":"التفكير الحاسوبي وبايثون والويب والبيانات"}', '💻', 40),
  ('ai', '{"en":"AI & Technology","ar":"الذكاء الاصطناعي والتقنية"}',
   '{"en":"How AI works, and how to use it responsibly","ar":"كيف يعمل الذكاء الاصطناعي وكيف يُستخدم بمسؤولية"}', '🤖', 50),
  ('knowledge', '{"en":"General Knowledge","ar":"الثقافة العامة"}',
   '{"en":"Geography, history, nature and discovery","ar":"الجغرافيا والتاريخ والطبيعة والاكتشاف"}', '🌍', 60),
  ('life', '{"en":"Life Skills","ar":"مهارات الحياة"}',
   '{"en":"Money, safety online, and thinking clearly","ar":"المال والأمان الرقمي والتفكير السليم"}', '🧭', 70),
  ('access', '{"en":"Accessibility","ar":"الإتاحة"}',
   '{"en":"Screen readers, assistive tools and inclusive design","ar":"قارئات الشاشة والأدوات المساعدة والتصميم الشامل"}', '♿', 80)
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order;

INSERT INTO public.ivx_skills (slug, subject_slug, title, objective, level, sort_order) VALUES
  ('math.multiplication', 'math', '{"en":"Multiplication","ar":"الضرب"}',
   '{"en":"Multiply single and double digit numbers confidently","ar":"ضرب الأعداد من رقم ورقمين بثقة"}', 2, 10),
  ('math.fractions-add', 'math', '{"en":"Adding fractions","ar":"جمع الكسور"}',
   '{"en":"Add fractions with the same and different denominators","ar":"جمع الكسور ذات المقامات المتساوية والمختلفة"}', 4, 20),
  ('math.percentages', 'math', '{"en":"Percentages","ar":"النسب المئوية"}',
   '{"en":"Find a percentage of a quantity and read one back","ar":"إيجاد نسبة من كمية وقراءتها"}', 4, 30),
  ('math.algebra-linear', 'math', '{"en":"Linear equations","ar":"المعادلات الخطية"}',
   '{"en":"Solve one-step and two-step equations for x","ar":"حل معادلات من خطوة وخطوتين لإيجاد س"}', 6, 40),

  ('lang.en-vocabulary', 'languages', '{"en":"English vocabulary","ar":"مفردات الإنجليزية"}',
   '{"en":"Understand and use common everyday words","ar":"فهم واستخدام الكلمات اليومية الشائعة"}', 2, 10),
  ('lang.ar-grammar', 'languages', '{"en":"Arabic grammar","ar":"قواعد العربية"}',
   '{"en":"Recognise the basic sentence structures of Arabic","ar":"التعرف على التراكيب الأساسية للجملة العربية"}', 3, 20),

  ('sci.cells', 'science', '{"en":"Cells","ar":"الخلايا"}',
   '{"en":"Name the parts of a cell and what each one does","ar":"تسمية أجزاء الخلية ووظيفة كل جزء"}', 3, 10),
  ('sci.forces', 'science', '{"en":"Forces and motion","ar":"القوى والحركة"}',
   '{"en":"Explain how forces change the motion of an object","ar":"تفسير كيف تغيّر القوى حركة الجسم"}', 4, 20),
  ('sci.solar-system', 'science', '{"en":"The solar system","ar":"المجموعة الشمسية"}',
   '{"en":"Order the planets and describe what makes each one different","ar":"ترتيب الكواكب ووصف ما يميز كل واحد"}', 2, 30),

  ('prog.thinking', 'programming', '{"en":"Computational thinking","ar":"التفكير الحاسوبي"}',
   '{"en":"Break a problem into ordered, repeatable steps","ar":"تفكيك المشكلة إلى خطوات مرتبة قابلة للتكرار"}', 1, 10),
  ('prog.python-basics', 'programming', '{"en":"Python basics","ar":"أساسيات بايثون"}',
   '{"en":"Read and predict simple Python: variables, types, output","ar":"قراءة وتوقع نتائج بايثون البسيطة: المتغيرات والأنواع والإخراج"}', 3, 20),
  ('prog.web-html', 'programming', '{"en":"HTML and structure","ar":"HTML والبنية"}',
   '{"en":"Use the right element for the right meaning","ar":"استخدام العنصر الصحيح للمعنى الصحيح"}', 3, 30),

  ('ai.what-is-ai', 'ai', '{"en":"What is AI?","ar":"ما هو الذكاء الاصطناعي؟"}',
   '{"en":"Tell apart rules, machine learning and generative AI","ar":"التمييز بين القواعد وتعلّم الآلة والذكاء التوليدي"}', 2, 10),
  ('ai.responsible', 'ai', '{"en":"Responsible AI","ar":"الذكاء الاصطناعي المسؤول"}',
   '{"en":"Recognise bias, hallucination and when not to trust a model","ar":"تمييز التحيز والهلوسة ومتى لا يُوثق بالنموذج"}', 4, 20),

  ('know.geography', 'knowledge', '{"en":"World geography","ar":"جغرافيا العالم"}',
   '{"en":"Place countries, capitals and continents","ar":"تحديد الدول والعواصم والقارات"}', 2, 10),

  ('life.money', 'life', '{"en":"Money and budgeting","ar":"المال والميزانية"}',
   '{"en":"Plan spending against income and save deliberately","ar":"تخطيط الإنفاق مقابل الدخل والادخار عن قصد"}', 3, 10),
  ('life.online-safety', 'life', '{"en":"Online safety","ar":"الأمان الرقمي"}',
   '{"en":"Spot a scam and protect an account","ar":"كشف الاحتيال وحماية الحساب"}', 2, 20),

  ('access.screen-readers', 'access', '{"en":"Screen readers","ar":"قارئات الشاشة"}',
   '{"en":"Know what a screen reader announces, and why markup decides it","ar":"معرفة ما تنطقه قارئة الشاشة ولماذا تحدده البنية"}', 2, 10)
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, objective = EXCLUDED.objective,
      level = EXCLUDED.level, sort_order = EXCLUDED.sort_order;

-- Prerequisites: what a skill genuinely needs first, not a linear syllabus.
INSERT INTO public.ivx_skill_prerequisites (skill_slug, requires_slug) VALUES
  ('math.fractions-add',  'math.multiplication'),
  ('math.percentages',    'math.fractions-add'),
  ('math.algebra-linear', 'math.multiplication'),
  ('prog.python-basics',  'prog.thinking'),
  ('ai.responsible',      'ai.what-is-ai')
ON CONFLICT DO NOTHING;

-- ── Questions ───────────────────────────────────────────────────────────────
--
-- `accessible` carries what a screen reader should hear when the prompt would
-- otherwise rely on something visual. It is filled wherever a sighted reader
-- would get more from the page than a listener would.

INSERT INTO public.ivx_questions (skill_slug, kind, prompt, options, answer, explanation, hint, accessible, difficulty) VALUES
  -- Multiplication
  ('math.multiplication', 'numeric',
   '{"en":"What is 7 × 8?","ar":"كم يساوي ٧ × ٨؟"}', '[]', '{"value":"56"}',
   '{"en":"7 × 8 = 56. Seven eights: 8, 16, 24, 32, 40, 48, 56.","ar":"٧ × ٨ = ٥٦. سبع ثمانيات: ٨، ١٦، ٢٤، ٣٢، ٤٠، ٤٨، ٥٦."}',
   '{"en":"Count up in eights, seven times.","ar":"عُدّ بالثمانيات سبع مرات."}', '{}', 2),
  ('math.multiplication', 'numeric',
   '{"en":"What is 12 × 12?","ar":"كم يساوي ١٢ × ١٢؟"}', '[]', '{"value":"144"}',
   '{"en":"12 × 12 = 144. Ten twelves is 120, plus two more twelves is 24.","ar":"١٢ × ١٢ = ١٤٤. عشر اثنتا عشرة = ١٢٠، وزائد اثنتي عشرة مرتين = ٢٤."}',
   '{"en":"Split it: 12 × 10, then 12 × 2.","ar":"جزّئها: ١٢ × ١٠ ثم ١٢ × ٢."}', '{}', 3),
  ('math.multiplication', 'multiple_choice',
   '{"en":"A box holds 6 rows of 9 pencils. How many pencils?","ar":"صندوق فيه ٦ صفوف من ٩ أقلام. كم قلماً؟"}',
   '[{"id":"a","label":{"en":"15","ar":"١٥"}},{"id":"b","label":{"en":"54","ar":"٥٤"}},{"id":"c","label":{"en":"45","ar":"٤٥"}},{"id":"d","label":{"en":"63","ar":"٦٣"}}]',
   '{"value":"b"}',
   '{"en":"Rows of equal size multiply: 6 × 9 = 54.","ar":"الصفوف المتساوية تُضرب: ٦ × ٩ = ٥٤."}',
   '{"en":"Equal groups mean multiply, not add.","ar":"المجموعات المتساوية تعني الضرب لا الجمع."}', '{}', 2),

  -- Adding fractions
  ('math.fractions-add', 'numeric',
   '{"en":"What is 1/2 + 1/4? Write it as a fraction.","ar":"كم يساوي ١/٢ + ١/٤؟ اكتبها ككسر."}', '[]',
   '{"value":"3/4","tolerance":0.001}',
   '{"en":"Make the denominators match: 1/2 is 2/4, so 2/4 + 1/4 = 3/4.","ar":"وحّد المقامات: ١/٢ تساوي ٢/٤، إذن ٢/٤ + ١/٤ = ٣/٤."}',
   '{"en":"Rewrite one half as quarters first.","ar":"أعد كتابة النصف بالأرباع أولاً."}',
   '{"en":"One half plus one quarter.","ar":"نصف زائد ربع."}', 3),
  ('math.fractions-add', 'numeric',
   '{"en":"What is 2/3 + 1/6?","ar":"كم يساوي ٢/٣ + ١/٦؟"}', '[]', '{"value":"5/6","tolerance":0.001}',
   '{"en":"2/3 is 4/6, and 4/6 + 1/6 = 5/6.","ar":"٢/٣ تساوي ٤/٦، و ٤/٦ + ١/٦ = ٥/٦."}',
   '{"en":"Six works as a common denominator.","ar":"الستة تصلح مقاماً مشتركاً."}',
   '{"en":"Two thirds plus one sixth.","ar":"ثلثان زائد سدس."}', 4),

  -- Percentages
  ('math.percentages', 'numeric',
   '{"en":"What is 20% of 150?","ar":"كم يساوي ٢٠٪ من ١٥٠؟"}', '[]', '{"value":"30"}',
   '{"en":"10% of 150 is 15, so 20% is 30.","ar":"١٠٪ من ١٥٠ = ١٥، إذن ٢٠٪ = ٣٠."}',
   '{"en":"Find 10% first, then double it.","ar":"أوجد ١٠٪ أولاً ثم ضاعفها."}', '{}', 3),
  ('math.percentages', 'multiple_choice',
   '{"en":"A 40 dinar jacket is reduced by 25%. What do you pay?","ar":"جاكيت بـ٤٠ ديناراً بخصم ٢٥٪. كم تدفع؟"}',
   '[{"id":"a","label":{"en":"10","ar":"١٠"}},{"id":"b","label":{"en":"15","ar":"١٥"}},{"id":"c","label":{"en":"30","ar":"٣٠"}},{"id":"d","label":{"en":"35","ar":"٣٥"}}]',
   '{"value":"c"}',
   '{"en":"25% of 40 is 10, and 40 − 10 = 30. The discount is what you save, not what you pay.","ar":"٢٥٪ من ٤٠ = ١٠، و٤٠ − ١٠ = ٣٠. الخصم هو ما توفره لا ما تدفعه."}',
   '{"en":"Work out the saving, then subtract it.","ar":"احسب التوفير ثم اطرحه."}', '{}', 4),

  -- Linear equations
  ('math.algebra-linear', 'numeric',
   '{"en":"Solve for x: 3x + 5 = 20","ar":"أوجد س: ٣س + ٥ = ٢٠"}', '[]', '{"value":"5"}',
   '{"en":"Subtract 5 from both sides to get 3x = 15, then divide by 3: x = 5.","ar":"اطرح ٥ من الطرفين فتصبح ٣س = ١٥، ثم اقسم على ٣: س = ٥."}',
   '{"en":"Undo the addition before the multiplication.","ar":"تخلّص من الجمع قبل الضرب."}',
   '{"en":"Three x plus five equals twenty.","ar":"ثلاثة س زائد خمسة يساوي عشرين."}', 4),

  -- English vocabulary
  ('lang.en-vocabulary', 'multiple_choice',
   '{"en":"Which word means the opposite of \"ancient\"?","ar":"أي كلمة تعني عكس \"ancient\" (قديم)؟"}',
   '[{"id":"a","label":{"en":"modern","ar":"modern — حديث"}},{"id":"b","label":{"en":"heavy","ar":"heavy — ثقيل"}},{"id":"c","label":{"en":"quiet","ar":"quiet — هادئ"}},{"id":"d","label":{"en":"distant","ar":"distant — بعيد"}}]',
   '{"value":"a"}',
   '{"en":"\"Ancient\" means very old, so its opposite is \"modern\".","ar":"\"Ancient\" تعني قديماً جداً، فعكسها \"modern\" أي حديث."}',
   '{"en":"Think about time, not size or sound.","ar":"فكّر في الزمن لا في الحجم أو الصوت."}', '{}', 2),
  ('lang.en-vocabulary', 'fill_blank',
   '{"en":"Complete the sentence: She was ___ tired to finish the book.","ar":"أكمل الجملة: She was ___ tired to finish the book."}',
   '[]', '{"value":"too"}',
   '{"en":"\"Too tired to\" means the tiredness prevented it. \"Very tired\" would not carry that meaning.","ar":"\"too tired to\" تعني أن التعب منعها. \"very tired\" لا تحمل هذا المعنى."}',
   '{"en":"The word shows the tiredness stopped her.","ar":"الكلمة تُظهر أن التعب منعها."}', '{}', 3),

  -- Arabic grammar
  ('lang.ar-grammar', 'multiple_choice',
   '{"en":"In the Arabic sentence «ذهب الولدُ إلى المدرسة», what is «الولدُ»?","ar":"في جملة «ذهب الولدُ إلى المدرسة»، ما إعراب «الولدُ»؟"}',
   '[{"id":"a","label":{"en":"Subject (فاعل)","ar":"فاعل"}},{"id":"b","label":{"en":"Object (مفعول به)","ar":"مفعول به"}},{"id":"c","label":{"en":"Adjective (نعت)","ar":"نعت"}},{"id":"d","label":{"en":"Adverb (ظرف)","ar":"ظرف"}}]',
   '{"value":"a"}',
   '{"en":"The one who performed the action is the فاعل, and it takes a damma — «الولدُ».","ar":"من قام بالفعل هو الفاعل، ويُرفع بالضمة — «الولدُ»."}',
   '{"en":"Ask who did the going.","ar":"اسأل: من الذي ذهب؟"}', '{}', 3),

  -- Cells
  ('sci.cells', 'multiple_choice',
   '{"en":"Which part of a plant cell captures light for photosynthesis?","ar":"أي جزء في الخلية النباتية يلتقط الضوء للبناء الضوئي؟"}',
   '[{"id":"a","label":{"en":"Nucleus","ar":"النواة"}},{"id":"b","label":{"en":"Chloroplast","ar":"البلاستيدة الخضراء"}},{"id":"c","label":{"en":"Cell wall","ar":"الجدار الخلوي"}},{"id":"d","label":{"en":"Vacuole","ar":"الفجوة"}}]',
   '{"value":"b"}',
   '{"en":"Chloroplasts hold chlorophyll, which absorbs light. The nucleus stores instructions; the wall gives shape.","ar":"البلاستيدات الخضراء تحتوي الكلوروفيل الذي يمتص الضوء. النواة تخزن التعليمات، والجدار يعطي الشكل."}',
   '{"en":"It is the part that makes leaves green.","ar":"هو الجزء الذي يجعل الأوراق خضراء."}', '{}', 3),
  ('sci.cells', 'true_false',
   '{"en":"True or false: animal cells have a cell wall.","ar":"صواب أم خطأ: الخلايا الحيوانية لها جدار خلوي."}',
   '[{"id":"true","label":{"en":"True","ar":"صواب"}},{"id":"false","label":{"en":"False","ar":"خطأ"}}]',
   '{"value":"false"}',
   '{"en":"Only plant cells, fungi and some bacteria have walls. Animal cells have a membrane and no wall.","ar":"الجدار موجود في النبات والفطريات وبعض البكتيريا فقط. الخلية الحيوانية لها غشاء بلا جدار."}',
   '{"en":"Think about why plants hold their shape and we do not.","ar":"فكّر لماذا يحافظ النبات على شكله ونحن لا."}', '{}', 2),

  -- Forces
  ('sci.forces', 'multiple_choice',
   '{"en":"A ball rolls slower and slower on grass. Which force is doing that?","ar":"كرة تتدحرج على العشب فتبطئ تدريجياً. أي قوة تفعل ذلك؟"}',
   '[{"id":"a","label":{"en":"Gravity","ar":"الجاذبية"}},{"id":"b","label":{"en":"Friction","ar":"الاحتكاك"}},{"id":"c","label":{"en":"Magnetism","ar":"المغناطيسية"}},{"id":"d","label":{"en":"Upthrust","ar":"قوة الطفو"}}]',
   '{"value":"b"}',
   '{"en":"Friction acts against motion where two surfaces meet. Gravity pulls down, not backwards.","ar":"الاحتكاك يعاكس الحركة عند التقاء سطحين. الجاذبية تسحب للأسفل لا للخلف."}',
   '{"en":"It is about the surface it is rolling on.","ar":"الأمر متعلق بالسطح الذي تتدحرج عليه."}', '{}', 3),

  -- Solar system
  ('sci.solar-system', 'multiple_choice',
   '{"en":"Which planet is closest to the Sun?","ar":"أي كوكب هو الأقرب إلى الشمس؟"}',
   '[{"id":"a","label":{"en":"Venus","ar":"الزهرة"}},{"id":"b","label":{"en":"Mercury","ar":"عطارد"}},{"id":"c","label":{"en":"Earth","ar":"الأرض"}},{"id":"d","label":{"en":"Mars","ar":"المريخ"}}]',
   '{"value":"b"}',
   '{"en":"Mercury is first, then Venus, Earth and Mars. Venus is hotter, but it is not closer.","ar":"عطارد أولاً ثم الزهرة والأرض والمريخ. الزهرة أشد حرارة لكنها ليست الأقرب."}',
   '{"en":"The hottest planet is not the closest one.","ar":"أشد الكواكب حرارة ليس أقربها."}', '{}', 1),

  -- Computational thinking
  ('prog.thinking', 'ordering',
   '{"en":"Put these steps in the right order to make tea.","ar":"رتّب هذه الخطوات لإعداد الشاي."}',
   '[{"id":"1","label":{"en":"Boil the water","ar":"اغلِ الماء"}},{"id":"2","label":{"en":"Put tea in the cup","ar":"ضع الشاي في الكوب"}},{"id":"3","label":{"en":"Pour the water in","ar":"اسكب الماء"}},{"id":"4","label":{"en":"Wait, then drink","ar":"انتظر ثم اشرب"}}]',
   '{"value":"1,2,3,4"}',
   '{"en":"An algorithm is ordered steps. Pouring before boiling gives you a cup of cold water.","ar":"الخوارزمية خطوات مرتبة. السكب قبل الغلي يعطيك كوب ماء بارد."}',
   '{"en":"Which step must happen before any other can work?","ar":"أي خطوة يجب أن تسبق البقية؟"}',
   '{"en":"Answer with the numbers in order, separated by commas, for example 1,2,3,4.","ar":"أجب بالأرقام مرتبة ومفصولة بفواصل، مثل 1,2,3,4."}', 2),

  -- Python
  ('prog.python-basics', 'text',
   '{"en":"What does this print?\n\nx = 5\ny = 3\nprint(x + y)","ar":"ماذا يطبع هذا؟\n\nx = 5\ny = 3\nprint(x + y)"}',
   '[]', '{"value":"8"}',
   '{"en":"x and y hold numbers, so + adds them and print shows 8.","ar":"x و y يحملان أعداداً، فـ + يجمعهما و print يعرض ٨."}',
   '{"en":"Both are numbers, not text.","ar":"كلاهما عدد لا نص."}',
   '{"en":"A three line program: x is assigned five, y is assigned three, then print of x plus y.","ar":"برنامج من ثلاثة أسطر: x يساوي خمسة، y يساوي ثلاثة، ثم طباعة x زائد y."}', 3),
  ('prog.python-basics', 'text',
   '{"en":"What does this print?\n\nprint(\"5\" + \"3\")","ar":"ماذا يطبع هذا؟\n\nprint(\"5\" + \"3\")"}',
   '[]', '{"value":"53"}',
   '{"en":"Quotes make them text, and adding text joins it. \"5\" + \"3\" is \"53\", not 8.","ar":"علامات الاقتباس تجعلهما نصاً، وجمع النصوص يلصقهما. \"5\" + \"3\" = \"53\" لا ٨."}',
   '{"en":"Look carefully at the quotation marks.","ar":"انظر بدقة إلى علامات الاقتباس."}',
   '{"en":"One line: print of the string five plus the string three, both in quotes.","ar":"سطر واحد: طباعة النص خمسة زائد النص ثلاثة، كلاهما بين علامتي اقتباس."}', 4),

  -- HTML
  ('prog.web-html', 'multiple_choice',
   '{"en":"Which element should hold the main heading of a page?","ar":"أي عنصر يجب أن يحمل العنوان الرئيسي للصفحة؟"}',
   '[{"id":"a","label":{"en":"<div class=\"title\">","ar":"<div class=\"title\">"}},{"id":"b","label":{"en":"<h1>","ar":"<h1>"}},{"id":"c","label":{"en":"<b>","ar":"<b>"}},{"id":"d","label":{"en":"<p class=\"big\">","ar":"<p class=\"big\">"}}]',
   '{"value":"b"}',
   '{"en":"A screen reader can jump between headings, but only real ones. A styled div looks like a heading and is announced as nothing.","ar":"قارئة الشاشة تنتقل بين العناوين الحقيقية فقط. الـdiv المنسّق يبدو عنواناً ولا يُنطق كذلك."}',
   '{"en":"Ask what a screen reader would announce.","ar":"اسأل: ماذا ستنطق قارئة الشاشة؟"}', '{}', 3),

  -- AI
  ('ai.what-is-ai', 'multiple_choice',
   '{"en":"Which of these is machine learning rather than a fixed rule?","ar":"أي مما يلي تعلّم آلة لا قاعدة ثابتة؟"}',
   '[{"id":"a","label":{"en":"A thermostat switching on below 18°","ar":"مِنظّم حرارة يعمل تحت ١٨°"}},{"id":"b","label":{"en":"A spam filter that improves from examples","ar":"مرشّح بريد مزعج يتحسن من الأمثلة"}},{"id":"c","label":{"en":"A calculator adding two numbers","ar":"آلة حاسبة تجمع رقمين"}},{"id":"d","label":{"en":"An alarm at a set time","ar":"منبّه في وقت محدد"}}]',
   '{"value":"b"}',
   '{"en":"Machine learning changes its behaviour from data it has seen. The others follow instructions somebody wrote once.","ar":"تعلّم الآلة يغيّر سلوكه من بيانات رآها. البقية تتبع تعليمات كتبها أحدهم مرة واحدة."}',
   '{"en":"Which one gets better without being rewritten?","ar":"أيها يتحسن دون إعادة كتابته؟"}', '{}', 3),
  ('ai.responsible', 'true_false',
   '{"en":"True or false: if an AI states a fact confidently, it is probably correct.","ar":"صواب أم خطأ: إذا ذكر الذكاء الاصطناعي معلومة بثقة فهي على الأرجح صحيحة."}',
   '[{"id":"true","label":{"en":"True","ar":"صواب"}},{"id":"false","label":{"en":"False","ar":"خطأ"}}]',
   '{"value":"false"}',
   '{"en":"Confidence is a writing style, not evidence. A model can state an invented fact in exactly the same tone as a true one, which is why anything that matters gets checked.","ar":"الثقة أسلوب كتابة لا دليل. النموذج قد يذكر معلومة مخترعة بنفس نبرة الصحيحة تماماً، ولذلك يُتحقق مما يهم."}',
   '{"en":"Think about how a wrong answer sounds.","ar":"فكّر كيف تبدو الإجابة الخاطئة."}', '{}', 3),

  -- Geography
  ('know.geography', 'multiple_choice',
   '{"en":"Which continent is Egypt mostly in?","ar":"في أي قارة تقع مصر في معظمها؟"}',
   '[{"id":"a","label":{"en":"Asia","ar":"آسيا"}},{"id":"b","label":{"en":"Africa","ar":"أفريقيا"}},{"id":"c","label":{"en":"Europe","ar":"أوروبا"}},{"id":"d","label":{"en":"Oceania","ar":"أوقيانوسيا"}}]',
   '{"value":"b"}',
   '{"en":"Egypt is in north-east Africa. The Sinai Peninsula sits in Asia, which makes Egypt transcontinental.","ar":"مصر في شمال شرق أفريقيا. شبه جزيرة سيناء في آسيا، ما يجعل مصر عابرة للقارات."}',
   '{"en":"The Nile runs through it.","ar":"يمر بها النيل."}', '{}', 1),

  -- Money
  ('life.money', 'numeric',
   '{"en":"You earn 800 a month and spend 650. How much can you save?","ar":"دخلك ٨٠٠ شهرياً وتنفق ٦٥٠. كم يمكنك أن تدّخر؟"}',
   '[]', '{"value":"150"}',
   '{"en":"800 − 650 = 150. Saving is what income is left after spending, decided on purpose rather than by accident.","ar":"٨٠٠ − ٦٥٠ = ١٥٠. الادخار هو ما يتبقى من الدخل بعد الإنفاق، بقرار لا بالصدفة."}',
   '{"en":"Subtract what leaves from what arrives.","ar":"اطرح ما يخرج مما يدخل."}', '{}', 2),

  -- Online safety
  ('life.online-safety', 'multiple_choice',
   '{"en":"A message says your account will close today unless you confirm your password on a link. What is it?","ar":"رسالة تقول إن حسابك سيُغلق اليوم ما لم تؤكد كلمة السر عبر رابط. ما هي؟"}',
   '[{"id":"a","label":{"en":"A normal security notice","ar":"إشعار أمان عادي"}},{"id":"b","label":{"en":"A phishing attempt","ar":"محاولة تصيّد"}},{"id":"c","label":{"en":"A software update","ar":"تحديث برمجي"}},{"id":"d","label":{"en":"A delivery notification","ar":"إشعار توصيل"}}]',
   '{"value":"b"}',
   '{"en":"Urgency plus a link plus a password request is phishing. A real service never needs your password sent to it, and never gives you one day.","ar":"الاستعجال مع رابط مع طلب كلمة السر هو تصيّد. الخدمة الحقيقية لا تطلب كلمة سرك أبداً ولا تمنحك يوماً واحداً."}',
   '{"en":"Which part is the pressure, and which is the ask?","ar":"أي جزء هو الضغط وأيها الطلب؟"}', '{}', 2),

  -- Screen readers
  ('access.screen-readers', 'multiple_choice',
   '{"en":"An image has no alt text. What does a screen reader usually announce?","ar":"صورة بلا نص بديل. ماذا تنطق قارئة الشاشة عادةً؟"}',
   '[{"id":"a","label":{"en":"Nothing at all","ar":"لا شيء إطلاقاً"}},{"id":"b","label":{"en":"The file name, or just \"image\"","ar":"اسم الملف أو كلمة \"صورة\" فقط"}},{"id":"c","label":{"en":"A description of the picture","ar":"وصفاً للصورة"}},{"id":"d","label":{"en":"The page title","ar":"عنوان الصفحة"}}]',
   '{"value":"b"}',
   '{"en":"With no alt text there is nothing to read, so the reader falls back to the file name — which is why \"IMG_4821.jpg\" is a common and useless announcement.","ar":"بلا نص بديل لا يوجد ما يُقرأ، فترجع القارئة إلى اسم الملف — ولهذا تسمع كثيراً \"IMG_4821.jpg\" وهي بلا فائدة."}',
   '{"en":"If there is no description, what is left to read?","ar":"إن لم يوجد وصف، فما الذي يبقى ليُقرأ؟"}', '{}', 2)
ON CONFLICT DO NOTHING;
