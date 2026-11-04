-- VisionKids Academy — 9 more courses.
--
-- The Academy had one course and four lessons. This adds nine courses (36 lessons, 72 exercises, 54 exam
-- questions) across biology, science, geography, digital safety, coding, finance, English, Arabic and
-- maths. Every id is derived from the course slug, so the file is safe to run twice.
-- The Arabic course is written in Arabic; the others are English, like the course already there.

-- ── Animals Around Us ──
INSERT INTO public.kids_courses (id, slug, title, subtitle, description, subject_id, age_range, difficulty, xp_reward, coins_reward, status, published_at)
SELECT 'eb46053f-2883-446f-8c7f-81cc0ad152b3'::uuid, 'animals-around-us', 'Animals Around Us', 'Meet mammals, birds, fish and insects', 'Learn how scientists group animals, what each group looks like, where they live and what they eat.', s.id, '6-8', 'easy', 100, 50, 'published', now()
FROM public.kids_subjects s WHERE s.slug = 'biology'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.kids_units (id, course_id, title, description, order_index) SELECT '1441dc9e-a9e8-4d3e-88d6-281fe31f2743'::uuid, 'eb46053f-2883-446f-8c7f-81cc0ad152b3'::uuid, 'Animal Groups', 'Meet mammals, birds, fish and insects', 1
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = 'eb46053f-2883-446f-8c7f-81cc0ad152b3'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '0e278df3-bc42-45f6-8c3d-9f518aac5d22'::uuid, '1441dc9e-a9e8-4d3e-88d6-281fe31f2743'::uuid, 'eb46053f-2883-446f-8c7f-81cc0ad152b3'::uuid, 'mammals', 'Mammals', 'Animals with fur or hair that feed their babies milk.', 'Mammals are animals that have fur or hair and feed their babies with milk. Cats, dogs, elephants, bats and even whales and dolphins are mammals. Most mammals are born alive instead of hatching from eggs. Mammals are warm-blooded, which means their bodies stay warm even when the weather is cold. Humans are mammals too!', 1, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '1441dc9e-a9e8-4d3e-88d6-281fe31f2743'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'df34173d-d236-402c-83e3-73220a3af743'::uuid, '0e278df3-bc42-45f6-8c3d-9f518aac5d22'::uuid, 'multiple_choice', 'Which of these is a mammal?', '{"options":["Shark","Dolphin","Frog","Eagle"],"correctAnswer":"Dolphin"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '0e278df3-bc42-45f6-8c3d-9f518aac5d22'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'ea786bac-ebfb-4ea5-8215-c43304452b36'::uuid, '0e278df3-bc42-45f6-8c3d-9f518aac5d22'::uuid, 'multiple_choice', 'What do baby mammals drink?', '{"options":["Water only","Juice","Milk","Soup"],"correctAnswer":"Milk"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '0e278df3-bc42-45f6-8c3d-9f518aac5d22'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '48a99f7a-46ca-4d04-8960-6cd73d0b4873'::uuid, '1441dc9e-a9e8-4d3e-88d6-281fe31f2743'::uuid, 'eb46053f-2883-446f-8c7f-81cc0ad152b3'::uuid, 'birds', 'Birds', 'Feathers, wings and eggs.', 'Birds are the only animals with feathers. All birds have two legs, a beak and wings, and all birds lay eggs. Many birds can fly, but penguins swim and ostriches run very fast. Birds build nests to keep their eggs warm. Some birds sing beautiful songs to talk to each other.', 2, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '1441dc9e-a9e8-4d3e-88d6-281fe31f2743'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'f32e917d-b62d-4f6d-8187-e712b5ea8737'::uuid, '48a99f7a-46ca-4d04-8960-6cd73d0b4873'::uuid, 'multiple_choice', 'What do all birds have?', '{"options":["Fur","Feathers","Scales","Fins"],"correctAnswer":"Feathers"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '48a99f7a-46ca-4d04-8960-6cd73d0b4873'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '6ca30cf6-fdeb-4228-826e-acb2303a40c9'::uuid, '48a99f7a-46ca-4d04-8960-6cd73d0b4873'::uuid, 'multiple_choice', 'Which bird cannot fly but swims well?', '{"options":["Eagle","Sparrow","Penguin","Parrot"],"correctAnswer":"Penguin"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '48a99f7a-46ca-4d04-8960-6cd73d0b4873'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '664bfeb5-d980-43bb-8a48-46fad76a6f44'::uuid, '1441dc9e-a9e8-4d3e-88d6-281fe31f2743'::uuid, 'eb46053f-2883-446f-8c7f-81cc0ad152b3'::uuid, 'fish-and-sea-life', 'Fish and Sea Life', 'Gills, fins and life under water.', 'Fish live in water and breathe through gills, which take oxygen out of the water. Fish use fins to swim and most are covered in scales. Some fish live in rivers and lakes, and others live in the salty sea. Not every sea animal is a fish: whales are mammals, and octopuses have no bones at all!', 3, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '1441dc9e-a9e8-4d3e-88d6-281fe31f2743'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '6a208e2f-9d4a-4bbb-8348-5b64d5bbc5c4'::uuid, '664bfeb5-d980-43bb-8a48-46fad76a6f44'::uuid, 'multiple_choice', 'How do fish breathe?', '{"options":["With lungs","With gills","With a nose","With wings"],"correctAnswer":"With gills"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '664bfeb5-d980-43bb-8a48-46fad76a6f44'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '88a10fb2-6f03-49a7-837f-816206276fc6'::uuid, '664bfeb5-d980-43bb-8a48-46fad76a6f44'::uuid, 'matching', 'Match the animal to where it lives.', '{"pairs":[{"left":"Camel","right":"Desert"},{"left":"Fish","right":"Water"},{"left":"Monkey","right":"Trees"}]}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '664bfeb5-d980-43bb-8a48-46fad76a6f44'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT 'f8ec0caa-286f-4f15-8f45-2706f25c3f3e'::uuid, '1441dc9e-a9e8-4d3e-88d6-281fe31f2743'::uuid, 'eb46053f-2883-446f-8c7f-81cc0ad152b3'::uuid, 'insects', 'Insects', 'Six legs and three body parts.', 'Insects are small animals with six legs and three body parts: a head, a chest and a belly. Many insects have wings and antennae to feel and smell. Bees, ants, butterflies and beetles are all insects. Bees help flowers grow by carrying pollen from one flower to another. Spiders are not insects because they have eight legs.', 4, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '1441dc9e-a9e8-4d3e-88d6-281fe31f2743'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '59d3fa3d-50db-4636-86c4-46b98f5ff453'::uuid, 'f8ec0caa-286f-4f15-8f45-2706f25c3f3e'::uuid, 'typing', 'How many legs does an insect have? Type the number.', '{"correctAnswer":"6"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'f8ec0caa-286f-4f15-8f45-2706f25c3f3e'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'd28dad16-89fe-4088-8a4d-e62ad2298dd9'::uuid, 'f8ec0caa-286f-4f15-8f45-2706f25c3f3e'::uuid, 'multiple_choice', 'Which of these is NOT an insect?', '{"options":["Bee","Ant","Spider","Butterfly"],"correctAnswer":"Spider"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'f8ec0caa-286f-4f15-8f45-2706f25c3f3e'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quizzes (id, title, course_id) SELECT '5a46162d-ae76-4f2c-87bb-b575418bc72a'::uuid, 'Animals Around Us — Final Exam', 'eb46053f-2883-446f-8c7f-81cc0ad152b3'::uuid
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = 'eb46053f-2883-446f-8c7f-81cc0ad152b3'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '1a63641c-3c78-44f4-8407-275f05d9add1'::uuid, '5a46162d-ae76-4f2c-87bb-b575418bc72a'::uuid, 'multiple_choice', 'Which animal group feeds babies milk?', '["Mammals","Birds","Fish","Insects"]'::jsonb, 'Mammals', 'Mammals feed their babies milk.', 1, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '5a46162d-ae76-4f2c-87bb-b575418bc72a'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '9de094c9-b63f-49cb-8468-115d6b71324e'::uuid, '5a46162d-ae76-4f2c-87bb-b575418bc72a'::uuid, 'true_false', 'All birds can fly.', '["True","False"]'::jsonb, 'False', 'Penguins and ostriches are birds that cannot fly.', 2, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '5a46162d-ae76-4f2c-87bb-b575418bc72a'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '6e252f4d-8295-4591-8f19-bea55f5a6ee1'::uuid, '5a46162d-ae76-4f2c-87bb-b575418bc72a'::uuid, 'multiple_choice', 'What helps fish breathe under water?', '["Gills","Feathers","Fur","Antennae"]'::jsonb, 'Gills', 'Gills take oxygen from the water.', 3, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '5a46162d-ae76-4f2c-87bb-b575418bc72a'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'df610c02-9481-4e5c-85f5-87959d501d46'::uuid, '5a46162d-ae76-4f2c-87bb-b575418bc72a'::uuid, 'true_false', 'A whale is a fish.', '["True","False"]'::jsonb, 'False', 'A whale is a mammal that lives in the sea.', 4, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '5a46162d-ae76-4f2c-87bb-b575418bc72a'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '93d1c997-862f-4327-8c19-71c67cd4a866'::uuid, '5a46162d-ae76-4f2c-87bb-b575418bc72a'::uuid, 'multiple_choice', 'How many body parts does an insect have?', '["2","3","4","8"]'::jsonb, '3', 'Head, chest and belly.', 5, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '5a46162d-ae76-4f2c-87bb-b575418bc72a'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '8a3f004e-042c-40ed-87d2-d3be1f45b3cf'::uuid, '5a46162d-ae76-4f2c-87bb-b575418bc72a'::uuid, 'multiple_choice', 'What do bees carry from flower to flower?', '["Pollen","Sand","Water","Leaves"]'::jsonb, 'Pollen', 'Pollen helps flowers make seeds.', 6, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '5a46162d-ae76-4f2c-87bb-b575418bc72a'::uuid) ON CONFLICT (id) DO NOTHING;

-- ── Our Solar System Adventure ──
INSERT INTO public.kids_courses (id, slug, title, subtitle, description, subject_id, age_range, difficulty, xp_reward, coins_reward, status, published_at)
SELECT '74b1b78f-804b-43df-86d3-425efcd0b8ec'::uuid, 'solar-system-adventure', 'Our Solar System Adventure', 'Travel from the Sun to the planets', 'Explore the Sun, the eight planets, Earth and the Moon, and how we explore space.', s.id, '9-12', 'medium', 100, 50, 'published', now()
FROM public.kids_subjects s WHERE s.slug = 'science'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.kids_units (id, course_id, title, description, order_index) SELECT 'd41ea52a-bc54-4b66-89c5-3cf2173a1286'::uuid, '74b1b78f-804b-43df-86d3-425efcd0b8ec'::uuid, 'Space Neighbourhood', 'Travel from the Sun to the planets', 1
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = '74b1b78f-804b-43df-86d3-425efcd0b8ec'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '10781609-eafc-4841-8357-0cc4422117af'::uuid, 'd41ea52a-bc54-4b66-89c5-3cf2173a1286'::uuid, '74b1b78f-804b-43df-86d3-425efcd0b8ec'::uuid, 'the-sun-and-the-planets', 'The Sun and the Planets', 'A star and eight planets.', 'The Sun is a star at the centre of our solar system. Eight planets travel around it. In order from the Sun they are Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune. The four planets closest to the Sun are small and rocky. The four far away are giants made mostly of gas or ice. A way to remember the order: My Very Eager Mother Just Served Us Noodles.', 1, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = 'd41ea52a-bc54-4b66-89c5-3cf2173a1286'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '0d9404a1-7730-4c5d-864f-6700e57c2ada'::uuid, '10781609-eafc-4841-8357-0cc4422117af'::uuid, 'multiple_choice', 'Which planet is closest to the Sun?', '{"options":["Venus","Mercury","Earth","Mars"],"correctAnswer":"Mercury"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '10781609-eafc-4841-8357-0cc4422117af'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '291fb676-a16a-4fa4-844e-9044c41ccd04'::uuid, '10781609-eafc-4841-8357-0cc4422117af'::uuid, 'typing', 'How many planets are in our solar system? Type the number.', '{"correctAnswer":"8"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '10781609-eafc-4841-8357-0cc4422117af'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '25de84f1-97fe-46f5-8439-b09247b0cc12'::uuid, 'd41ea52a-bc54-4b66-89c5-3cf2173a1286'::uuid, '74b1b78f-804b-43df-86d3-425efcd0b8ec'::uuid, 'earth-and-the-moon', 'Earth and the Moon', 'Our home planet and its natural satellite.', 'Earth is the third planet from the Sun and the only planet we know that has life. It has air to breathe and liquid water. The Moon travels around Earth about once every 27 days. The Moon makes no light of its own; it shines because it reflects sunlight. The Moon''s pull on the ocean causes the tides.', 2, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = 'd41ea52a-bc54-4b66-89c5-3cf2173a1286'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '2c7acd21-a8f6-49dc-86a7-9a1bfc256bcb'::uuid, '25de84f1-97fe-46f5-8439-b09247b0cc12'::uuid, 'multiple_choice', 'Why does the Moon shine?', '{"options":["It makes its own light","It reflects sunlight","It is on fire","It has lamps"],"correctAnswer":"It reflects sunlight"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '25de84f1-97fe-46f5-8439-b09247b0cc12'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '972dfe9f-d0e1-491f-8c7d-f710bce01568'::uuid, '25de84f1-97fe-46f5-8439-b09247b0cc12'::uuid, 'multiple_choice', 'Which planet is our home?', '{"options":["Mars","Earth","Jupiter","Venus"],"correctAnswer":"Earth"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '25de84f1-97fe-46f5-8439-b09247b0cc12'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT 'd4209a07-7fd0-4825-8789-980462df5315'::uuid, 'd41ea52a-bc54-4b66-89c5-3cf2173a1286'::uuid, '74b1b78f-804b-43df-86d3-425efcd0b8ec'::uuid, 'day-night-and-seasons', 'Day, Night and Seasons', 'Why we have day and night and four seasons.', 'Earth spins like a top. It takes 24 hours to turn all the way around. This spin gives us day and night: the side facing the Sun has day, and the side facing away has night. Earth also travels around the Sun once a year. Because Earth is tilted, different parts get more or less sunlight during the year. This gives us summer, autumn, winter and spring.', 3, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = 'd41ea52a-bc54-4b66-89c5-3cf2173a1286'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '68fa1176-3ca6-47ea-8d3d-984704f615a7'::uuid, 'd4209a07-7fd0-4825-8789-980462df5315'::uuid, 'multiple_choice', 'How long does Earth take to spin once?', '{"options":["1 hour","12 hours","24 hours","7 days"],"correctAnswer":"24 hours"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'd4209a07-7fd0-4825-8789-980462df5315'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '8f01861d-28ee-4276-8ad3-ef863666340a'::uuid, 'd4209a07-7fd0-4825-8789-980462df5315'::uuid, 'multiple_choice', 'What causes day and night?', '{"options":["Earth spinning","The Moon moving","Clouds","The wind"],"correctAnswer":"Earth spinning"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'd4209a07-7fd0-4825-8789-980462df5315'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT 'e19143a5-559c-41ea-873d-eda81f545826'::uuid, 'd41ea52a-bc54-4b66-89c5-3cf2173a1286'::uuid, '74b1b78f-804b-43df-86d3-425efcd0b8ec'::uuid, 'stars-and-space-exploration', 'Stars and Space Exploration', 'Rockets, astronauts and telescopes.', 'Stars are huge balls of hot gas. The Sun is the closest star to Earth. At night we can see other stars, but they are very far away. Rockets carry astronauts and satellites into space. In 1969 people first walked on the Moon. Today, telescopes and robots such as rovers on Mars help us learn about space.', 4, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = 'd41ea52a-bc54-4b66-89c5-3cf2173a1286'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'd5b45b6a-bf5e-49ce-82a1-37f4e53d6c6e'::uuid, 'e19143a5-559c-41ea-873d-eda81f545826'::uuid, 'multiple_choice', 'What is the closest star to Earth?', '{"options":["Polaris","The Moon","The Sun","Mars"],"correctAnswer":"The Sun"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'e19143a5-559c-41ea-873d-eda81f545826'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'f81efa3f-a370-493d-83f1-bc1a5505ab96'::uuid, 'e19143a5-559c-41ea-873d-eda81f545826'::uuid, 'multiple_choice', 'What do rockets carry into space?', '{"options":["Astronauts and satellites","Trees","Cars","Houses"],"correctAnswer":"Astronauts and satellites"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'e19143a5-559c-41ea-873d-eda81f545826'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quizzes (id, title, course_id) SELECT '32a3c2ea-602a-4f25-8b63-6394d5d5a350'::uuid, 'Our Solar System Adventure — Final Exam', '74b1b78f-804b-43df-86d3-425efcd0b8ec'::uuid
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = '74b1b78f-804b-43df-86d3-425efcd0b8ec'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'b7bde920-25b3-409e-83f0-0d45fee080d6'::uuid, '32a3c2ea-602a-4f25-8b63-6394d5d5a350'::uuid, 'multiple_choice', 'Which is the largest planet?', '["Earth","Jupiter","Mars","Venus"]'::jsonb, 'Jupiter', 'Jupiter is the largest planet.', 1, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '32a3c2ea-602a-4f25-8b63-6394d5d5a350'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '9ffb25d7-6470-40c5-8ee7-41ee7aecebdb'::uuid, '32a3c2ea-602a-4f25-8b63-6394d5d5a350'::uuid, 'true_false', 'The Sun is a planet.', '["True","False"]'::jsonb, 'False', 'The Sun is a star.', 2, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '32a3c2ea-602a-4f25-8b63-6394d5d5a350'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'fdf92a9c-af8c-417c-856e-cbf575060058'::uuid, '32a3c2ea-602a-4f25-8b63-6394d5d5a350'::uuid, 'multiple_choice', 'Which planet has beautiful rings?', '["Saturn","Mercury","Earth","Mars"]'::jsonb, 'Saturn', 'Saturn''s rings are the most famous.', 3, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '32a3c2ea-602a-4f25-8b63-6394d5d5a350'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '8d23179f-4551-4139-8f5f-edc874934d0a'::uuid, '32a3c2ea-602a-4f25-8b63-6394d5d5a350'::uuid, 'multiple_choice', 'What causes the seasons?', '["Earth''s tilt and orbit","The Moon","Wind","Clouds"]'::jsonb, 'Earth''s tilt and orbit', 'The tilt changes how much sunlight each part gets.', 4, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '32a3c2ea-602a-4f25-8b63-6394d5d5a350'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '90410ab5-1552-4db4-88c6-b35cde120046'::uuid, '32a3c2ea-602a-4f25-8b63-6394d5d5a350'::uuid, 'true_false', 'The Moon makes its own light.', '["True","False"]'::jsonb, 'False', 'It reflects sunlight.', 5, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '32a3c2ea-602a-4f25-8b63-6394d5d5a350'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '4600fb39-ddbd-4105-8287-cd04bb6516e1'::uuid, '32a3c2ea-602a-4f25-8b63-6394d5d5a350'::uuid, 'multiple_choice', 'Which planet is called the Red Planet?', '["Mars","Venus","Neptune","Saturn"]'::jsonb, 'Mars', 'Iron dust makes Mars look red.', 6, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '32a3c2ea-602a-4f25-8b63-6394d5d5a350'::uuid) ON CONFLICT (id) DO NOTHING;

-- ── Continents and Oceans ──
INSERT INTO public.kids_courses (id, slug, title, subtitle, description, subject_id, age_range, difficulty, xp_reward, coins_reward, status, published_at)
SELECT '19dceffc-c88d-4179-866a-3da8e29de550'::uuid, 'continents-and-oceans', 'Continents and Oceans', 'A tour of our planet', 'Discover the seven continents, the five oceans, and amazing landforms like mountains, rivers and deserts.', s.id, '9-12', 'easy', 100, 50, 'published', now()
FROM public.kids_subjects s WHERE s.slug = 'geography'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.kids_units (id, course_id, title, description, order_index) SELECT 'b1ffd768-6581-429d-8483-f5cfc49391fd'::uuid, '19dceffc-c88d-4179-866a-3da8e29de550'::uuid, 'Our Planet', 'A tour of our planet', 1
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = '19dceffc-c88d-4179-866a-3da8e29de550'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT 'f33e2236-4c31-415f-8bb2-51f5e6587dca'::uuid, 'b1ffd768-6581-429d-8483-f5cfc49391fd'::uuid, '19dceffc-c88d-4179-866a-3da8e29de550'::uuid, 'the-seven-continents', 'The Seven Continents', 'Asia, Africa, North and South America, Antarctica, Europe and Oceania.', 'Earth has seven continents: Asia, Africa, North America, South America, Antarctica, Europe and Oceania. Asia is the biggest and has the most people. Africa is the second largest. Antarctica is the coldest and is covered in ice; nobody lives there all year, only scientists visit. Oceania includes Australia and many islands.', 1, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = 'b1ffd768-6581-429d-8483-f5cfc49391fd'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '1ec39687-a178-4e5c-85f3-48232085a3c3'::uuid, 'f33e2236-4c31-415f-8bb2-51f5e6587dca'::uuid, 'multiple_choice', 'Which is the biggest continent?', '{"options":["Africa","Asia","Europe","Oceania"],"correctAnswer":"Asia"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'f33e2236-4c31-415f-8bb2-51f5e6587dca'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'e0311b4f-8104-4b8a-863c-3de161475a30'::uuid, 'f33e2236-4c31-415f-8bb2-51f5e6587dca'::uuid, 'typing', 'How many continents are there? Type the number.', '{"correctAnswer":"7"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'f33e2236-4c31-415f-8bb2-51f5e6587dca'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '1eb093b7-8adb-4b90-8bef-006ca9b73ab1'::uuid, 'b1ffd768-6581-429d-8483-f5cfc49391fd'::uuid, '19dceffc-c88d-4179-866a-3da8e29de550'::uuid, 'the-five-oceans', 'The Five Oceans', 'Pacific, Atlantic, Indian, Southern and Arctic.', 'Oceans cover most of our planet. The five oceans are the Pacific, Atlantic, Indian, Southern and Arctic. The Pacific is the largest and deepest. The Arctic is the smallest and is very cold. Oceans give us fish, rain, and a home for millions of animals. We must keep them clean.', 2, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = 'b1ffd768-6581-429d-8483-f5cfc49391fd'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '4cefa7d9-0404-4104-81ff-603ae40f3b3b'::uuid, '1eb093b7-8adb-4b90-8bef-006ca9b73ab1'::uuid, 'multiple_choice', 'Which is the largest ocean?', '{"options":["Atlantic","Indian","Pacific","Arctic"],"correctAnswer":"Pacific"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '1eb093b7-8adb-4b90-8bef-006ca9b73ab1'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '7755bc5a-d3e7-45b4-888e-a60fe74d31b3'::uuid, '1eb093b7-8adb-4b90-8bef-006ca9b73ab1'::uuid, 'multiple_choice', 'Which ocean is the smallest and coldest?', '{"options":["Arctic","Pacific","Indian","Atlantic"],"correctAnswer":"Arctic"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '1eb093b7-8adb-4b90-8bef-006ca9b73ab1'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '3506e694-4ae6-45d7-802d-157d17a5ae6e'::uuid, 'b1ffd768-6581-429d-8483-f5cfc49391fd'::uuid, '19dceffc-c88d-4179-866a-3da8e29de550'::uuid, 'mountains-and-rivers', 'Mountains and Rivers', 'High peaks and flowing water.', 'Mountains are very high pieces of land. Mount Everest in Asia is the tallest mountain above sea level. Rivers are long streams of water that flow to a lake or the sea. The Nile in Africa and the Amazon in South America are two of the longest rivers in the world. People have always built towns near rivers because they give fresh water.', 3, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = 'b1ffd768-6581-429d-8483-f5cfc49391fd'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '2fee8b86-4cfd-434d-8909-7a149705f6f5'::uuid, '3506e694-4ae6-45d7-802d-157d17a5ae6e'::uuid, 'multiple_choice', 'Where is Mount Everest?', '{"options":["Asia","Africa","Europe","Australia"],"correctAnswer":"Asia"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '3506e694-4ae6-45d7-802d-157d17a5ae6e'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'f285d6e3-bfa0-446f-88ac-5ce33dfb5837'::uuid, '3506e694-4ae6-45d7-802d-157d17a5ae6e'::uuid, 'multiple_choice', 'Why did people build towns near rivers?', '{"options":["Fresh water","Snow","Sand","Wind"],"correctAnswer":"Fresh water"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '3506e694-4ae6-45d7-802d-157d17a5ae6e'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT 'e8efa47e-6520-42bd-87db-719cebfdb5db'::uuid, 'b1ffd768-6581-429d-8483-f5cfc49391fd'::uuid, '19dceffc-c88d-4179-866a-3da8e29de550'::uuid, 'deserts-and-forests', 'Deserts and Forests', 'Dry lands and green lands.', 'A desert is a place that gets very little rain. The Sahara in Africa is the largest hot desert in the world. Some deserts, like Antarctica, are cold. Forests are lands full of trees. Rainforests get a lot of rain and are home to more than half of the world''s animal and plant species. Trees give us oxygen and clean the air.', 4, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = 'b1ffd768-6581-429d-8483-f5cfc49391fd'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'e202cc2d-ec16-4a3c-8989-c96aaa95b547'::uuid, 'e8efa47e-6520-42bd-87db-719cebfdb5db'::uuid, 'multiple_choice', 'What is a desert?', '{"options":["A place with very little rain","A place with a lot of rain","A kind of ocean","A mountain"],"correctAnswer":"A place with very little rain"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'e8efa47e-6520-42bd-87db-719cebfdb5db'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '8ec81374-d7f8-4c0b-8854-7d4633343531'::uuid, 'e8efa47e-6520-42bd-87db-719cebfdb5db'::uuid, 'multiple_choice', 'What do trees give us?', '{"options":["Oxygen","Plastic","Smoke","Noise"],"correctAnswer":"Oxygen"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'e8efa47e-6520-42bd-87db-719cebfdb5db'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quizzes (id, title, course_id) SELECT 'dd33cff9-fc22-4b1b-84eb-94682a2b21f7'::uuid, 'Continents and Oceans — Final Exam', '19dceffc-c88d-4179-866a-3da8e29de550'::uuid
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = '19dceffc-c88d-4179-866a-3da8e29de550'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '18a5daa8-17af-437c-87f3-ada058b50f50'::uuid, 'dd33cff9-fc22-4b1b-84eb-94682a2b21f7'::uuid, 'multiple_choice', 'Which continent is covered in ice?', '["Antarctica","Africa","Asia","Europe"]'::jsonb, 'Antarctica', 'Antarctica is covered in ice.', 1, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = 'dd33cff9-fc22-4b1b-84eb-94682a2b21f7'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '9e695a93-e47c-40cd-87bc-7e8dc73e9132'::uuid, 'dd33cff9-fc22-4b1b-84eb-94682a2b21f7'::uuid, 'multiple_choice', 'What is the largest hot desert?', '["Sahara","Gobi","Kalahari","Thar"]'::jsonb, 'Sahara', 'The Sahara is in North Africa.', 2, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = 'dd33cff9-fc22-4b1b-84eb-94682a2b21f7'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'd87fe9bd-4be8-40fb-8f04-836f90246c82'::uuid, 'dd33cff9-fc22-4b1b-84eb-94682a2b21f7'::uuid, 'true_false', 'There are seven continents.', '["True","False"]'::jsonb, 'True', 'Asia, Africa, North America, South America, Antarctica, Europe and Oceania.', 3, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = 'dd33cff9-fc22-4b1b-84eb-94682a2b21f7'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '66112ae7-a09e-4d2a-8475-fba510157ddc'::uuid, 'dd33cff9-fc22-4b1b-84eb-94682a2b21f7'::uuid, 'multiple_choice', 'Which ocean is the biggest?', '["Pacific","Arctic","Indian","Southern"]'::jsonb, 'Pacific', 'The Pacific is the biggest and deepest.', 4, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = 'dd33cff9-fc22-4b1b-84eb-94682a2b21f7'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '58fbf0e3-117e-4c2c-89f6-3fe90d68489a'::uuid, 'dd33cff9-fc22-4b1b-84eb-94682a2b21f7'::uuid, 'true_false', 'Rainforests get very little rain.', '["True","False"]'::jsonb, 'False', 'Rainforests get a lot of rain.', 5, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = 'dd33cff9-fc22-4b1b-84eb-94682a2b21f7'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '46c5736a-ecd3-44b1-8340-ab24957b8d26'::uuid, 'dd33cff9-fc22-4b1b-84eb-94682a2b21f7'::uuid, 'multiple_choice', 'Which is the tallest mountain above sea level?', '["Mount Everest","Mont Blanc","Kilimanjaro","Mount Fuji"]'::jsonb, 'Mount Everest', 'Everest is in Asia.', 6, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = 'dd33cff9-fc22-4b1b-84eb-94682a2b21f7'::uuid) ON CONFLICT (id) DO NOTHING;

-- ── Staying Safe Online ──
INSERT INTO public.kids_courses (id, slug, title, subtitle, description, subject_id, age_range, difficulty, xp_reward, coins_reward, status, published_at)
SELECT '655a0cb8-e64f-49c5-8cdf-61e20d213c76'::uuid, 'staying-safe-online', 'Staying Safe Online', 'Smart and kind on the internet', 'Learn how to protect yourself online: strong passwords, privacy, strangers, and being kind.', s.id, '9-12', 'easy', 100, 50, 'published', now()
FROM public.kids_subjects s WHERE s.slug = 'digital-safety'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.kids_units (id, course_id, title, description, order_index) SELECT 'e87ec0ef-201b-49ec-8037-886013e5ab41'::uuid, '655a0cb8-e64f-49c5-8cdf-61e20d213c76'::uuid, 'Be Safe, Be Kind', 'Smart and kind on the internet', 1
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = '655a0cb8-e64f-49c5-8cdf-61e20d213c76'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '012ed0e5-ef84-43d5-853c-4a1bf2adbad5'::uuid, 'e87ec0ef-201b-49ec-8037-886013e5ab41'::uuid, '655a0cb8-e64f-49c5-8cdf-61e20d213c76'::uuid, 'strong-passwords', 'Strong Passwords', 'How to make a password that is hard to guess.', 'A password is a secret key that protects your accounts. A strong password is long and mixes words, numbers and symbols, like Blue-Tiger-Moon-47! Never use your name, birthday or 123456. Never share your password with friends. Only share it with a parent or guardian you trust. Use a different password for every account.', 1, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = 'e87ec0ef-201b-49ec-8037-886013e5ab41'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '5e145e2c-d0b3-495a-80f1-07109af7ccd1'::uuid, '012ed0e5-ef84-43d5-853c-4a1bf2adbad5'::uuid, 'multiple_choice', 'Which password is the strongest?', '{"options":["123456","myname","Blue-Tiger-Moon-47!","password"],"correctAnswer":"Blue-Tiger-Moon-47!"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '012ed0e5-ef84-43d5-853c-4a1bf2adbad5'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '22e90715-97f2-441b-8402-0bca53fccb2e'::uuid, '012ed0e5-ef84-43d5-853c-4a1bf2adbad5'::uuid, 'multiple_choice', 'Who can you share your password with?', '{"options":["Any friend","A trusted parent or guardian","Anyone online","Nobody and everybody"],"correctAnswer":"A trusted parent or guardian"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '012ed0e5-ef84-43d5-853c-4a1bf2adbad5'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '8748fb2d-fd23-4dfc-8936-fe159900ca36'::uuid, 'e87ec0ef-201b-49ec-8037-886013e5ab41'::uuid, '655a0cb8-e64f-49c5-8cdf-61e20d213c76'::uuid, 'strangers-online', 'Strangers Online', 'People online are not always who they say.', 'On the internet, a person can pretend to be someone else. Never share your full name, address, school or phone number with someone you only know online. Do not agree to meet an online friend in real life. If someone asks for photos, secrets, or makes you feel uncomfortable, stop talking and tell a parent or a teacher right away. You will never be in trouble for telling.', 2, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = 'e87ec0ef-201b-49ec-8037-886013e5ab41'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '543ba575-72d1-4eaa-81a1-3590afae4701'::uuid, '8748fb2d-fd23-4dfc-8936-fe159900ca36'::uuid, 'multiple_choice', 'A stranger online asks where you live. What do you do?', '{"options":["Tell them","Stop and tell a trusted adult","Send a photo","Ask them to visit"],"correctAnswer":"Stop and tell a trusted adult"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '8748fb2d-fd23-4dfc-8936-fe159900ca36'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '60d71762-0570-42ce-82e8-29c38f08644b'::uuid, '8748fb2d-fd23-4dfc-8936-fe159900ca36'::uuid, 'multiple_choice', 'Is everyone online who they say they are?', '{"options":["Yes, always","No, some people pretend","Only adults","Only kids"],"correctAnswer":"No, some people pretend"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '8748fb2d-fd23-4dfc-8936-fe159900ca36'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '73d37f30-79cd-4cf6-8955-5d742bde37b8'::uuid, 'e87ec0ef-201b-49ec-8037-886013e5ab41'::uuid, '655a0cb8-e64f-49c5-8cdf-61e20d213c76'::uuid, 'be-kind-online', 'Be Kind Online', 'Words can hurt, even on screens.', 'Real people read what you write, even if you cannot see their faces. Before you post or send a message, ask: is it kind? Is it true? Would I say this face to face? Bullying online is called cyberbullying. If you see it, do not join in. Be an upstander: support the person and tell an adult. Block and report anyone who is unkind.', 3, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = 'e87ec0ef-201b-49ec-8037-886013e5ab41'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'a959cfa5-dee8-44bf-8278-c1526c894d84'::uuid, '73d37f30-79cd-4cf6-8955-5d742bde37b8'::uuid, 'multiple_choice', 'What is cyberbullying?', '{"options":["Being mean to someone online","Playing a game","Sending a gift","Reading a book"],"correctAnswer":"Being mean to someone online"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '73d37f30-79cd-4cf6-8955-5d742bde37b8'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'fdbe1c12-80c2-4e88-8c7b-688ac3053f17'::uuid, '73d37f30-79cd-4cf6-8955-5d742bde37b8'::uuid, 'multiple_choice', 'You see someone being bullied online. What is a good step?', '{"options":["Join in","Support them and tell an adult","Ignore it forever","Laugh"],"correctAnswer":"Support them and tell an adult"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '73d37f30-79cd-4cf6-8955-5d742bde37b8'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT 'aa1d276c-80cc-4dab-898b-94b0be9b9a79'::uuid, 'e87ec0ef-201b-49ec-8037-886013e5ab41'::uuid, '655a0cb8-e64f-49c5-8cdf-61e20d213c76'::uuid, 'privacy-and-sharing', 'Privacy and Sharing', 'Think before you post.', 'Once something is posted online, it can stay there forever and others can copy it. Before sharing a photo or video, ask yourself if you are happy for everyone to see it, including your teachers and grandparents. Keep accounts private when you can. Ask permission before posting a photo of someone else. Only download apps and games with a parent''s help.', 4, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = 'e87ec0ef-201b-49ec-8037-886013e5ab41'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '5e701b1e-d3bf-4acf-8efe-0a85e42ddb44'::uuid, 'aa1d276c-80cc-4dab-898b-94b0be9b9a79'::uuid, 'multiple_choice', 'Once you post a photo online...', '{"options":["It can stay forever","It disappears right away","Only you can see it","It cannot be copied"],"correctAnswer":"It can stay forever"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'aa1d276c-80cc-4dab-898b-94b0be9b9a79'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '6e724f78-8861-4741-8f8f-6e8eab599c18'::uuid, 'aa1d276c-80cc-4dab-898b-94b0be9b9a79'::uuid, 'multiple_choice', 'Before posting a photo of a friend you should...', '{"options":["Ask permission","Just post it","Hide it","Delete it"],"correctAnswer":"Ask permission"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'aa1d276c-80cc-4dab-898b-94b0be9b9a79'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quizzes (id, title, course_id) SELECT '693f4bc0-4776-417d-86be-f8839daa2508'::uuid, 'Staying Safe Online — Final Exam', '655a0cb8-e64f-49c5-8cdf-61e20d213c76'::uuid
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = '655a0cb8-e64f-49c5-8cdf-61e20d213c76'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'd5ecbe94-6255-458a-8b3b-25325afeb059'::uuid, '693f4bc0-4776-417d-86be-f8839daa2508'::uuid, 'true_false', 'It is safe to share your password with anyone who asks.', '["True","False"]'::jsonb, 'False', 'Only a trusted parent or guardian should know it.', 1, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '693f4bc0-4776-417d-86be-f8839daa2508'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '9ab34aef-ccac-4bc9-8e92-194a27b7fdee'::uuid, '693f4bc0-4776-417d-86be-f8839daa2508'::uuid, 'multiple_choice', 'Which is the best thing to do if something online makes you feel uncomfortable?', '["Tell a trusted adult","Keep it secret","Reply angrily","Share it"]'::jsonb, 'Tell a trusted adult', 'Telling an adult keeps you safe.', 2, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '693f4bc0-4776-417d-86be-f8839daa2508'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '476b81ff-214d-4489-88f0-ae4772cae5d5'::uuid, '693f4bc0-4776-417d-86be-f8839daa2508'::uuid, 'true_false', 'Everyone online is exactly who they say they are.', '["True","False"]'::jsonb, 'False', 'People can pretend.', 3, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '693f4bc0-4776-417d-86be-f8839daa2508'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '2a793212-9a90-4122-8d16-a782aea60de9'::uuid, '693f4bc0-4776-417d-86be-f8839daa2508'::uuid, 'multiple_choice', 'What makes a password strong?', '["Long and mixed","Your name","123456","Your birthday"]'::jsonb, 'Long and mixed', 'Long, unusual and mixed is best.', 4, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '693f4bc0-4776-417d-86be-f8839daa2508'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'c3a038da-b6e6-4422-8c58-cbf5abd63850'::uuid, '693f4bc0-4776-417d-86be-f8839daa2508'::uuid, 'multiple_choice', 'What should you ask before you post?', '["Is it kind and true?","How many likes?","Is it funny to me only?","Who will see it first?"]'::jsonb, 'Is it kind and true?', 'Kind and true is a good test.', 5, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '693f4bc0-4776-417d-86be-f8839daa2508'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '22c7a4e1-1b0d-4cbc-8abd-184a99cd0e95'::uuid, '693f4bc0-4776-417d-86be-f8839daa2508'::uuid, 'true_false', 'Posted things can be copied and stay online.', '["True","False"]'::jsonb, 'True', 'Think before you post.', 6, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '693f4bc0-4776-417d-86be-f8839daa2508'::uuid) ON CONFLICT (id) DO NOTHING;

-- ── Think Like a Coder ──
INSERT INTO public.kids_courses (id, slug, title, subtitle, description, subject_id, age_range, difficulty, xp_reward, coins_reward, status, published_at)
SELECT 'a4f35a52-8fa7-4a63-8215-55512c02e2be'::uuid, 'think-like-a-coder', 'Think Like a Coder', 'Algorithms, loops, conditions and bugs', 'Learn the four big ideas of coding without a computer: steps, repeating, choosing and fixing mistakes.', s.id, '9-12', 'medium', 100, 50, 'published', now()
FROM public.kids_subjects s WHERE s.slug = 'coding'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.kids_units (id, course_id, title, description, order_index) SELECT 'cb463295-ffd8-444f-8cce-f02e477d27f1'::uuid, 'a4f35a52-8fa7-4a63-8215-55512c02e2be'::uuid, 'Coding Ideas', 'Algorithms, loops, conditions and bugs', 1
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = 'a4f35a52-8fa7-4a63-8215-55512c02e2be'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '3a220116-7a0c-4995-807e-459ef28cba9b'::uuid, 'cb463295-ffd8-444f-8cce-f02e477d27f1'::uuid, 'a4f35a52-8fa7-4a63-8215-55512c02e2be'::uuid, 'algorithms-step-by-step', 'Algorithms: Step by Step', 'A set of ordered instructions.', 'An algorithm is a list of steps, in the right order, that solves a problem. A recipe is an algorithm. So are directions to a friend''s house. Computers follow algorithms exactly, so each step must be clear and in order. If you change the order of steps, the result may be wrong: you cannot put on your shoes before your socks!', 1, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = 'cb463295-ffd8-444f-8cce-f02e477d27f1'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '01d8dfc8-955a-4839-8a2f-c8d63421710d'::uuid, '3a220116-7a0c-4995-807e-459ef28cba9b'::uuid, 'multiple_choice', 'What is an algorithm?', '{"options":["Ordered steps to solve a problem","A computer game","A bug","A website"],"correctAnswer":"Ordered steps to solve a problem"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '3a220116-7a0c-4995-807e-459ef28cba9b'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'f4cdd58a-555b-421e-8b7a-e251f9fc5fce'::uuid, '3a220116-7a0c-4995-807e-459ef28cba9b'::uuid, 'multiple_choice', 'Which is an example of an algorithm?', '{"options":["A recipe","A cloud","A song title","A colour"],"correctAnswer":"A recipe"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '3a220116-7a0c-4995-807e-459ef28cba9b'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT 'e792f47a-ec22-423c-8656-96d8ddc22e39'::uuid, 'cb463295-ffd8-444f-8cce-f02e477d27f1'::uuid, 'a4f35a52-8fa7-4a63-8215-55512c02e2be'::uuid, 'loops-repeat-it', 'Loops: Repeat It', 'Doing something many times.', 'A loop tells the computer to repeat steps. Instead of writing ''clap'' ten times, you write ''repeat 10 times: clap''. Loops save time and make programs shorter. Some loops repeat a fixed number of times. Others repeat until something happens, like ''keep walking until you reach the wall''.', 2, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = 'cb463295-ffd8-444f-8cce-f02e477d27f1'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '2d0d09d3-404f-4650-85b3-898ef9540321'::uuid, 'e792f47a-ec22-423c-8656-96d8ddc22e39'::uuid, 'multiple_choice', 'What does a loop do?', '{"options":["Repeats steps","Stops a program","Deletes code","Plays music"],"correctAnswer":"Repeats steps"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'e792f47a-ec22-423c-8656-96d8ddc22e39'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '1eaf6748-9167-4328-87df-2110f09b6285'::uuid, 'e792f47a-ec22-423c-8656-96d8ddc22e39'::uuid, 'typing', 'A loop repeats ''jump'' 3 times. How many jumps? Type the number.', '{"correctAnswer":"3"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'e792f47a-ec22-423c-8656-96d8ddc22e39'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT 'fa5c2508-9392-4281-8503-f2ff7fdee30d'::uuid, 'cb463295-ffd8-444f-8cce-f02e477d27f1'::uuid, 'a4f35a52-8fa7-4a63-8215-55512c02e2be'::uuid, 'conditions-if-this-then-that', 'Conditions: If This, Then That', 'Making choices.', 'A condition lets a program choose. If it is raining, then take an umbrella; otherwise, wear sunglasses. In code we write ''if ... then ... else ...''. A condition is either true or false. Games use conditions all the time: if your score is over 100, then you win a medal.', 3, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = 'cb463295-ffd8-444f-8cce-f02e477d27f1'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'e6ecd0b6-6d47-45d8-85d2-93e256628706'::uuid, 'fa5c2508-9392-4281-8503-f2ff7fdee30d'::uuid, 'multiple_choice', '''If it is raining, take an umbrella.'' What is the condition?', '{"options":["It is raining","Take an umbrella","If","Umbrella"],"correctAnswer":"It is raining"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'fa5c2508-9392-4281-8503-f2ff7fdee30d'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'b0f0775b-8393-40ac-889f-9214dec5cdc0'::uuid, 'fa5c2508-9392-4281-8503-f2ff7fdee30d'::uuid, 'multiple_choice', 'A condition is either...', '{"options":["True or false","Red or blue","Big or small","Fast or slow"],"correctAnswer":"True or false"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'fa5c2508-9392-4281-8503-f2ff7fdee30d'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '6b23bb7e-6585-48d0-8775-9afe454194e7'::uuid, 'cb463295-ffd8-444f-8cce-f02e477d27f1'::uuid, 'a4f35a52-8fa7-4a63-8215-55512c02e2be'::uuid, 'debugging-fix-the-bug', 'Debugging: Fix the Bug', 'Finding and fixing mistakes.', 'A bug is a mistake in a program. Debugging means finding the mistake and fixing it. Every coder makes bugs, even experts! To debug: read the steps slowly, test one part at a time, and change one thing at a time. Do not give up. Finding a bug is like solving a puzzle.', 4, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = 'cb463295-ffd8-444f-8cce-f02e477d27f1'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '31d553e0-36da-49db-86ed-30adbf20f7a8'::uuid, '6b23bb7e-6585-48d0-8775-9afe454194e7'::uuid, 'multiple_choice', 'What is debugging?', '{"options":["Finding and fixing mistakes","Writing faster","Deleting a program","Printing"],"correctAnswer":"Finding and fixing mistakes"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '6b23bb7e-6585-48d0-8775-9afe454194e7'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'ea10aee1-185b-483c-8e3d-abe5c43fd6d1'::uuid, '6b23bb7e-6585-48d0-8775-9afe454194e7'::uuid, 'multiple_choice', 'Which is a good debugging tip?', '{"options":["Test one part at a time","Change everything at once","Give up","Ignore errors"],"correctAnswer":"Test one part at a time"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '6b23bb7e-6585-48d0-8775-9afe454194e7'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quizzes (id, title, course_id) SELECT '1df06311-fc89-44c2-8f14-898d18add7f2'::uuid, 'Think Like a Coder — Final Exam', 'a4f35a52-8fa7-4a63-8215-55512c02e2be'::uuid
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = 'a4f35a52-8fa7-4a63-8215-55512c02e2be'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'f09403c1-9537-4780-810d-ce6b59331b01'::uuid, '1df06311-fc89-44c2-8f14-898d18add7f2'::uuid, 'multiple_choice', 'What do you call a mistake in a program?', '["Bug","Loop","Algorithm","Condition"]'::jsonb, 'Bug', 'A bug is a mistake.', 1, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '1df06311-fc89-44c2-8f14-898d18add7f2'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'c361daf9-408f-4dff-8114-b62ba3d9bb09'::uuid, '1df06311-fc89-44c2-8f14-898d18add7f2'::uuid, 'true_false', 'Computers follow algorithms exactly as written.', '["True","False"]'::jsonb, 'True', 'They do not guess what you meant.', 2, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '1df06311-fc89-44c2-8f14-898d18add7f2'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '548fe82a-dfa3-42df-8670-e0285a4e9b6d'::uuid, '1df06311-fc89-44c2-8f14-898d18add7f2'::uuid, 'multiple_choice', 'Which idea repeats steps?', '["Loop","Condition","Bug","Variable"]'::jsonb, 'Loop', 'Loops repeat.', 3, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '1df06311-fc89-44c2-8f14-898d18add7f2'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '360f19c9-74cb-4af1-8992-84fc49db4a04'::uuid, '1df06311-fc89-44c2-8f14-898d18add7f2'::uuid, 'multiple_choice', 'Which idea lets a program choose?', '["Condition","Loop","Bug","Screen"]'::jsonb, 'Condition', 'If-then makes choices.', 4, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '1df06311-fc89-44c2-8f14-898d18add7f2'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '01182405-7a0e-44d4-83f6-a05de0b30d76'::uuid, '1df06311-fc89-44c2-8f14-898d18add7f2'::uuid, 'true_false', 'Only beginners make bugs.', '["True","False"]'::jsonb, 'False', 'Everyone makes bugs, even experts.', 5, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '1df06311-fc89-44c2-8f14-898d18add7f2'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '23b50145-a833-4b1d-8429-d19fd8d1d73f'::uuid, '1df06311-fc89-44c2-8f14-898d18add7f2'::uuid, 'multiple_choice', 'What happens if you swap the order of steps in an algorithm?', '["The result may be wrong","Nothing","It gets faster always","It turns into a loop"]'::jsonb, 'The result may be wrong', 'Order matters.', 6, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '1df06311-fc89-44c2-8f14-898d18add7f2'::uuid) ON CONFLICT (id) DO NOTHING;

-- ── Money Smart Kids ──
INSERT INTO public.kids_courses (id, slug, title, subtitle, description, subject_id, age_range, difficulty, xp_reward, coins_reward, status, published_at)
SELECT '30ce49cf-5c32-496e-8ef1-5cc62e136301'::uuid, 'money-smart-kids', 'Money Smart Kids', 'Needs, wants, saving and earning', 'Simple ideas about money: the difference between needs and wants, how saving works, how people earn, and how to make a budget.', s.id, '9-12', 'easy', 100, 50, 'published', now()
FROM public.kids_subjects s WHERE s.slug = 'finance'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.kids_units (id, course_id, title, description, order_index) SELECT '0fbd1061-4293-4b53-87a2-9ec2f6d7dffc'::uuid, '30ce49cf-5c32-496e-8ef1-5cc62e136301'::uuid, 'First Steps with Money', 'Needs, wants, saving and earning', 1
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = '30ce49cf-5c32-496e-8ef1-5cc62e136301'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT 'b622d63b-c2f9-42d2-8a34-70a06180bcf9'::uuid, '0fbd1061-4293-4b53-87a2-9ec2f6d7dffc'::uuid, '30ce49cf-5c32-496e-8ef1-5cc62e136301'::uuid, 'needs-and-wants', 'Needs and Wants', 'What we must have and what we would like.', 'Needs are things we must have to live safely and be healthy: food, water, clothes, a home and medicine. Wants are things that are nice to have, like toys, sweets and games. We cannot buy every want, so we choose. A good rule is to take care of needs first, then wants.', 1, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '0fbd1061-4293-4b53-87a2-9ec2f6d7dffc'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'ce85cfbc-20bc-4834-8012-4246001b6d4f'::uuid, 'b622d63b-c2f9-42d2-8a34-70a06180bcf9'::uuid, 'multiple_choice', 'Which is a need?', '{"options":["Water","A toy robot","Candy","A video game"],"correctAnswer":"Water"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'b622d63b-c2f9-42d2-8a34-70a06180bcf9'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'a9555232-4852-4c04-8be7-e34b3a105652'::uuid, 'b622d63b-c2f9-42d2-8a34-70a06180bcf9'::uuid, 'multiple_choice', 'Which is a want?', '{"options":["A new game","Food","Medicine","A home"],"correctAnswer":"A new game"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'b622d63b-c2f9-42d2-8a34-70a06180bcf9'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT 'b9a33d7d-0cd9-4d03-898f-650f3ddde787'::uuid, '0fbd1061-4293-4b53-87a2-9ec2f6d7dffc'::uuid, '30ce49cf-5c32-496e-8ef1-5cc62e136301'::uuid, 'saving-money', 'Saving Money', 'Keeping some money for later.', 'Saving means keeping some of your money instead of spending it all. You can save for something big, like a bicycle, or for an emergency. Put your savings in a safe place such as a piggy bank. Even small amounts add up: saving 1 coin every day gives you 7 coins in a week!', 2, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '0fbd1061-4293-4b53-87a2-9ec2f6d7dffc'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'cbdde7f0-bbd4-48c5-8149-9f7812348479'::uuid, 'b9a33d7d-0cd9-4d03-898f-650f3ddde787'::uuid, 'multiple_choice', 'What does saving mean?', '{"options":["Keeping money for later","Spending it all","Losing money","Giving it away only"],"correctAnswer":"Keeping money for later"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'b9a33d7d-0cd9-4d03-898f-650f3ddde787'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'd61811f2-6683-4aef-8898-13ba88473dcd'::uuid, 'b9a33d7d-0cd9-4d03-898f-650f3ddde787'::uuid, 'typing', 'You save 1 coin a day. How many coins in a week? Type the number.', '{"correctAnswer":"7"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'b9a33d7d-0cd9-4d03-898f-650f3ddde787'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '11f3ad21-60c2-4b3c-8115-1332df6f4653'::uuid, '0fbd1061-4293-4b53-87a2-9ec2f6d7dffc'::uuid, '30ce49cf-5c32-496e-8ef1-5cc62e136301'::uuid, 'earning-money', 'Earning Money', 'How people earn.', 'Adults earn money by working. A baker makes bread, a driver drives a bus, and a teacher teaches. People are paid for their work. Children can help at home and learn that money is earned by effort. Honest work is something to be proud of.', 3, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '0fbd1061-4293-4b53-87a2-9ec2f6d7dffc'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '1c22d063-9d30-4169-8715-3c0340912149'::uuid, '11f3ad21-60c2-4b3c-8115-1332df6f4653'::uuid, 'multiple_choice', 'How do most adults get money?', '{"options":["By working","By finding it","By wishing","By sleeping"],"correctAnswer":"By working"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '11f3ad21-60c2-4b3c-8115-1332df6f4653'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '14ff8aaf-9ca9-4fab-8160-f76a81696754'::uuid, '11f3ad21-60c2-4b3c-8115-1332df6f4653'::uuid, 'multiple_choice', 'Who makes bread?', '{"options":["Baker","Doctor","Pilot","Farmer"],"correctAnswer":"Baker"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '11f3ad21-60c2-4b3c-8115-1332df6f4653'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT 'c1739e46-05d2-4f1f-8aa1-b7fd29cf8e7b'::uuid, '0fbd1061-4293-4b53-87a2-9ec2f6d7dffc'::uuid, '30ce49cf-5c32-496e-8ef1-5cc62e136301'::uuid, 'making-a-budget', 'Making a Budget', 'A plan for your money.', 'A budget is a plan for how to use your money. Write down how much you get, then split it: some to spend, some to save, and some to share with people who need help. If you get 10 coins, you might spend 5, save 3 and share 2. Check your plan at the end of the week.', 4, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '0fbd1061-4293-4b53-87a2-9ec2f6d7dffc'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '747fe4cc-597d-4599-8abd-8b4bf621d94d'::uuid, 'c1739e46-05d2-4f1f-8aa1-b7fd29cf8e7b'::uuid, 'multiple_choice', 'A budget is...', '{"options":["A plan for money","A kind of bank","A coin","A toy"],"correctAnswer":"A plan for money"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'c1739e46-05d2-4f1f-8aa1-b7fd29cf8e7b'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '68db7e06-9a14-4fd6-8332-20a28d9ddfd3'::uuid, 'c1739e46-05d2-4f1f-8aa1-b7fd29cf8e7b'::uuid, 'typing', 'You get 10 coins, spend 5 and save 3. How many are left to share? Type the number.', '{"correctAnswer":"2"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'c1739e46-05d2-4f1f-8aa1-b7fd29cf8e7b'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quizzes (id, title, course_id) SELECT '4b606ecb-0f1a-401c-83ca-042ba443be68'::uuid, 'Money Smart Kids — Final Exam', '30ce49cf-5c32-496e-8ef1-5cc62e136301'::uuid
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = '30ce49cf-5c32-496e-8ef1-5cc62e136301'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'c9a5b4f9-bbde-4a20-8597-d7e580aa7255'::uuid, '4b606ecb-0f1a-401c-83ca-042ba443be68'::uuid, 'multiple_choice', 'Which is a need?', '["Food","Candy","A toy","A game"]'::jsonb, 'Food', 'Food keeps us alive.', 1, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '4b606ecb-0f1a-401c-83ca-042ba443be68'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '545ca93a-08f2-44d8-8c49-38e0b77f36be'::uuid, '4b606ecb-0f1a-401c-83ca-042ba443be68'::uuid, 'true_false', 'Saving means spending all your money at once.', '["True","False"]'::jsonb, 'False', 'Saving is keeping money for later.', 2, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '4b606ecb-0f1a-401c-83ca-042ba443be68'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '534a6e11-75fe-49f7-84cd-20cb7200762f'::uuid, '4b606ecb-0f1a-401c-83ca-042ba443be68'::uuid, 'multiple_choice', 'What is a budget?', '["A plan for money","A coin","A shop","A bank card"]'::jsonb, 'A plan for money', 'It helps you decide.', 3, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '4b606ecb-0f1a-401c-83ca-042ba443be68'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '44627840-6799-4295-8534-c67eb46f47b5'::uuid, '4b606ecb-0f1a-401c-83ca-042ba443be68'::uuid, 'multiple_choice', 'If you save 2 coins a day, how many in 5 days?', '["7","10","12","5"]'::jsonb, '10', '2 × 5 = 10.', 4, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '4b606ecb-0f1a-401c-83ca-042ba443be68'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'c4386e05-df6f-4d8b-8a88-b77ddce0d12b'::uuid, '4b606ecb-0f1a-401c-83ca-042ba443be68'::uuid, 'true_false', 'Wants are things you must have to live.', '["True","False"]'::jsonb, 'False', 'Needs are things you must have.', 5, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '4b606ecb-0f1a-401c-83ca-042ba443be68'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '83d79460-ee49-409a-827a-347517793ab4'::uuid, '4b606ecb-0f1a-401c-83ca-042ba443be68'::uuid, 'multiple_choice', 'Where is a safe place for savings?', '["A piggy bank","On the street","In the rain","Anywhere"]'::jsonb, 'A piggy bank', 'A safe place.', 6, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '4b606ecb-0f1a-401c-83ca-042ba443be68'::uuid) ON CONFLICT (id) DO NOTHING;

-- ── First English Words ──
INSERT INTO public.kids_courses (id, slug, title, subtitle, description, subject_id, age_range, difficulty, xp_reward, coins_reward, status, published_at)
SELECT 'a6c6cb3f-8756-4733-8965-1936a593237a'::uuid, 'first-english-words', 'First English Words', 'Colours, family, animals and days', 'Learn simple English words you use every day, with listening and speaking practice.', s.id, '6-8', 'easy', 100, 50, 'published', now()
FROM public.kids_subjects s WHERE s.slug = 'english'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.kids_units (id, course_id, title, description, order_index) SELECT '0bf9add2-639e-4079-8c23-6baba830b9de'::uuid, 'a6c6cb3f-8756-4733-8965-1936a593237a'::uuid, 'Everyday Words', 'Colours, family, animals and days', 1
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = 'a6c6cb3f-8756-4733-8965-1936a593237a'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '7d3957a4-4af4-4715-8bda-977f0e5459c6'::uuid, '0bf9add2-639e-4079-8c23-6baba830b9de'::uuid, 'a6c6cb3f-8756-4733-8965-1936a593237a'::uuid, 'colours', 'Colours', 'Red, blue, green, yellow and more.', 'Colours are everywhere! Red like an apple, blue like the sky, green like grass, yellow like the sun, orange like an orange, white like snow, and black like night. Say each colour out loud. What is your favourite colour?', 1, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '0bf9add2-639e-4079-8c23-6baba830b9de'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '51e86d2a-2bf9-4746-8ad5-821257fb9851'::uuid, '7d3957a4-4af4-4715-8bda-977f0e5459c6'::uuid, 'multiple_choice', 'What colour is the sky on a clear day?', '{"options":["Blue","Red","Green","Black"],"correctAnswer":"Blue"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '7d3957a4-4af4-4715-8bda-977f0e5459c6'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '0b549953-2410-4a93-86f3-0c4a75ce3553'::uuid, '7d3957a4-4af4-4715-8bda-977f0e5459c6'::uuid, 'matching', 'Match the word to the colour.', '{"pairs":[{"left":"Grass","right":"Green"},{"left":"Sun","right":"Yellow"},{"left":"Snow","right":"White"}]}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '7d3957a4-4af4-4715-8bda-977f0e5459c6'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '5856873e-cf4a-4d82-8794-51aec8966597'::uuid, '0bf9add2-639e-4079-8c23-6baba830b9de'::uuid, 'a6c6cb3f-8756-4733-8965-1936a593237a'::uuid, 'my-family', 'My Family', 'Mother, father, sister, brother, grandmother.', 'Family words: mother, father, sister, brother, grandmother and grandfather. A mother and father are your parents. Your brother and sister are your siblings. Say: ''This is my mother. This is my brother.'' Love your family!', 2, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '0bf9add2-639e-4079-8c23-6baba830b9de'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '0d4d588f-d4d6-41b3-8164-1eb693d7878f'::uuid, '5856873e-cf4a-4d82-8794-51aec8966597'::uuid, 'multiple_choice', 'Your mother''s mother is your...', '{"options":["Grandmother","Sister","Aunt","Friend"],"correctAnswer":"Grandmother"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '5856873e-cf4a-4d82-8794-51aec8966597'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '13c4b83d-ce85-4ba3-8797-4c82bdbfce4c'::uuid, '5856873e-cf4a-4d82-8794-51aec8966597'::uuid, 'typing', 'Type the word: the boy in your family who has the same parents as you (brother).', '{"correctAnswer":"brother"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '5856873e-cf4a-4d82-8794-51aec8966597'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '983f8e01-2736-4b92-85ba-dfda6d7fb22c'::uuid, '0bf9add2-639e-4079-8c23-6baba830b9de'::uuid, 'a6c6cb3f-8756-4733-8965-1936a593237a'::uuid, 'animals', 'Animals', 'Cat, dog, bird, fish, horse.', 'Animal words: cat, dog, bird, fish, horse, cow and sheep. A cat says meow. A dog says woof. A cow says moo. A bird says tweet. Can you make the sounds? Point to each animal and say its name out loud.', 3, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '0bf9add2-639e-4079-8c23-6baba830b9de'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '0032b518-e3f1-49e2-8782-cc49860a2b7c'::uuid, '983f8e01-2736-4b92-85ba-dfda6d7fb22c'::uuid, 'multiple_choice', 'Which animal says ''moo''?', '{"options":["Cow","Cat","Bird","Fish"],"correctAnswer":"Cow"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '983f8e01-2736-4b92-85ba-dfda6d7fb22c'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '8e014896-bfeb-4e1d-8b37-4da70cf51986'::uuid, '983f8e01-2736-4b92-85ba-dfda6d7fb22c'::uuid, 'matching', 'Match the animal to its sound.', '{"pairs":[{"left":"Cat","right":"Meow"},{"left":"Dog","right":"Woof"},{"left":"Cow","right":"Moo"}]}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '983f8e01-2736-4b92-85ba-dfda6d7fb22c'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '24a01e88-5410-427f-8fe1-64d28d708245'::uuid, '0bf9add2-639e-4079-8c23-6baba830b9de'::uuid, 'a6c6cb3f-8756-4733-8965-1936a593237a'::uuid, 'days-of-the-week', 'Days of the Week', 'Monday to Sunday.', 'There are seven days in a week: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday and Sunday. Say them in order. Today is a day. Tomorrow is the next day. Yesterday was the day before. What day do you like best?', 4, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '0bf9add2-639e-4079-8c23-6baba830b9de'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '1a504732-4606-4226-8ecd-7975b0da9d8b'::uuid, '24a01e88-5410-427f-8fe1-64d28d708245'::uuid, 'typing', 'How many days are in a week? Type the number.', '{"correctAnswer":"7"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '24a01e88-5410-427f-8fe1-64d28d708245'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'a81587cc-de70-4e88-8bef-0dc5676f4316'::uuid, '24a01e88-5410-427f-8fe1-64d28d708245'::uuid, 'multiple_choice', 'Which day comes after Monday?', '{"options":["Tuesday","Sunday","Friday","Thursday"],"correctAnswer":"Tuesday"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '24a01e88-5410-427f-8fe1-64d28d708245'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quizzes (id, title, course_id) SELECT '20a5616a-7446-4ae6-886e-5767af21fe40'::uuid, 'First English Words — Final Exam', 'a6c6cb3f-8756-4733-8965-1936a593237a'::uuid
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = 'a6c6cb3f-8756-4733-8965-1936a593237a'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'e41ce1eb-0640-4d76-8d30-7c8eaa3724b0'::uuid, '20a5616a-7446-4ae6-886e-5767af21fe40'::uuid, 'multiple_choice', 'What colour is grass?', '["Green","Red","Pink","Black"]'::jsonb, 'Green', 'Grass is green.', 1, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '20a5616a-7446-4ae6-886e-5767af21fe40'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '171469c8-d076-4462-86e2-7da1ad016025'::uuid, '20a5616a-7446-4ae6-886e-5767af21fe40'::uuid, 'multiple_choice', 'What do you call your father''s mother?', '["Grandmother","Sister","Aunt","Friend"]'::jsonb, 'Grandmother', 'Grandmother.', 2, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '20a5616a-7446-4ae6-886e-5767af21fe40'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '3f40d7e8-9a9a-406e-8909-933987a1e549'::uuid, '20a5616a-7446-4ae6-886e-5767af21fe40'::uuid, 'multiple_choice', 'Which animal says ''woof''?', '["Dog","Cat","Fish","Horse"]'::jsonb, 'Dog', 'Dogs say woof.', 3, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '20a5616a-7446-4ae6-886e-5767af21fe40'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'b31576cd-cbd1-4cb8-8554-f027114a1b52'::uuid, '20a5616a-7446-4ae6-886e-5767af21fe40'::uuid, 'true_false', 'There are five days in a week.', '["True","False"]'::jsonb, 'False', 'There are seven.', 4, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '20a5616a-7446-4ae6-886e-5767af21fe40'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '5356141b-24d3-4617-833d-33451147f56e'::uuid, '20a5616a-7446-4ae6-886e-5767af21fe40'::uuid, 'multiple_choice', 'Which day comes after Friday?', '["Saturday","Monday","Wednesday","Sunday"]'::jsonb, 'Saturday', 'Saturday follows Friday.', 5, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '20a5616a-7446-4ae6-886e-5767af21fe40'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '6275ed0c-7a2d-479e-813f-b4c6e1f120ce'::uuid, '20a5616a-7446-4ae6-886e-5767af21fe40'::uuid, 'multiple_choice', 'What colour is the sun in a picture?', '["Yellow","Blue","Purple","Black"]'::jsonb, 'Yellow', 'We draw the sun yellow.', 6, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '20a5616a-7446-4ae6-886e-5767af21fe40'::uuid) ON CONFLICT (id) DO NOTHING;

-- ── الحروف والكلمات ──
INSERT INTO public.kids_courses (id, slug, title, subtitle, description, subject_id, age_range, difficulty, xp_reward, coins_reward, status, published_at)
SELECT '54979259-547c-4b32-82fc-a7526887ff61'::uuid, 'arabic-letters-and-words', 'الحروف والكلمات', 'نتعلم الحروف والحركات والكلمات', 'نتعرف على الحروف الهجائية والحركات وكلمات من حياتنا اليومية وأيام الأسبوع.', s.id, '6-8', 'easy', 100, 50, 'published', now()
FROM public.kids_subjects s WHERE s.slug = 'arabic'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.kids_units (id, course_id, title, description, order_index) SELECT '5526ef9c-4cb2-4eb5-8384-edaabf4bf422'::uuid, '54979259-547c-4b32-82fc-a7526887ff61'::uuid, 'رحلتنا مع العربية', 'نتعلم الحروف والحركات والكلمات', 1
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = '54979259-547c-4b32-82fc-a7526887ff61'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT 'bf993e6b-5740-4ee3-8719-13d71684ee4f'::uuid, '5526ef9c-4cb2-4eb5-8384-edaabf4bf422'::uuid, '54979259-547c-4b32-82fc-a7526887ff61'::uuid, 'الحروف-الهجائية', 'الحروف الهجائية', 'عدد الحروف وترتيبها.', 'اللغة العربية فيها ثمانية وعشرون حرفاً. نبدأ بحرف الألف ثم الباء ثم التاء ثم الثاء، وننتهي بحرف الياء. نكتب الحروف من اليمين إلى اليسار. لكل حرف صوت مختلف، فنقول: أ، ب، ت، ث. رددوا الحروف بصوت عالٍ.', 1, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '5526ef9c-4cb2-4eb5-8384-edaabf4bf422'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '1f1fdb84-6c14-4b94-804e-75a88bd4f03d'::uuid, 'bf993e6b-5740-4ee3-8719-13d71684ee4f'::uuid, 'multiple_choice', 'كم عدد حروف اللغة العربية؟', '{"options":["٢٦","٢٨","٣٠","٢٤"],"correctAnswer":"٢٨"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'bf993e6b-5740-4ee3-8719-13d71684ee4f'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '385a8e96-2b75-43d5-8bad-e306c9bc9f83'::uuid, 'bf993e6b-5740-4ee3-8719-13d71684ee4f'::uuid, 'multiple_choice', 'بأي حرف تبدأ الحروف الهجائية؟', '{"options":["الباء","الألف","التاء","الميم"],"correctAnswer":"الألف"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'bf993e6b-5740-4ee3-8719-13d71684ee4f'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '794fba06-4ab4-4210-8d5a-9c93bc039b0c'::uuid, '5526ef9c-4cb2-4eb5-8384-edaabf4bf422'::uuid, '54979259-547c-4b32-82fc-a7526887ff61'::uuid, 'الحركات', 'الحركات', 'الفتحة والضمة والكسرة والسكون.', 'الحركات علامات صغيرة تُوضع فوق الحرف أو تحته لتُبيّن كيف ننطقه. الفتحة فوق الحرف، مثل: بَ. والضمة فوق الحرف، مثل: بُ. والكسرة تحت الحرف، مثل: بِ. أما السكون فعلامة على أن الحرف ساكن. تغيّر الحركة نطق الكلمة، فنقول: كَتَبَ وكُتُب.', 2, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '5526ef9c-4cb2-4eb5-8384-edaabf4bf422'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'bdcb18b1-4d7b-4c2a-8de6-89a526ff5622'::uuid, '794fba06-4ab4-4210-8d5a-9c93bc039b0c'::uuid, 'multiple_choice', 'أين توضع الكسرة؟', '{"options":["فوق الحرف","تحت الحرف","بجانب الحرف","وسط الكلمة"],"correctAnswer":"تحت الحرف"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '794fba06-4ab4-4210-8d5a-9c93bc039b0c'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '8ba3320c-64b7-4174-8957-acd5712529d0'::uuid, '794fba06-4ab4-4210-8d5a-9c93bc039b0c'::uuid, 'matching', 'صِل الحركة بمثالها.', '{"pairs":[{"left":"الفتحة","right":"بَ"},{"left":"الضمة","right":"بُ"},{"left":"الكسرة","right":"بِ"}]}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '794fba06-4ab4-4210-8d5a-9c93bc039b0c'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '99983528-231a-4437-8305-06d1d108cb1c'::uuid, '5526ef9c-4cb2-4eb5-8384-edaabf4bf422'::uuid, '54979259-547c-4b32-82fc-a7526887ff61'::uuid, 'كلمات-من-حياتنا', 'كلمات من حياتنا', 'كلمات البيت والمدرسة.', 'نتعلم كلمات نستخدمها كل يوم. في البيت: أم، أب، أخ، أخت، بيت، طعام. وفي المدرسة: معلم، كتاب، قلم، دفتر، صف. وفي الطبيعة: شمس، قمر، شجرة، نهر، بحر. نقول: هذا كتاب، وهذا قلم.', 3, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '5526ef9c-4cb2-4eb5-8384-edaabf4bf422'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'ef918e4a-f817-4008-8d1c-6a5cbfeeb9a9'::uuid, '99983528-231a-4437-8305-06d1d108cb1c'::uuid, 'multiple_choice', 'أيّ كلمة من أدوات المدرسة؟', '{"options":["قلم","شجرة","قمر","نهر"],"correctAnswer":"قلم"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '99983528-231a-4437-8305-06d1d108cb1c'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '0c5c9bdb-6816-4520-8319-fc0367c54b6d'::uuid, '99983528-231a-4437-8305-06d1d108cb1c'::uuid, 'multiple_choice', 'أيّ كلمة من الطبيعة؟', '{"options":["دفتر","كتاب","شمس","معلم"],"correctAnswer":"شمس"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '99983528-231a-4437-8305-06d1d108cb1c'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT 'bda84882-feed-4868-8a37-481375ef267f'::uuid, '5526ef9c-4cb2-4eb5-8384-edaabf4bf422'::uuid, '54979259-547c-4b32-82fc-a7526887ff61'::uuid, 'أيام-الأسبوع', 'أيام الأسبوع', 'من السبت إلى الجمعة.', 'أيام الأسبوع سبعة: السبت، الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس، الجمعة. ما اسم اليوم الذي نذهب فيه إلى المدرسة؟ وما اسم يوم العطلة؟ رتّبوا الأيام وردّدوها.', 4, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '5526ef9c-4cb2-4eb5-8384-edaabf4bf422'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'a6ac2174-a8c7-49bb-86f0-c618ec5407fb'::uuid, 'bda84882-feed-4868-8a37-481375ef267f'::uuid, 'typing', 'كم يوماً في الأسبوع؟ اكتب الرقم.', '{"correctAnswer":"7"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'bda84882-feed-4868-8a37-481375ef267f'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'd8101516-c8f3-4d23-8798-e0aa783a5b40'::uuid, 'bda84882-feed-4868-8a37-481375ef267f'::uuid, 'multiple_choice', 'أيّ يوم يأتي بعد الأحد؟', '{"options":["الاثنين","الجمعة","الخميس","السبت"],"correctAnswer":"الاثنين"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'bda84882-feed-4868-8a37-481375ef267f'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quizzes (id, title, course_id) SELECT '3a754410-a144-45f4-8ff9-6bc9a59a2724'::uuid, 'الحروف والكلمات — Final Exam', '54979259-547c-4b32-82fc-a7526887ff61'::uuid
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = '54979259-547c-4b32-82fc-a7526887ff61'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'cbb222d4-f694-4d57-8c33-ce4230c68c3d'::uuid, '3a754410-a144-45f4-8ff9-6bc9a59a2724'::uuid, 'multiple_choice', 'كم حرفاً في الأبجدية العربية؟', '["٢٦","٢٨","٣٠","٢٤"]'::jsonb, '٢٨', 'الحروف ثمانية وعشرون.', 1, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '3a754410-a144-45f4-8ff9-6bc9a59a2724'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '7a7cdc25-5e18-4c76-8ec4-28d612bc865d'::uuid, '3a754410-a144-45f4-8ff9-6bc9a59a2724'::uuid, 'multiple_choice', 'أين توضع الفتحة؟', '["فوق الحرف","تحت الحرف","بعد الكلمة","قبل الحرف"]'::jsonb, 'فوق الحرف', 'الفتحة فوق الحرف.', 2, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '3a754410-a144-45f4-8ff9-6bc9a59a2724'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '58da735c-bcf0-490c-8887-e4e4c3fd3cba'::uuid, '3a754410-a144-45f4-8ff9-6bc9a59a2724'::uuid, 'true_false', 'نكتب بالعربية من اليسار إلى اليمين.', '["True","False"]'::jsonb, 'False', 'نكتب من اليمين إلى اليسار.', 3, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '3a754410-a144-45f4-8ff9-6bc9a59a2724'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '0c22c3ad-de84-40d2-8179-a30895088542'::uuid, '3a754410-a144-45f4-8ff9-6bc9a59a2724'::uuid, 'multiple_choice', 'أيّ يوم يأتي بعد الثلاثاء؟', '["الأربعاء","الأحد","الجمعة","السبت"]'::jsonb, 'الأربعاء', 'الأربعاء يلي الثلاثاء.', 4, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '3a754410-a144-45f4-8ff9-6bc9a59a2724'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'c821c085-58ab-4cd8-872e-c1dc101848b5'::uuid, '3a754410-a144-45f4-8ff9-6bc9a59a2724'::uuid, 'multiple_choice', 'أيّ كلمة من أدوات المدرسة؟', '["كتاب","نهر","قمر","شمس"]'::jsonb, 'كتاب', 'الكتاب من أدوات المدرسة.', 5, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '3a754410-a144-45f4-8ff9-6bc9a59a2724'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '842edb69-530b-4943-8fcc-43c22db5aea5'::uuid, '3a754410-a144-45f4-8ff9-6bc9a59a2724'::uuid, 'true_false', 'عدد أيام الأسبوع سبعة.', '["True","False"]'::jsonb, 'True', 'سبعة أيام.', 6, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '3a754410-a144-45f4-8ff9-6bc9a59a2724'::uuid) ON CONFLICT (id) DO NOTHING;

-- ── Shapes and Patterns ──
INSERT INTO public.kids_courses (id, slug, title, subtitle, description, subject_id, age_range, difficulty, xp_reward, coins_reward, status, published_at)
SELECT '25a5a659-1269-459a-807d-1346d054c18e'::uuid, 'shapes-and-patterns', 'Shapes and Patterns', 'Circles, squares, patterns and measuring', 'Recognise 2D and 3D shapes, find patterns and learn to measure.', s.id, '6-8', 'easy', 100, 50, 'published', now()
FROM public.kids_subjects s WHERE s.slug = 'math'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.kids_units (id, course_id, title, description, order_index) SELECT '4d27c203-8067-4853-81bc-577d5da09afb'::uuid, '25a5a659-1269-459a-807d-1346d054c18e'::uuid, 'Looking at Shapes', 'Circles, squares, patterns and measuring', 1
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = '25a5a659-1269-459a-807d-1346d054c18e'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT 'f4b7217e-80e7-4578-8c92-0962764b9c5f'::uuid, '4d27c203-8067-4853-81bc-577d5da09afb'::uuid, '25a5a659-1269-459a-807d-1346d054c18e'::uuid, 'flat-shapes', 'Flat Shapes', 'Circle, square, triangle, rectangle.', 'Flat shapes are called 2D shapes. A circle is round with no corners. A triangle has 3 sides and 3 corners. A square has 4 equal sides and 4 corners. A rectangle has 4 sides and 4 corners, with two long sides and two short sides. Look around: a clock is a circle, a door is a rectangle.', 1, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '4d27c203-8067-4853-81bc-577d5da09afb'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '771649f3-af16-48af-8edf-6bd57f6813ce'::uuid, 'f4b7217e-80e7-4578-8c92-0962764b9c5f'::uuid, 'multiple_choice', 'How many sides does a triangle have?', '{"options":["2","3","4","5"],"correctAnswer":"3"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'f4b7217e-80e7-4578-8c92-0962764b9c5f'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '2d6c4e60-d5e3-472e-8efb-9dd914d225c3'::uuid, 'f4b7217e-80e7-4578-8c92-0962764b9c5f'::uuid, 'matching', 'Match the shape to its number of corners.', '{"pairs":[{"left":"Triangle","right":"3"},{"left":"Square","right":"4"},{"left":"Circle","right":"0"}]}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'f4b7217e-80e7-4578-8c92-0962764b9c5f'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT 'e9ccefba-946c-40ea-839c-d4f96379e1ed'::uuid, '4d27c203-8067-4853-81bc-577d5da09afb'::uuid, '25a5a659-1269-459a-807d-1346d054c18e'::uuid, 'solid-shapes', 'Solid Shapes', 'Cube, sphere, cylinder, cone.', 'Solid shapes are called 3D shapes. A ball is a sphere. A box is a cube or a cuboid. A can is a cylinder. An ice-cream cone is a cone. A cube has 6 faces. Solid shapes take up space, and you can hold them.', 2, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '4d27c203-8067-4853-81bc-577d5da09afb'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '16df20a7-b703-44d6-8077-fc457a237f93'::uuid, 'e9ccefba-946c-40ea-839c-d4f96379e1ed'::uuid, 'multiple_choice', 'What shape is a ball?', '{"options":["Sphere","Cube","Cone","Triangle"],"correctAnswer":"Sphere"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'e9ccefba-946c-40ea-839c-d4f96379e1ed'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'b55b54a8-e8df-4251-86c4-d9b80b521a4b'::uuid, 'e9ccefba-946c-40ea-839c-d4f96379e1ed'::uuid, 'typing', 'How many faces does a cube have? Type the number.', '{"correctAnswer":"6"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = 'e9ccefba-946c-40ea-839c-d4f96379e1ed'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '52a679ed-d466-4553-8562-a9b502bbe336'::uuid, '4d27c203-8067-4853-81bc-577d5da09afb'::uuid, '25a5a659-1269-459a-807d-1346d054c18e'::uuid, 'patterns', 'Patterns', 'What comes next?', 'A pattern repeats in a way you can predict. Red, blue, red, blue, red... what comes next? Blue! Number patterns work too: 2, 4, 6, 8... the next number is 10, because we add 2 each time. Look for the part that repeats to find the rule.', 3, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '4d27c203-8067-4853-81bc-577d5da09afb'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '38713194-8d17-4f46-8a99-b6503a40c045'::uuid, '52a679ed-d466-4553-8562-a9b502bbe336'::uuid, 'multiple_choice', 'What comes next? 2, 4, 6, 8, ...', '{"options":["9","10","12","7"],"correctAnswer":"10"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '52a679ed-d466-4553-8562-a9b502bbe336'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT 'b7242bc5-517c-49d3-8df8-4402d52dbcaf'::uuid, '52a679ed-d466-4553-8562-a9b502bbe336'::uuid, 'multiple_choice', 'What comes next? Red, blue, red, blue, ...', '{"options":["Red","Blue","Green","Yellow"],"correctAnswer":"Red"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '52a679ed-d466-4553-8562-a9b502bbe336'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status)
SELECT '32672579-acba-470a-8060-d0d73136a0dc'::uuid, '4d27c203-8067-4853-81bc-577d5da09afb'::uuid, '25a5a659-1269-459a-807d-1346d054c18e'::uuid, 'measuring', 'Measuring', 'Length with a ruler.', 'We measure length with a ruler. Short lengths are in centimetres (cm) and longer lengths in metres (m). There are 100 centimetres in 1 metre. Put the zero of the ruler at the start of the object and read the number at the end. Measure your pencil and your book!', 4, 8, 15, 8, 'published'
WHERE EXISTS (SELECT 1 FROM public.kids_units WHERE id = '4d27c203-8067-4853-81bc-577d5da09afb'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '8b17a385-3f60-4258-8cf8-fadd4fa35d25'::uuid, '32672579-acba-470a-8060-d0d73136a0dc'::uuid, 'typing', 'How many centimetres are in 1 metre? Type the number.', '{"correctAnswer":"100"}'::jsonb, 1, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '32672579-acba-470a-8060-d0d73136a0dc'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_lesson_activities (id, lesson_id, type, prompt, content, order_index, points)
SELECT '5f66df8c-7731-42c3-88e8-ade68c5e62c3'::uuid, '32672579-acba-470a-8060-d0d73136a0dc'::uuid, 'multiple_choice', 'Which tool measures length?', '{"options":["Ruler","Clock","Scale","Cup"],"correctAnswer":"Ruler"}'::jsonb, 2, 10
WHERE EXISTS (SELECT 1 FROM public.kids_lessons WHERE id = '32672579-acba-470a-8060-d0d73136a0dc'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quizzes (id, title, course_id) SELECT '14394bee-67ac-4919-891d-dcdaf0355263'::uuid, 'Shapes and Patterns — Final Exam', '25a5a659-1269-459a-807d-1346d054c18e'::uuid
WHERE EXISTS (SELECT 1 FROM public.kids_courses WHERE id = '25a5a659-1269-459a-807d-1346d054c18e'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'c362933c-e569-4e52-8cbb-370e1506dc2b'::uuid, '14394bee-67ac-4919-891d-dcdaf0355263'::uuid, 'multiple_choice', 'How many corners does a square have?', '["3","4","5","0"]'::jsonb, '4', 'A square has 4 corners.', 1, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '14394bee-67ac-4919-891d-dcdaf0355263'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'a69bd321-919f-473d-8b51-64217318c7b0'::uuid, '14394bee-67ac-4919-891d-dcdaf0355263'::uuid, 'multiple_choice', 'What shape is a can?', '["Cylinder","Cube","Sphere","Cone"]'::jsonb, 'Cylinder', 'A can is a cylinder.', 2, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '14394bee-67ac-4919-891d-dcdaf0355263'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '7660dc0e-2197-4f45-8b9f-2f7663f0da6b'::uuid, '14394bee-67ac-4919-891d-dcdaf0355263'::uuid, 'true_false', 'A circle has 4 corners.', '["True","False"]'::jsonb, 'False', 'A circle has no corners.', 3, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '14394bee-67ac-4919-891d-dcdaf0355263'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '1fcd235f-02c6-4503-806a-813eae45a5f7'::uuid, '14394bee-67ac-4919-891d-dcdaf0355263'::uuid, 'multiple_choice', 'Next in 5, 10, 15, 20, ...?', '["25","30","22","21"]'::jsonb, '25', 'Add 5 each time.', 4, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '14394bee-67ac-4919-891d-dcdaf0355263'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT 'ecb7acf2-6aa7-48ec-8e9e-578a113ea65c'::uuid, '14394bee-67ac-4919-891d-dcdaf0355263'::uuid, 'multiple_choice', 'How many faces does a cube have?', '["4","6","8","12"]'::jsonb, '6', 'A cube has 6 faces.', 5, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '14394bee-67ac-4919-891d-dcdaf0355263'::uuid) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kids_quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, order_index, points)
SELECT '9b7f643a-d28a-4f7d-8c1c-cdc716973b63'::uuid, '14394bee-67ac-4919-891d-dcdaf0355263'::uuid, 'true_false', '100 centimetres make 1 metre.', '["True","False"]'::jsonb, 'True', 'That is right.', 6, 20
WHERE EXISTS (SELECT 1 FROM public.kids_quizzes WHERE id = '14394bee-67ac-4919-891d-dcdaf0355263'::uuid) ON CONFLICT (id) DO NOTHING;

