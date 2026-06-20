-- Add marine-vessel simulation to the simulations table
-- sort_order 25 continues after vehicle-diagnostics (24)
INSERT INTO public.simulations
  (slug, title, description, subcategory, difficulty, estimated_duration, points, sort_order, published)
VALUES
  (
    'marine-vessel',
    'Live Marine Vessel Tracking & Maritime Logistics Simulator',
    'Command a global fleet — track vessels by IMO/MMSI, navigate port congestion, weather emergencies, piracy zones, and canal delays from a professional maritime operations center.',
    'Maritime',
    'Advanced',
    50,
    300,
    25,
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
