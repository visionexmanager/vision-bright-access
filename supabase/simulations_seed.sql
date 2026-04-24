-- Insert all 23 simulations into the simulations table
-- Run this in Supabase SQL Editor
-- Each simulation maps to a component in src/pages/simulations/registry.ts

INSERT INTO public.simulations
  (title, description, subcategory, slug, points, difficulty, estimated_duration, published, sort_order)
VALUES
  -- Agriculture & Farming
  ('Egg Incubator Lab',
   'Manage a professional egg incubation facility. Control temperature, humidity, and timing to maximize hatch rates and run a profitable operation.',
   'Agriculture', 'egg-incubator', 120, 'Beginner', 20, true, 1),

  ('Dairy Farm Manager',
   'Run a full dairy farm operation — manage herd health, milk production cycles, feed costs, and market your products for maximum profit.',
   'Agriculture', 'dairy-farm', 150, 'Intermediate', 30, true, 2),

  ('Poultry Farm Business',
   'Build and manage a poultry farm from scratch. Handle breeding cycles, feed management, disease prevention, and sales logistics.',
   'Agriculture', 'poultry-farm', 150, 'Intermediate', 30, true, 3),

  ('Cattle & Dairy Operation',
   'Oversee a large-scale cattle operation. Manage livestock health, feed supply chains, breeding programs, and dairy or beef production.',
   'Agriculture', 'cattle-dairy', 180, 'Advanced', 35, true, 4),

  ('Sheep Farm Simulator',
   'Manage a sheep farming business — handle breeding seasons, wool production, market prices, and keep your flock healthy and profitable.',
   'Agriculture', 'sheep-farm', 130, 'Beginner', 25, true, 5),

  -- Technology & IT
  ('Network Operations Center',
   'Step into the role of a NOC engineer. Monitor live network infrastructure, respond to incidents, prioritize alerts, and keep uptime at 99.9%.',
   'Technology', 'network-noc', 200, 'Advanced', 40, true, 6),

  ('Mobile Device Repair',
   'Run a device repair workshop. Diagnose hardware faults, order parts, manage repair queues, and satisfy customers efficiently.',
   'Technology', 'mobile-repair', 140, 'Intermediate', 25, true, 7),

  ('Laptop Repair Center',
   'Manage a professional laptop repair center. Handle diagnostics, component replacements, software issues, and customer service.',
   'Technology', 'laptop-repair', 140, 'Intermediate', 25, true, 8),

  -- Manufacturing & Industry
  ('Perfume Lab Creator',
   'Design and manufacture your own fragrance line. Blend ingredients, manage raw material costs, create signature scents, and build a luxury perfume brand.',
   'Manufacturing', 'perfume-lab', 160, 'Intermediate', 30, true, 9),

  ('Detergent Lab Production',
   'Operate a cleaning product manufacturing facility. Formulate products, manage chemical supplies, ensure quality control, and optimize production costs.',
   'Manufacturing', 'detergent-lab', 150, 'Intermediate', 28, true, 10),

  ('Chocolate Factory',
   'Run a chocolate production factory from bean to bar. Manage sourcing, production lines, quality control, packaging, and distribution.',
   'Manufacturing', 'chocolate-factory', 170, 'Intermediate', 35, true, 11),

  ('Aluminum & Glazing Workshop',
   'Manage a fabrication workshop specializing in aluminum structures and glazing. Handle orders, material cutting, installation teams, and project timelines.',
   'Manufacturing', 'aluminum-glazing', 160, 'Intermediate', 30, true, 12),

  ('Woodworking Studio',
   'Design and produce custom wood furniture. Manage wood sourcing, cutting plans, finishing, client orders, and workshop efficiency.',
   'Manufacturing', 'woodworking', 140, 'Beginner', 25, true, 13),

  -- Services & Hospitality
  ('Barber Salon Business',
   'Manage a modern barber salon. Handle staff scheduling, client bookings, service pricing, supply management, and grow your customer base.',
   'Services', 'barber-salon', 120, 'Beginner', 20, true, 14),

  ('Global Kitchen Restaurant',
   'Run a multi-cuisine restaurant. Manage the menu, kitchen staff, ingredient sourcing, table turnover, customer satisfaction, and daily revenue.',
   'Services', 'global-kitchen', 160, 'Intermediate', 30, true, 15),

  ('Skin Care Clinic',
   'Operate a professional skin care and beauty clinic. Manage appointments, treatment protocols, product inventory, staff, and client retention.',
   'Services', 'skin-care-lab', 150, 'Intermediate', 28, true, 16),

  -- Logistics & Supply Chain
  ('Logistics & Supply Chain',
   'Manage a logistics company end-to-end. Optimize delivery routes, manage fleet, handle customs, warehouse operations, and client SLAs.',
   'Logistics', 'logistics-supply', 190, 'Advanced', 40, true, 17),

  -- Energy & Engineering
  ('HVAC Systems Engineer',
   'Design and commission HVAC systems for commercial buildings. Handle load calculations, equipment selection, installation planning, and maintenance schedules.',
   'Engineering', 'hvac-systems', 180, 'Advanced', 38, true, 18),

  ('Solar Energy Installation',
   'Plan and execute solar panel installations for residential and commercial clients. Manage site surveys, system design, procurement, and commissioning.',
   'Engineering', 'solar-energy', 170, 'Intermediate', 35, true, 19),

  -- Education & Language
  ('English Language Journey',
   'Guide learners through an immersive English learning experience. Progress through vocabulary, grammar, listening, and conversation challenges.',
   'Education', 'english-journey', 100, 'Beginner', 20, true, 20),

  ('Music Training Academy',
   'Build and manage a music training school. Create lesson plans, assign instruments, track student progress, and organize recitals.',
   'Education', 'music-training', 130, 'Beginner', 22, true, 21),

  -- Finance & Business
  ('Board Room Surgeon',
   'Step into executive-level business decisions. Analyze financial reports, restructure departments, manage stakeholders, and turn around a struggling company.',
   'Business', 'board-surgeon', 220, 'Advanced', 45, true, 22),

  ('Trade Tycoon',
   'Build a global trading empire. Buy low, sell high, navigate tariffs, manage warehouses, and outcompete rivals across international markets.',
   'Business', 'trade-tycoon', 200, 'Advanced', 40, true, 23)

ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  subcategory = EXCLUDED.subcategory,
  points = EXCLUDED.points,
  difficulty = EXCLUDED.difficulty,
  estimated_duration = EXCLUDED.estimated_duration,
  published = EXCLUDED.published,
  sort_order = EXCLUDED.sort_order;
