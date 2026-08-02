export const ACCESSIBLE_GAME_PRODUCTION_PLAN = [
  { id:"audio-memory", name:"Audio Memory Game", mode:"sound memory", status:"blocked", blocker:"licensed realistic sound set" },
  { id:"sound-direction", name:"Sound Direction Game", mode:"spatial audio", status:"blocked", blocker:"approved HRTF direction cues and real-device listening tests" },
  { id:"audio-adventure", name:"Audio Adventure", mode:"narrative choices", status:"blocked", blocker:"human narration and licensed environmental effects" },
  { id:"voice-quiz", name:"Voice Quiz", mode:"spoken questions", status:"blocked", blocker:"human multilingual question recordings" },
  { id:"typing-speed", name:"Typing Challenge", mode:"keyboard and live status", status:"development", blocker:"complete gameplay and assistive-technology user test" },
] as const;
