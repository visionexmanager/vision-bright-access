-- ================================================================
-- Add 18 Service Consultation Simulations to the simulations table
-- These are AI-powered consultation simulations that replace the
-- former "Support Services" section in the Professional Services area.
-- They use the standard 250 VX / 15-min billing (chargeDuringTrial).
-- ================================================================

INSERT INTO public.simulations
  (slug, title, description, difficulty, points, estimated_duration, subcategory, published, sort_order)
VALUES
  (
    'svc-hair-care',
    'Hair Care Studio',
    'Consult an AI hair stylist for personalized styling advice, treatment plans, and care routines tailored to your hair type.',
    'Beginner', 150, 30, 'lifestyle', true, 100
  ),
  (
    'svc-skin-care',
    'Skin Care Clinic',
    'Get expert AI guidance on skincare routines, ingredient selection, and treatments tailored to your skin type and concerns.',
    'Beginner', 200, 30, 'lifestyle', true, 101
  ),
  (
    'svc-social-guide',
    'Social Skills Advisor',
    'Develop your social skills and emotional intelligence through AI coaching sessions and real-world scenario practice.',
    'Beginner', 250, 30, 'lifestyle', true, 102
  ),
  (
    'svc-delivery',
    'VisionEx Express Hub',
    'Simulate urban delivery operations: route planning, driver coordination, fleet management, and logistics optimization.',
    'Intermediate', 350, 45, 'business', true, 103
  ),
  (
    'svc-shared-trip',
    'Shared Trip Planner',
    'Plan and coordinate shared trips with AI covering routes, cost splitting, group logistics, and travel arrangements.',
    'Beginner', 150, 30, 'lifestyle', true, 104
  ),
  (
    'svc-sports-coach',
    'Sports & Fitness Studio',
    'Train with an AI fitness coach: customized workout plans, nutrition tips, recovery strategies, and performance tracking.',
    'Beginner', 300, 45, 'lifestyle', true, 105
  ),
  (
    'svc-empathy-oasis',
    'Universal Empathy Oasis',
    'A safe, compassionate AI space for emotional wellness. Share your feelings and receive non-judgmental guidance.',
    'Beginner', 300, 30, 'lifestyle', true, 106
  ),
  (
    'svc-nutrition',
    'Nutrition Wellness Clinic',
    'Receive a personalized nutrition plan and dietary advice aligned with your health goals and lifestyle.',
    'Intermediate', 400, 45, 'lifestyle', true, 107
  ),
  (
    'svc-medical',
    'Virtual Medical Clinic',
    'Discuss symptoms and get health guidance in a private virtual clinic with an AI general practitioner.',
    'Intermediate', 450, 45, 'lifestyle', true, 108
  ),
  (
    'svc-psychology',
    'Psychology & Mental Wellness',
    'Explore your thoughts and emotions with an AI mental health practitioner using evidence-based psychological support.',
    'Intermediate', 500, 60, 'lifestyle', true, 109
  ),
  (
    'svc-travel-agency',
    'Global Travel Planner',
    'Design your perfect trip with an AI travel expert: destinations, itineraries, budgets, visa requirements, and bookings.',
    'Intermediate', 500, 60, 'business', true, 110
  ),
  (
    'svc-music',
    'Music Conservatory Studio',
    'Learn music theory, instrument technique, and composition with an AI conservatory instructor at your skill level.',
    'Intermediate', 500, 60, 'creative', true, 111
  ),
  (
    'svc-studio',
    'Global Creative Studio',
    'Collaborate with an AI creative director on media projects, content strategy, and production planning.',
    'Intermediate', 550, 60, 'creative', true, 112
  ),
  (
    'svc-legal',
    'Legal Advisory Office',
    'Get clear, practical legal guidance on contracts, rights, business law, and personal legal matters from an AI advisor.',
    'Advanced', 650, 60, 'business', true, 113
  ),
  (
    'svc-radar-ai',
    'AI Intelligence Radar',
    'Use AI intelligence scanning to analyze data, detect trends, identify risks, and drive strategic decisions.',
    'Advanced', 700, 60, 'business', true, 114
  ),
  (
    'svc-economy',
    'VX Economic Ecosystem',
    'Explore VX economic models, market dynamics, investment strategies, and identify growth opportunities.',
    'Advanced', 750, 60, 'business', true, 115
  ),
  (
    'svc-career',
    'Career Development Hub',
    'Accelerate your career with AI coaching, resume guidance, interview preparation, and job market insights.',
    'Advanced', 800, 60, 'business', true, 116
  ),
  (
    'svc-edu-empire',
    'Global Educational Empire',
    'Build world-class educational programs with AI guidance on curriculum design, operations, and global strategy.',
    'Advanced', 1000, 60, 'creative', true, 117
  )
ON CONFLICT (slug) DO NOTHING;
