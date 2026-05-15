import { useAmbientSound, getSimulationAmbient } from "@/hooks/useAmbientSound";

interface SceneConfig {
  gradient: string;
  particles: string[];
  label: string;
  overlay: string;
}

const CONFIGS: Record<string, SceneConfig> = {
  "poultry-farm": {
    gradient: "from-amber-600 via-orange-500 to-yellow-400",
    particles: ["🐔", "🥚", "🌾", "🐤", "🌽", "🐔", "🥚", "🌾"],
    label: "🐔 Poultry Farm",
    overlay: "from-amber-900/40 to-transparent",
  },
  "dairy-farm": {
    gradient: "from-emerald-700 via-green-500 to-teal-400",
    particles: ["🐄", "🥛", "🌿", "💧", "🌾", "🐄", "🥛", "🌱"],
    label: "🐄 Dairy Farm",
    overlay: "from-emerald-900/50 to-transparent",
  },
  "cattle-dairy": {
    gradient: "from-green-700 via-lime-500 to-emerald-400",
    particles: ["🐄", "🌾", "🥛", "🌱", "☀️", "🐄", "🌿", "🌾"],
    label: "🐄 Cattle Farm",
    overlay: "from-green-900/50 to-transparent",
  },
  "sheep-farm": {
    gradient: "from-sky-600 via-green-500 to-emerald-400",
    particles: ["🐑", "✂️", "🧶", "🌿", "🏔️", "🐑", "🌾", "☁️"],
    label: "🐑 Sheep Farm",
    overlay: "from-sky-900/40 to-transparent",
  },
  "egg-incubator": {
    gradient: "from-amber-500 via-yellow-400 to-orange-300",
    particles: ["🥚", "🐣", "🌡️", "🔆", "🐤", "🥚", "🐣", "✨"],
    label: "🥚 Egg Incubator",
    overlay: "from-amber-900/40 to-transparent",
  },
  "global-kitchen": {
    gradient: "from-red-600 via-orange-500 to-yellow-400",
    particles: ["👨‍🍳", "🍳", "🔥", "🫕", "🌶️", "🍽️", "🧅", "🔥"],
    label: "👨‍🍳 Global Kitchen",
    overlay: "from-red-900/50 to-transparent",
  },
  "chocolate-factory": {
    gradient: "from-amber-900 via-yellow-700 to-amber-500",
    particles: ["🍫", "🎂", "🌡️", "✨", "🍬", "🍫", "🍮", "🌡️"],
    label: "🍫 Chocolate Factory",
    overlay: "from-amber-950/50 to-transparent",
  },
  "perfume-lab": {
    gradient: "from-purple-700 via-pink-500 to-rose-400",
    particles: ["🌸", "🧪", "✨", "💜", "🌺", "🌷", "✨", "🧪"],
    label: "🌸 Perfume Lab",
    overlay: "from-purple-900/50 to-transparent",
  },
  "detergent-lab": {
    gradient: "from-blue-600 via-cyan-500 to-teal-400",
    particles: ["🧪", "🫧", "💧", "⚗️", "🔬", "🫧", "💧", "🧪"],
    label: "⚗️ Detergent Lab",
    overlay: "from-blue-900/50 to-transparent",
  },
  "skin-care-lab": {
    gradient: "from-rose-500 via-pink-400 to-fuchsia-300",
    particles: ["🌿", "💎", "✨", "🌸", "💆‍♀️", "🌺", "✨", "💧"],
    label: "✨ Skin Care Lab",
    overlay: "from-rose-900/40 to-transparent",
  },
  "board-surgeon": {
    gradient: "from-teal-700 via-emerald-600 to-green-500",
    particles: ["🔌", "💻", "⚡", "🔧", "🖥️", "💡", "⚙️", "🔌"],
    label: "🔧 Electronics Repair",
    overlay: "from-teal-900/50 to-transparent",
  },
  "barber-salon": {
    gradient: "from-slate-700 via-zinc-600 to-stone-500",
    particles: ["✂️", "💈", "👤", "🪞", "💇", "✂️", "🪥", "💈"],
    label: "✂️ Barber Salon",
    overlay: "from-slate-900/50 to-transparent",
  },
  "woodworking": {
    gradient: "from-amber-800 via-yellow-700 to-orange-500",
    particles: ["🪵", "🔨", "🪚", "🌲", "🪑", "🪵", "⚙️", "🔨"],
    label: "🪵 Woodworking",
    overlay: "from-amber-950/50 to-transparent",
  },
  "hvac-systems": {
    gradient: "from-blue-700 via-sky-500 to-cyan-400",
    particles: ["❄️", "🌡️", "💨", "🔧", "⚙️", "❄️", "🌬️", "🔧"],
    label: "❄️ HVAC Systems",
    overlay: "from-blue-900/50 to-transparent",
  },
  "aluminum-glazing": {
    gradient: "from-slate-600 via-blue-500 to-sky-400",
    particles: ["🪟", "🔧", "⚙️", "✨", "🏗️", "🪟", "⚙️", "🔩"],
    label: "🪟 Glazing Workshop",
    overlay: "from-slate-900/50 to-transparent",
  },
  "solar-energy": {
    gradient: "from-yellow-500 via-orange-400 to-amber-300",
    particles: ["☀️", "⚡", "🔋", "🌤️", "🌞", "☀️", "⚡", "🌿"],
    label: "☀️ Solar Energy",
    overlay: "from-yellow-900/40 to-transparent",
  },
  "mobile-repair": {
    gradient: "from-slate-700 via-blue-600 to-indigo-500",
    particles: ["📱", "🔧", "⚡", "🔌", "🔋", "📱", "⚙️", "🔧"],
    label: "📱 Mobile Repair",
    overlay: "from-slate-900/50 to-transparent",
  },
  "laptop-repair": {
    gradient: "from-gray-700 via-slate-600 to-blue-500",
    particles: ["💻", "🔧", "⚙️", "🖥️", "🖱️", "💻", "🔌", "⚙️"],
    label: "💻 Laptop Repair",
    overlay: "from-gray-900/50 to-transparent",
  },
  "network-noc": {
    gradient: "from-blue-900 via-cyan-700 to-teal-500",
    particles: ["🌐", "📡", "⚡", "💻", "🖧", "🌐", "📶", "⚡"],
    label: "🌐 Network NOC",
    overlay: "from-blue-950/60 to-transparent",
  },
  "logistics-supply": {
    gradient: "from-orange-600 via-amber-500 to-yellow-400",
    particles: ["📦", "🚚", "✈️", "🚢", "🗺️", "📦", "🚛", "✈️"],
    label: "📦 Logistics",
    overlay: "from-orange-900/50 to-transparent",
  },
  "trade-tycoon": {
    gradient: "from-emerald-700 via-green-500 to-yellow-400",
    particles: ["📈", "💰", "🏪", "💹", "💎", "📈", "🪙", "💰"],
    label: "📈 Trade Market",
    overlay: "from-emerald-900/50 to-transparent",
  },
  "english-journey": {
    gradient: "from-blue-600 via-indigo-500 to-purple-400",
    particles: ["✈️", "🗺️", "📚", "💬", "🎯", "✈️", "📖", "🌍"],
    label: "✈️ English Journey",
    overlay: "from-blue-900/50 to-transparent",
  },
  "music-training": {
    gradient: "from-purple-700 via-fuchsia-500 to-pink-400",
    particles: ["🎵", "🎸", "🎹", "🎼", "🎶", "🎵", "🎤", "🎸"],
    label: "🎵 Music Academy",
    overlay: "from-purple-900/50 to-transparent",
  },
};

