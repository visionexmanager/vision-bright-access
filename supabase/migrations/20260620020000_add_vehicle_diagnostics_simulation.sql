-- Add vehicle-diagnostics simulation to the simulations table
-- sort_order 24 continues after trade-tycoon (23)
INSERT INTO public.simulations
  (slug, title, description, subcategory, difficulty, estimated_duration, points, sort_order, published)
VALUES
  (
    'vehicle-diagnostics',
    'Ultimate Vehicle Diagnostics & Repair Simulator',
    'Diagnose OBD-II fault codes, trace electrical faults, and manage a real-world auto repair workflow from intake to road-test sign-off.',
    'Automotive',
    'Advanced',
    45,
    250,
    24,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  title              = EXCLUDED.title,
  description        = EXCLUDED.description,
  subcategory        = EXCLUDED.subcategory,
  difficulty         = EXCLUDED.difficulty,
  estimated_duration = EXCLUDED.estimated_duration,
  points             = EXCLUDED.points,
  sort_order         = EXCLUDED.sort_order,
  published          = EXCLUDED.published;
