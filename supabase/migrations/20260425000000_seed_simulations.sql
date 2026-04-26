-- Seed all 23 simulations that have registered custom components
-- Uses ON CONFLICT DO UPDATE so re-running is safe
INSERT INTO public.simulations
  (slug, title, description, subcategory, difficulty, estimated_duration, points, sort_order, published)
VALUES
  -- Agriculture
  ('egg-incubator',     'Egg Incubator',             'Manage temperature, humidity, and egg rotation in a hatchery to maximise the hatch rate.',                        'Agriculture',     'Beginner',      20, 100,  1, true),
  ('dairy-farm',        'Dairy Farm',                'Run a small dairy operation: feed schedules, milking cycles, and herd health to maximise yield.',                  'Agriculture',     'Intermediate',  30, 150,  2, true),
  ('poultry-farm',      'Poultry Farm',              'Manage a commercial poultry farm — feed, health, and production targets for broiler and layer flocks.',            'Agriculture',     'Intermediate',  30, 150,  3, true),
  ('cattle-dairy',      'Cattle & Dairy',            'Oversee a cattle ranch and dairy unit, balancing pasture management, breeding, and milk production.',             'Agriculture',     'Advanced',      40, 200,  4, true),
  ('sheep-farm',        'Sheep Farm',                'Run a sheep farm through seasonal cycles: lambing, shearing, and market sales.',                                   'Agriculture',     'Intermediate',  30, 150,  5, true),

  -- Technology
  ('network-noc',       'Network NOC',               'Act as a Network Operations Centre engineer — diagnose and resolve live infrastructure incidents under pressure.', 'Technology',      'Advanced',      35, 200,  6, true),
  ('mobile-repair',     'Mobile Repair Workshop',    'Diagnose and fix smartphones — screen replacements, battery issues, and motherboard faults.',                      'Technology',      'Beginner',      25, 100,  7, true),
  ('laptop-repair',     'Laptop Repair Workshop',    'Troubleshoot and repair laptops: hardware faults, BIOS issues, and component replacements.',                       'Technology',      'Intermediate',  30, 150,  8, true),

  -- Manufacturing & Lab
  ('perfume-lab',       'Perfume Lab',               'Blend essential oils and aroma compounds to create signature fragrances and hit quality benchmarks.',              'Manufacturing',   'Intermediate',  30, 150,  9, true),
  ('detergent-lab',     'Detergent Lab',             'Formulate cleaning products — balance surfactants, fillers, and performance tests within budget.',                 'Manufacturing',   'Intermediate',  30, 150, 10, true),
  ('skin-care-lab',     'Skin Care Lab',             'Develop and test cosmetic formulations, meeting safety standards and efficacy targets.',                           'Manufacturing',   'Intermediate',  35, 150, 11, true),
  ('woodworking',       'Woodworking Workshop',      'Run a custom woodworking shop: plan jobs, manage materials, and deliver furniture on time and on budget.',         'Manufacturing',   'Beginner',      25, 100, 12, true),
  ('aluminum-glazing',  'Aluminum & Glazing',        'Manage an aluminium fabrication and glass installation business from quote to site completion.',                   'Construction',    'Intermediate',  35, 150, 13, true),

  -- Food & Beverage
  ('global-kitchen',    'Global Kitchen',            'Lead a restaurant kitchen: manage menus, staff, costs, and customer satisfaction across service shifts.',          'Food & Beverage', 'Intermediate',  30, 150, 14, true),
  ('chocolate-factory', 'Chocolate Factory',         'Operate a confectionery factory — sourcing cacao, production scheduling, and quality control.',                   'Food & Beverage', 'Intermediate',  30, 150, 15, true),

  -- Energy & Engineering
  ('solar-energy',      'Solar Energy Plant',        'Design and operate a solar installation — sizing panels, managing grid export, and tracking ROI.',                 'Energy',          'Advanced',      40, 200, 16, true),
  ('hvac-systems',      'HVAC Systems',              'Install and maintain heating, ventilation, and air-conditioning systems for commercial buildings.',                 'Engineering',     'Advanced',      40, 200, 17, true),

  -- Logistics
  ('logistics-supply',  'Logistics & Supply Chain',  'Optimise warehouse operations, fleet routing, and supplier relationships to hit delivery KPIs.',                  'Logistics',       'Advanced',      40, 200, 18, true),

  -- Services
  ('barber-salon',      'Barber Salon',              'Manage a barbershop: appointments, staff schedules, pricing, and customer retention strategies.',                  'Services',        'Beginner',      20, 100, 19, true),

  -- Healthcare
  ('board-surgeon',     'Board Surgeon',             'Make high-stakes surgical decisions in a simulated operating theatre — time management and patient safety.',       'Healthcare',      'Advanced',      45, 250, 20, true),

  -- Education
  ('english-journey',   'English Journey',           'Guide learners through a structured English language programme, adapting to different skill levels.',              'Education',       'Beginner',      25, 100, 21, true),
  ('music-training',    'Music Training Studio',     'Run a music school: schedule lessons, manage instruments, and track student progress towards recitals.',           'Education',       'Beginner',      25, 100, 22, true),

  -- Business
  ('trade-tycoon',      'Trade Tycoon',              'Build a trading empire — buy low, sell high, manage inventory and cash flow across multiple markets.',             'Business',        'Advanced',      45, 250, 23, true)

ON CONFLICT (slug) DO UPDATE SET
  title              = EXCLUDED.title,
  description        = EXCLUDED.description,
  subcategory        = EXCLUDED.subcategory,
  difficulty         = EXCLUDED.difficulty,
  estimated_duration = EXCLUDED.estimated_duration,
  points             = EXCLUDED.points,
  sort_order         = EXCLUDED.sort_order,
  published          = EXCLUDED.published,
  updated_at         = now();
