-- Move all channels from 'christian' category into 'religious'
-- then remove the now-empty christian category

UPDATE public.tv_channels
SET category_id = (SELECT id FROM public.tv_categories WHERE slug = 'religious')
WHERE category_id = (SELECT id FROM public.tv_categories WHERE slug = 'christian');

DELETE FROM public.tv_categories WHERE slug = 'christian';
