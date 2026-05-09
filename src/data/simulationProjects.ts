export interface SimProject {
  clientName: string;
  clientLogo: string;
  projectTitle: string;
  scenario: string;
  budget: string;
  timeline: string;
  objectives: string[];
  deliverables: string[];
  tags: string[];
}

export const SIM_PROJECTS: Record<string, SimProject> = {
  "egg-incubator": {
    clientName: "Al-Rashid Poultry Farms",
    clientLogo: "🐔",
    projectTitle: "Egg Incubation Management Project",
    scenario:
      "Al-Rashid Poultry Farms has brought you on as Agricultural Consultant to supervise a critical incubation batch. Starting from Day 1, you will manage 5 fertilized eggs through the full 21-day cycle using a digital incubator. Any deviation from the optimal temperature (37.5°C) and humidity (55%) can result in egg loss. The farm expects a professional operation and a full performance report at the end.",
    budget: "$480",
    timeline: "21 Days",
    objectives: [
      "Maintain temperature within ±1°C of the 37.5°C target at all times",
      "Keep relative humidity consistently between 50% and 60%",
      "Respond immediately to every equipment malfunction",
      "Achieve a minimum hatch rate of 80% (at least 4 out of 5 eggs)",
    ],
    deliverables: [
      "Daily incubator monitoring log",
      "Malfunction incident and repair records",
      "Final hatch rate and overall performance score",
    ],
    tags: ["Agriculture", "Operations", "Quality Control"],
  },

  "network-noc": {
    clientName: "TechCore Data Centers",
    clientLogo: "🖥️",
    projectTitle: "Network Operations Center Management",
    scenario:
      "TechCore Data Centers has assigned you as Network Operations Engineer for a critical infrastructure shift. You will monitor the company's enterprise network in real time, respond to alerts, isolate faults, and maintain service-level agreements across hundreds of business clients. Network downtime has direct financial and reputational consequences — your decisions must be fast and precise.",
    budget: "SLA: 99.9% uptime target",
    timeline: "8-Hour Shift",
    objectives: [
      "Maintain network uptime above 99% throughout the shift",
      "Acknowledge and resolve critical incidents within 5 minutes",
      "Accurately document every alert and the corrective action taken",
      "Escalate unresolvable issues to Tier 3 support with full context",
    ],
    deliverables: [
      "Incident response and resolution log",
      "Network performance summary",
      "End-of-shift operations report",
    ],
    tags: ["Technology", "IT Operations", "Network Engineering"],
  },

  "perfume-lab": {
    clientName: "Lumière Fragrances",
    clientLogo: "🌸",
    projectTitle: "Custom Fragrance Development Project",
    scenario:
      "Lumière Fragrances, a luxury perfume house, has commissioned you as Lead Perfumer and Formulation Chemist. You will develop a new signature fragrance from scratch — selecting base notes, heart notes, and top notes, managing raw material costs, and balancing olfactory complexity with commercial viability. The formula must meet the house's quality standards and come in under the allocated R&D budget.",
    budget: "$2,000",
    timeline: "5 Lab Sessions",
    objectives: [
      "Create a harmonious fragrance with well-defined top, heart, and base notes",
      "Keep total raw material costs within the $2,000 budget",
      "Achieve a consumer acceptance score above 80% in simulated testing",
      "Document the complete formula ready for production scale-up",
    ],
    deliverables: [
      "Fragrance formula specification sheet",
      "Cost of materials analysis",
      "Quality and stability test results",
    ],
    tags: ["Manufacturing", "Chemistry", "Product Development"],
  },

  "english-journey": {
    clientName: "BrightPath Learning Center",
    clientLogo: "📚",
    projectTitle: "English Language Proficiency Program",
    scenario:
      "BrightPath Learning Center has hired you as Curriculum Coach to guide a learner through a structured English language program. You will assess their starting level, design and deliver activities across vocabulary, grammar, and conversation, and track measurable progress. Your curriculum decisions directly shape the learner's outcomes and the center's program completion rates.",
    budget: "$1,200",
    timeline: "8-Week Course",
    objectives: [
      "Accurately assess and document the learner's entry level",
      "Progress through all curriculum modules: vocabulary, grammar, and conversation",
      "Achieve a final assessment score above 75%",
      "Complete all modules within the 8-week timeline",
    ],
    deliverables: [
      "Learner progress tracking report",
      "Module completion records",
      "Final assessment score and level certification",
    ],
    tags: ["Education", "Curriculum Design", "Training"],
  },

  "board-surgeon": {
    clientName: "MedCity General Hospital",
    clientLogo: "🏥",
    projectTitle: "Surgical Operations Management",
    scenario:
      "MedCity General Hospital has brought you in as Operating Room Manager for an intensive day of surgical procedures. You will coordinate surgical teams, manage OR scheduling, prioritize emergency cases, allocate medical resources, and ensure all procedures comply with safety and quality protocols. Every operational decision directly affects patient outcomes.",
    budget: "$50,000 daily facility budget",
    timeline: "Full Operating Day",
    objectives: [
      "Complete all scheduled procedures on time and in the correct sequence",
      "Triage and handle emergency cases with appropriate clinical priority",
      "Enforce sterile protocols across all operating rooms at all times",
      "Achieve zero preventable complications during the shift",
    ],
    deliverables: [
      "OR scheduling and completion report",
      "Resource utilization and allocation summary",
      "Patient outcome and incident log",
    ],
    tags: ["Healthcare", "Operations Management", "Critical Decision Making"],
  },

  "dairy-farm": {
    clientName: "Green Valley Dairy",
    clientLogo: "🐄",
    projectTitle: "Dairy Farm Operations Launch",
    scenario:
      "Green Valley Dairy has tasked you as Farm Manager to launch and operate a new dairy production unit from zero. You will build the herd, establish milking routines, manage animal health, optimize feed programs, and scale output to hit monthly milk yield targets. Every decision you make affects animal welfare, production volume, and farm profitability.",
    budget: "$8,500",
    timeline: "30-Day Launch Period",
    objectives: [
      "Establish a productive herd of healthy dairy cows",
      "Hit the target daily milk yield consistently",
      "Keep feed and veterinary costs within the allocated budget",
      "Maintain an animal health index above 90%",
    ],
    deliverables: [
      "Daily milk production log",
      "Herd health and treatment records",
      "Month-end financial and production analysis",
    ],
    tags: ["Agriculture", "Farm Management", "Operations"],
  },

  "detergent-lab": {
    clientName: "CleanTech Industries",
    clientLogo: "🧪",
    projectTitle: "Industrial Detergent Formulation Project",
    scenario:
      "CleanTech Industries has contracted you as Lead Chemical Engineer to develop a new line of industrial detergent products. You will formulate different variants — heavy-duty, eco-friendly, concentrated — by selecting surfactants, builders, and performance additives. Each formula must pass performance benchmarks, meet safety and environmental regulations, and fall within the production cost target.",
    budget: "$3,000",
    timeline: "6 Lab Phases",
    objectives: [
      "Develop at least 2 distinct detergent variants with different applications",
      "Pass all performance and stability benchmark tests",
      "Meet applicable environmental and safety regulatory requirements",
      "Deliver complete formulation sheets ready for manufacturing",
    ],
    deliverables: [
      "Product formulation specification sheets",
      "Performance test results and quality certificates",
      "Cost-per-unit production analysis",
    ],
    tags: ["Manufacturing", "Chemistry", "Product Development"],
  },

  "barber-salon": {
    clientName: "The Classic Blade Studio",
    clientLogo: "✂️",
    projectTitle: "Barbershop Business Launch",
    scenario:
      "You have been appointed Business Manager for The Classic Blade Studio, a premium barbershop launching in the city. This is a full startup — you will set up the shop layout, hire and schedule barbers, build the service menu and pricing, manage daily client bookings, and establish operations. Your job is to get the business off the ground and profitable within the first month.",
    budget: "$15,000 startup capital",
    timeline: "First 30 Days",
    objectives: [
      "Complete shop setup, staffing, and service menu design",
      "Build an initial loyal client base of 50+ customers",
      "Maintain average client satisfaction above 90%",
      "Achieve break-even by the end of the first month",
    ],
    deliverables: [
      "Business setup and operations checklist",
      "Client booking and revenue log",
      "Month-end financial performance summary",
    ],
    tags: ["Business", "Service Industry", "Entrepreneurship"],
  },

  "global-kitchen": {
    clientName: "World Flavors Catering Co.",
    clientLogo: "👨‍🍳",
    projectTitle: "International Cuisine Restaurant Launch",
    scenario:
      "World Flavors Catering Co. has appointed you Executive Chef and Operations Manager to open a new international cuisine kitchen. You will plan multi-course menus spanning different national cuisines, source ingredients, manage kitchen brigade, control food costs, and deliver exceptional dining experiences from opening day. Both culinary creativity and operational discipline are required.",
    budget: "$12,000",
    timeline: "Restaurant Opening Week",
    objectives: [
      "Design a balanced international menu with appetizers, mains, and desserts",
      "Control food cost below 32% of projected revenue",
      "Achieve a customer satisfaction score above 85%",
      "Complete the opening week with positive performance metrics",
    ],
    deliverables: [
      "Finalized menu with costing breakdown",
      "Food cost and waste analysis",
      "Opening week customer feedback summary",
    ],
    tags: ["Food & Beverage", "Operations", "Culinary Arts"],
  },

  "skin-care-lab": {
    clientName: "GlowSci Cosmetics",
    clientLogo: "💄",
    projectTitle: "Skincare Product Line Development",
    scenario:
      "GlowSci Cosmetics has brought you in as Cosmetic Formulation Specialist to develop a new science-backed skincare line. You will research active ingredients, create formulas tailored to different skin types, run stability and compatibility tests, and prepare full documentation for regulatory submission. The products must be both clinically effective and commercially viable.",
    budget: "$4,500",
    timeline: "8 Development Phases",
    objectives: [
      "Formulate at least 3 distinct skincare products for different skin types",
      "All products must pass stability and dermatological safety tests",
      "Achieve an efficacy rating above 80% across all formulas",
      "Complete the full regulatory documentation package",
    ],
    deliverables: [
      "Product formulation dossiers",
      "Safety, stability, and efficacy test reports",
      "Ingredient specification and INCI listing sheets",
    ],
    tags: ["Manufacturing", "Cosmetics", "R&D"],
  },

  "poultry-farm": {
    clientName: "SunRise Poultry Group",
    clientLogo: "🐓",
    projectTitle: "Commercial Poultry Farm Operations",
    scenario:
      "SunRise Poultry Group has assigned you as Farm Operations Manager for a commercial broiler production cycle. You will manage a flock from day-old chick arrival through to market weight, making daily decisions on feeding programs, health interventions, lighting schedules, ventilation, and harvest timing. Profitability depends on your ability to minimize mortality and optimize feed conversion.",
    budget: "$6,000",
    timeline: "42-Day Grow Cycle",
    objectives: [
      "Bring the flock to target market weight within the grow period",
      "Keep mortality rate below 5% across the entire cycle",
      "Optimize the feed conversion ratio (FCR) to industry benchmark",
      "Deliver a full harvest batch to market on schedule",
    ],
    deliverables: [
      "Daily flock performance and mortality log",
      "Feed consumption and FCR report",
      "Final batch profitability and performance analysis",
    ],
    tags: ["Agriculture", "Livestock", "Operations"],
  },

  "chocolate-factory": {
    clientName: "Artisan Cacao Works",
    clientLogo: "🍫",
    projectTitle: "Artisan Chocolate Production Line",
    scenario:
      "Artisan Cacao Works has hired you as Production Manager to establish and run a premium chocolate manufacturing line from raw cacao through to finished product. You will oversee roasting, winnowing, grinding, conching, tempering, and molding, maintaining strict quality standards at every stage. Weekly output targets must be met while controlling production costs and maintaining the house's premium quality standard.",
    budget: "$7,000",
    timeline: "Weekly Production Cycles",
    objectives: [
      "Successfully execute the complete bean-to-bar production process",
      "Maintain batch quality scores above 90% at every stage",
      "Meet or exceed weekly output targets",
      "Keep production cost per unit within the budget allocation",
    ],
    deliverables: [
      "Batch production and process control records",
      "Quality control inspection certificates",
      "Weekly output, cost, and margin report",
    ],
    tags: ["Food Manufacturing", "Quality Control", "Production Management"],
  },

  "cattle-dairy": {
    clientName: "Horizon Ranch & Dairy",
    clientLogo: "🐂",
    projectTitle: "Integrated Cattle & Dairy Ranch Operations",
    scenario:
      "Horizon Ranch & Dairy has appointed you Ranch Operations Director to manage a dual-purpose cattle operation producing both beef and dairy. You will oversee herd health, breeding programs, milking schedules, pasture rotation, and feed optimization across a complex, interconnected operation. Balancing two production streams demands careful resource planning and animal welfare prioritization.",
    budget: "$20,000",
    timeline: "Quarterly Operation",
    objectives: [
      "Maintain overall herd health index above 85%",
      "Hit monthly milk production targets consistently",
      "Execute the breeding program and achieve herd expansion targets",
      "Optimize pasture usage and feed costs within budget",
    ],
    deliverables: [
      "Herd health and production performance report",
      "Breeding, calving, and growth records",
      "Quarterly financial and operational summary",
    ],
    tags: ["Agriculture", "Livestock Management", "Operations"],
  },

  "mobile-repair": {
    clientName: "FastFix Mobile Solutions",
    clientLogo: "📱",
    projectTitle: "Mobile Device Repair Workshop Launch",
    scenario:
      "FastFix Mobile Solutions has contracted you as Lead Technician and Workshop Manager to launch a professional mobile device repair center. You will diagnose and repair a range of device faults — cracked screens, batteries, charging ports, motherboards — while managing parts inventory, repair turnaround times, and customer communications. Your reputation for quality and speed is the business's most valuable asset.",
    budget: "$5,000 initial parts inventory",
    timeline: "First Month Operations",
    objectives: [
      "Accurately diagnose all incoming device faults",
      "Maintain average repair turnaround time under 48 hours",
      "Achieve a customer satisfaction score above 90%",
      "Keep parts sourcing costs within the inventory budget",
    ],
    deliverables: [
      "Repair job log with diagnosis, parts, and resolution details",
      "Parts inventory usage and reorder report",
      "Monthly customer satisfaction and revenue summary",
    ],
    tags: ["Technology", "Technical Services", "Workshop Management"],
  },

  "sheep-farm": {
    clientName: "Highlands Wool & Meat Co.",
    clientLogo: "🐑",
    projectTitle: "Sheep Farm Management Project",
    scenario:
      "Highlands Wool & Meat Co. has assigned you as Farm Manager for a dual-production sheep operation generating both wool and meat. You will manage flock nutrition, health monitoring, shearing cycles, lambing season, and market timing across the seasonal production cycle. The right decisions at each stage determine both animal welfare outcomes and farm profitability.",
    budget: "$9,000",
    timeline: "Full Seasonal Cycle",
    objectives: [
      "Maintain flock health and body condition above 85%",
      "Complete the shearing season and reach wool yield targets",
      "Manage lambing with a lamb survival rate above 90%",
      "Achieve profitability targets across both wool and meat revenue streams",
    ],
    deliverables: [
      "Flock management and health monitoring report",
      "Shearing production records and wool yield",
      "Seasonal profit and loss summary",
    ],
    tags: ["Agriculture", "Livestock", "Agribusiness"],
  },

  "logistics-supply": {
    clientName: "SwiftRoute Logistics Corp",
    clientLogo: "🚛",
    projectTitle: "Supply Chain & Distribution Management",
    scenario:
      "SwiftRoute Logistics Corp has brought you on as Supply Chain Manager to optimize their regional distribution network. You will manage warehouse operations, plan delivery routes, allocate fleet resources, set inventory replenishment levels, and process corporate client orders — all against tight SLA timelines. Minimizing cost while maximizing on-time delivery is the core challenge.",
    budget: "$30,000 operational budget",
    timeline: "Monthly Operations",
    objectives: [
      "Achieve 95%+ on-time delivery rate across all client orders",
      "Optimize route planning to reduce fuel and vehicle costs by 15%",
      "Maintain warehouse inventory accuracy above 98%",
      "Process every client order within the contracted SLA window",
    ],
    deliverables: [
      "Route optimization analysis and implementation report",
      "Delivery performance and on-time rate dashboard",
      "Monthly cost savings and operational efficiency analysis",
    ],
    tags: ["Logistics", "Supply Chain", "Operations Management"],
  },

  "hvac-systems": {
    clientName: "ComfortZone Engineering",
    clientLogo: "❄️",
    projectTitle: "HVAC System Installation & Commissioning",
    scenario:
      "ComfortZone Engineering has assigned you as HVAC Project Engineer to design, install, and commission a complete heating, ventilation, and air conditioning system for a commercial building. Starting from the load calculation and equipment selection, you will plan ductwork layouts, coordinate installation crews, manage subcontractors, and perform full commissioning tests before client handover.",
    budget: "$45,000",
    timeline: "4-Week Installation",
    objectives: [
      "Complete system design within engineering specifications and load calculations",
      "Install all components in compliance with local building code",
      "Commission the system and verify it meets design performance targets",
      "Deliver full as-built drawings and documentation to the client",
    ],
    deliverables: [
      "System design drawings and equipment schedule",
      "Installation completion and inspection report",
      "Commissioning and performance test results",
      "Client handover package with O&M manual",
    ],
    tags: ["Engineering", "Construction", "HVAC"],
  },

  "aluminum-glazing": {
    clientName: "Premier Glass & Aluminum Ltd",
    clientLogo: "🪟",
    projectTitle: "Aluminum Glazing Project Execution",
    scenario:
      "Premier Glass & Aluminum Ltd has assigned you as Project Foreman for a commercial aluminum glazing package on a new office building. You will manage fabrication of aluminum profiles and curtain wall panels, coordinate installation crews on site, quality-check every unit before installation, and ensure the completed work achieves water and air tightness certification. The project must finish on schedule and within budget with zero safety incidents.",
    budget: "$55,000",
    timeline: "6-Week Project",
    objectives: [
      "Fabricate all aluminum and glass units to exact shop drawing specifications",
      "Complete installation on programme with zero recordable safety incidents",
      "Pass water tightness and air infiltration tests to the specified standard",
      "Hand over the completed works with full as-built documentation",
    ],
    deliverables: [
      "Shop drawings and fabrication quality records",
      "Site installation progress and inspection log",
      "Water and air tightness test certificates",
      "Project handover and close-out report",
    ],
    tags: ["Construction", "Manufacturing", "Project Management"],
  },

  "solar-energy": {
    clientName: "SolarMax Renewables",
    clientLogo: "☀️",
    projectTitle: "Solar Energy System Design & Installation",
    scenario:
      "SolarMax Renewables has commissioned you as Solar Energy Project Engineer to design, install, and commission a grid-tied photovoltaic system for a commercial facility. You will conduct a site energy audit, size the solar array and inverter capacity, specify mounting structures, manage the installation team, and commission the system — verifying that energy production meets the projections used in the client's investment model.",
    budget: "$75,000",
    timeline: "8-Week Project",
    objectives: [
      "Design a solar array that offsets at least 80% of the facility's energy consumption",
      "Complete installation fully compliant with electrical and building codes",
      "Commission the system and verify actual vs. projected energy output",
      "Deliver a detailed ROI and payback period report to the client",
    ],
    deliverables: [
      "Solar system design and single-line diagram",
      "Installation completion and electrical inspection certificate",
      "System performance monitoring dashboard setup",
      "Client ROI and energy savings projection report",
    ],
    tags: ["Renewable Energy", "Engineering", "Installation"],
  },

  "woodworking": {
    clientName: "Craftsmen Workshop Studio",
    clientLogo: "🪵",
    projectTitle: "Custom Furniture Production Workshop",
    scenario:
      "Craftsmen Workshop Studio has hired you as Workshop Production Manager to operate a custom furniture fabrication business. You will receive client orders, select appropriate timber species and hardware, plan production sequences, manage CNC and hand tool operations, apply finishes, and deliver completed pieces that meet the studio's quality standards. Every job demands balancing craftsmanship, material efficiency, and schedule.",
    budget: "$12,000",
    timeline: "Monthly Production Cycle",
    objectives: [
      "Deliver all client orders to full specification and on schedule",
      "Maintain a quality defect and rework rate below 5%",
      "Optimize material yield and minimize off-cut waste",
      "Hit the monthly revenue target and keep costs within budget",
    ],
    deliverables: [
      "Production order and job card log",
      "Timber and materials usage efficiency report",
      "Quality inspection and customer sign-off records",
      "Monthly production revenue and profit summary",
    ],
    tags: ["Manufacturing", "Craftsmanship", "Workshop Management"],
  },

  "trade-tycoon": {
    clientName: "Meridian Trading House",
    clientLogo: "📈",
    projectTitle: "International Trade Portfolio Management",
    scenario:
      "Meridian Trading House has appointed you Trade Manager to build and manage an international commodity trading portfolio from scratch. You will analyze market trends, source profitable commodities, negotiate purchase and sale contracts, manage import/export logistics, and grow your trading capital across 12 trading cycles. Every transaction involves risk assessment, market timing, and financial calculation.",
    budget: "$10,000 seed capital",
    timeline: "12 Trading Cycles",
    objectives: [
      "Grow the trading capital by a minimum of 50% across all cycles",
      "Execute successful trades across at least 3 different commodity categories",
      "Maintain a trade win rate above 60%",
      "Develop and document at least 2 reliable supplier/buyer relationships",
    ],
    deliverables: [
      "Trade execution journal with buy/sell rationale",
      "Portfolio performance and return analysis",
      "Risk assessment log for each commodity traded",
      "Final profit and loss statement",
    ],
    tags: ["Business", "Trading", "Finance"],
  },

  "laptop-repair": {
    clientName: "TechRevive Repair Centers",
    clientLogo: "💻",
    projectTitle: "Laptop Repair & Refurbishment Workshop",
    scenario:
      "TechRevive Repair Centers has appointed you Lead Technician and Workshop Manager to run a professional laptop repair and refurbishment service. You will diagnose hardware and software faults across various brands and models, perform component-level repairs, manage spare parts sourcing, and maintain strict quality control before returning devices to customers. Diagnostic accuracy and first-time fix rate are the metrics that define your workshop's reputation.",
    budget: "$8,000 parts budget",
    timeline: "Monthly Operations",
    objectives: [
      "Accurately diagnose all incoming laptop faults on first assessment",
      "Achieve a first-time fix rate above 85%",
      "Return all repaired devices to customers within 72 hours",
      "Keep parts sourcing costs within the monthly budget allocation",
    ],
    deliverables: [
      "Diagnostic and repair job sheets for every device",
      "Parts usage and procurement report",
      "Quality control pre-delivery checklist",
      "Monthly workshop performance and revenue summary",
    ],
    tags: ["Technology", "Technical Services", "IT Hardware"],
  },

  "music-training": {
    clientName: "Harmony Academy of Music",
    clientLogo: "🎵",
    projectTitle: "Music Training Program Development",
    scenario:
      "Harmony Academy of Music has engaged you as Program Director to design and deliver a structured music training program for a new student cohort. You will assess student entry levels, develop a progressive curriculum covering theory, instrument technique, ear training, and performance practice, manage weekly lesson schedules, monitor individual progress, and lead students through to a final recital.",
    budget: "$6,000",
    timeline: "10-Week Program",
    objectives: [
      "Design and deliver a complete, progressive music curriculum",
      "Guide each student through all skill development modules",
      "Achieve an average student performance score above 80% by end of program",
      "Successfully stage the end-of-program recital",
    ],
    deliverables: [
      "Full curriculum plan and lesson schedule",
      "Individual student progress tracking reports",
      "Final recital performance evaluation and outcomes summary",
    ],
    tags: ["Education", "Arts", "Training Program Management"],
  },
};