const PARTICLE_POSITIONS = [8, 16, 27, 38, 50, 62, 74, 85];
const PARTICLE_DURATIONS = [3.2, 4.1, 3.6, 4.8, 3.9, 4.4, 3.3, 4.7];
const PARTICLE_DELAYS    = [0, 0.6, 1.2, 0.3, 1.8, 0.9, 1.5, 0.2];
const PARTICLE_SIZES     = ["1.4rem", "1.2rem", "1.5rem", "1.1rem", "1.6rem", "1.3rem", "1.2rem", "1.4rem"];

export function SimulationScene({ slug }: { slug: string }) {
  const config = CONFIGS[slug] ?? CONFIGS["global-kitchen"];
  useAmbientSound(getSimulationAmbient(slug));

  return (
    <div
      className={`relative w-full h-28 rounded-2xl overflow-hidden mb-5 bg-gradient-to-r ${config.gradient}`}
      aria-hidden="true"
    >
      {/* Dark overlay for label readability */}
      <div className={`absolute inset-0 bg-gradient-to-b ${config.overlay}`} />

      {/* Floating particles */}
      {config.particles.map((emoji, i) => (
        <span
          key={i}
          className="absolute select-none pointer-events-none"
          style={{
            left: `${PARTICLE_POSITIONS[i]}%`,
            bottom: "4px",
            fontSize: PARTICLE_SIZES[i],
            animation: `sim-drift ${PARTICLE_DURATIONS[i]}s ${PARTICLE_DELAYS[i]}s ease-in-out infinite`,
          }}
        >
          {emoji}
        </span>
      ))}

      {/* Swaying background icons (large, faint) */}
      <span
        className="absolute right-4 top-2 text-5xl opacity-10 select-none pointer-events-none"
        style={{ animation: "sim-sway 4s ease-in-out infinite" }}
      >
        {config.particles[0]}
      </span>
      <span
        className="absolute left-4 top-3 text-4xl opacity-10 select-none pointer-events-none"
        style={{ animation: "sim-sway 5s 1s ease-in-out infinite" }}
      >
        {config.particles[2]}
      </span>

      {/* Label */}
      <div className="absolute bottom-3 left-4">
        <span className="text-white font-bold text-sm drop-shadow-lg tracking-wide">
          {config.label}
        </span>
      </div>
    </div>
  );
}
