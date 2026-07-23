export type SpaceKind = "go" | "property" | "railroad" | "utility" | "tax" | "chance" | "community" | "jail" | "free" | "goToJail";
export type ColorGroup = "brown" | "sky" | "pink" | "orange" | "red" | "yellow" | "green" | "navy";

export type BoardSpace = {
  index: number;
  kind: SpaceKind;
  name: string;
  nameAr: string;
  price?: number;
  group?: ColorGroup;
  rent?: number[];
  buildCost?: number;
  tax?: number;
};

export type OwnedProperty = { ownerId: number; buildings: number; mortgaged: boolean };
export type Player = {
  id: number;
  name: string;
  token: string;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  getOutCards: number;
  active: boolean;
  isBot: boolean;
};
export type PendingDecision = { type: "buy"; spaceIndex: number } | null;
export type GameState = {
  version: 1;
  players: Player[];
  currentPlayer: number;
  properties: Record<number, OwnedProperty>;
  dice: [number, number];
  doublesInTurn: number;
  pending: PendingDecision;
  log: string[];
  round: number;
  maxRounds: number | null;
  winnerId: number | null;
  status: "playing" | "finished";
};

const p = (
  index: number, name: string, nameAr: string, price: number, group: ColorGroup,
  baseRent: number, buildCost: number,
): BoardSpace => ({
  index, kind: "property", name, nameAr, price, group, buildCost,
  rent: [baseRent, baseRent * 5, baseRent * 15, baseRent * 45, baseRent * 80, baseRent * 125],
});

export const BOARD: BoardSpace[] = [
  { index: 0, kind: "go", name: "Visionex Gate", nameAr: "بوابة Visionex" },
  p(1, "Beirut Harbor", "مرفأ بيروت", 60, "brown", 2, 50),
  { index: 2, kind: "community", name: "Community Fund", nameAr: "صندوق المجتمع" },
  p(3, "Byblos Avenue", "شارع جبيل", 60, "brown", 4, 50),
  { index: 4, kind: "tax", name: "City Services", nameAr: "خدمات المدينة", tax: 200 },
  { index: 5, kind: "railroad", name: "Levant Express", nameAr: "قطار المشرق", price: 200 },
  p(6, "Cairo Gardens", "حدائق القاهرة", 100, "sky", 6, 50),
  { index: 7, kind: "chance", name: "Opportunity", nameAr: "فرصة" },
  p(8, "Alexandria Corniche", "كورنيش الإسكندرية", 100, "sky", 6, 50),
  p(9, "Amman Heights", "مرتفعات عمّان", 120, "sky", 8, 50),
  { index: 10, kind: "jail", name: "Visiting / Detention", nameAr: "زيارة / احتجاز" },
  p(11, "Istanbul Bazaar", "بازار إسطنبول", 140, "pink", 10, 100),
  { index: 12, kind: "utility", name: "Solar Grid", nameAr: "شبكة الطاقة الشمسية", price: 150 },
  p(13, "Athens Plaza", "ساحة أثينا", 140, "pink", 10, 100),
  p(14, "Rome Quarter", "حي روما", 160, "pink", 12, 100),
  { index: 15, kind: "railroad", name: "Mediterranean Line", nameAr: "خط المتوسط", price: 200 },
  p(16, "Barcelona Walk", "ممشى برشلونة", 180, "orange", 14, 100),
  { index: 17, kind: "community", name: "Community Fund", nameAr: "صندوق المجتمع" },
  p(18, "Paris Arts District", "حي باريس للفنون", 180, "orange", 14, 100),
  p(19, "London Bridge", "جسر لندن", 200, "orange", 16, 100),
  { index: 20, kind: "free", name: "Innovation Park", nameAr: "حديقة الابتكار" },
  p(21, "Berlin Tech Hub", "مركز برلين التقني", 220, "red", 18, 150),
  { index: 22, kind: "chance", name: "Opportunity", nameAr: "فرصة" },
  p(23, "Amsterdam Canal", "قناة أمستردام", 220, "red", 18, 150),
  p(24, "Vienna Boulevard", "جادة فيينا", 240, "red", 20, 150),
  { index: 25, kind: "railroad", name: "Continental Rail", nameAr: "القطار القاري", price: 200 },
  p(26, "Dubai Marina", "مرسى دبي", 260, "yellow", 22, 150),
  p(27, "Doha Pearl", "لؤلؤة الدوحة", 260, "yellow", 22, 150),
  { index: 28, kind: "utility", name: "Smart Water", nameAr: "المياه الذكية", price: 150 },
  p(29, "Riyadh Skyline", "أفق الرياض", 280, "yellow", 24, 150),
  { index: 30, kind: "goToJail", name: "Go to Detention", nameAr: "اذهب إلى الاحتجاز" },
  p(31, "Singapore Bay", "خليج سنغافورة", 300, "green", 26, 200),
  p(32, "Seoul Digital", "سيول الرقمية", 300, "green", 26, 200),
  { index: 33, kind: "community", name: "Community Fund", nameAr: "صندوق المجتمع" },
  p(34, "Tokyo Central", "وسط طوكيو", 320, "green", 28, 200),
  { index: 35, kind: "railroad", name: "Global Hyperloop", nameAr: "هايبرلوب العالمي", price: 200 },
  { index: 36, kind: "chance", name: "Opportunity", nameAr: "فرصة" },
  p(37, "New York Square", "ساحة نيويورك", 350, "navy", 35, 200),
  { index: 38, kind: "tax", name: "Luxury Contribution", nameAr: "مساهمة الرفاهية", tax: 100 },
  p(39, "Visionex Tower", "برج Visionex", 400, "navy", 50, 200),
];

const TOKENS = ["🚗", "🚀", "🐱", "🎩"];
const GROUP_SIZE: Record<ColorGroup, number> = { brown: 2, sky: 3, pink: 3, orange: 3, red: 3, yellow: 3, green: 3, navy: 2 };

export function createGame(botCount = 3, maxRounds: number | null = 50): GameState {
  const names = ["You", "Nova", "Atlas", "Mira"];
  return {
    version: 1,
    players: names.slice(0, botCount + 1).map((name, id) => ({
      id, name, token: TOKENS[id], cash: 1500, position: 0, inJail: false,
      jailTurns: 0, getOutCards: 0, active: true, isBot: id !== 0,
    })),
    currentPlayer: 0, properties: {}, dice: [0, 0], doublesInTurn: 0,
    pending: null, log: ["Welcome to Visionopoly."], round: 1, maxRounds,
    winnerId: null, status: "playing",
  };
}

function addLog(state: GameState, message: string): GameState {
  return { ...state, log: [message, ...state.log].slice(0, 18) };
}

function ownsGroup(state: GameState, playerId: number, group: ColorGroup) {
  const spaces = BOARD.filter((space) => space.group === group);
  return spaces.length === GROUP_SIZE[group] && spaces.every((space) => state.properties[space.index]?.ownerId === playerId);
}

export function calculateRent(state: GameState, space: BoardSpace, diceTotal: number) {
  const owned = state.properties[space.index];
  if (!owned || owned.mortgaged) return 0;
  if (space.kind === "railroad") {
    const count = BOARD.filter((item) => item.kind === "railroad" && state.properties[item.index]?.ownerId === owned.ownerId && !state.properties[item.index]?.mortgaged).length;
    return 25 * (2 ** Math.max(0, count - 1));
  }
  if (space.kind === "utility") {
    const count = BOARD.filter((item) => item.kind === "utility" && state.properties[item.index]?.ownerId === owned.ownerId && !state.properties[item.index]?.mortgaged).length;
    return diceTotal * (count === 2 ? 10 : 4);
  }
  const base = space.rent?.[owned.buildings] ?? 0;
  return owned.buildings === 0 && space.group && ownsGroup(state, owned.ownerId, space.group) ? base * 2 : base;
}

function transfer(state: GameState, fromId: number, toId: number | null, amount: number, reason: string) {
  const players = state.players.map((player) => ({ ...player }));
  const payer = players[fromId];
  const paid = Math.min(Math.max(0, payer.cash), amount);
  payer.cash -= amount;
  if (toId !== null) players[toId].cash += paid;
  let next = addLog({ ...state, players }, `${payer.name} paid $${amount} ${reason}.`);
  if (payer.cash < 0) {
    const properties = { ...next.properties };
    const owned = Object.entries(properties).filter(([, value]) => value.ownerId === fromId);
    for (const [index, value] of owned) {
      if (value.buildings === 0 && !value.mortgaged && payer.cash < 0) {
        const space = BOARD[Number(index)];
        payer.cash += Math.floor((space.price ?? 0) / 2);
        properties[Number(index)] = { ...value, mortgaged: true };
      }
    }
    if (payer.cash < 0) {
      payer.active = false;
      payer.cash = 0;
      for (const [index, value] of Object.entries(properties)) {
        if (value.ownerId === fromId) delete properties[Number(index)];
      }
      next = addLog({ ...next, players, properties }, `${payer.name} is bankrupt.`);
    } else {
      next = addLog({ ...next, players, properties }, `${payer.name} automatically mortgaged property to cover the debt.`);
    }
  }
  return checkWinner(next);
}

function drawCard(state: GameState, playerId: number, community: boolean, random = Math.random) {
  const cards = community
    ? [
        { text: "Creative grant: collect $200.", cash: 200 },
        { text: "Medical bill: pay $50.", cash: -50 },
        { text: "Community award: collect $100.", cash: 100 },
        { text: "Education fund: pay $100.", cash: -100 },
        { text: "Get out of detention free.", jailCard: true },
      ]
    : [
        { text: "Advance to Visionex Gate.", move: 0 },
        { text: "Innovation prize: collect $150.", cash: 150 },
        { text: "Unexpected repair: pay $75.", cash: -75 },
        { text: "Go to detention.", jail: true },
        { text: "Move back three spaces.", back: 3 },
      ];
  const card = cards[Math.floor(random() * cards.length)];
  const players = state.players.map((player) => ({ ...player }));
  const next = addLog({ ...state, players }, `${players[playerId].name}: ${card.text}`);
  if ("cash" in card && card.cash) {
    if (card.cash > 0) players[playerId].cash += card.cash;
    else return transfer(next, playerId, null, -card.cash, "for a card");
  }
  if ("jailCard" in card) players[playerId].getOutCards += 1;
  if ("jail" in card) {
    players[playerId].position = 10; players[playerId].inJail = true; players[playerId].jailTurns = 0;
  }
  if ("move" in card && card.move === 0) {
    if (players[playerId].position !== 0) players[playerId].cash += 200;
    players[playerId].position = 0;
  }
  if ("back" in card && card.back) players[playerId].position = (players[playerId].position + 40 - card.back) % 40;
  return { ...next, players };
}

function land(state: GameState, playerId: number, diceTotal: number, random = Math.random): GameState {
  const player = state.players[playerId];
  const space = BOARD[player.position];
  const owner = state.properties[space.index];
  if ((space.kind === "property" || space.kind === "railroad" || space.kind === "utility") && space.price) {
    if (!owner) return addLog({ ...state, pending: { type: "buy", spaceIndex: space.index } }, `${space.name} is available for $${space.price}.`);
    if (owner.ownerId !== playerId && !owner.mortgaged) {
      const rent = calculateRent(state, space, diceTotal);
      return transfer(state, playerId, owner.ownerId, rent, `rent to ${state.players[owner.ownerId].name}`);
    }
    return addLog(state, `${player.name} landed on their own property.`);
  }
  if (space.kind === "tax") return transfer(state, playerId, null, space.tax ?? 0, "in taxes");
  if (space.kind === "goToJail") {
    const players = state.players.map((item) => ({ ...item }));
    players[playerId].position = 10; players[playerId].inJail = true; players[playerId].jailTurns = 0;
    return addLog({ ...state, players, doublesInTurn: 0 }, `${player.name} was sent to detention.`);
  }
  if (space.kind === "chance") return drawCard(state, playerId, false, random);
  if (space.kind === "community") return drawCard(state, playerId, true, random);
  return addLog(state, `${player.name} landed on ${space.name}.`);
}

export function rollDice(state: GameState, dice: [number, number] = [
  Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1,
], random = Math.random): GameState {
  if (state.status !== "playing" || state.pending) return state;
  const playerId = state.currentPlayer;
  const players = state.players.map((player) => ({ ...player }));
  const player = players[playerId];
  const isDouble = dice[0] === dice[1];
  let next = { ...state, players, dice, doublesInTurn: isDouble ? state.doublesInTurn + 1 : 0 };

  if (player.inJail) {
    if (isDouble) {
      player.inJail = false; player.jailTurns = 0;
      next = addLog(next, `${player.name} rolled doubles and left detention.`);
    } else {
      player.jailTurns += 1;
      if (player.jailTurns < 3) return addLog(next, `${player.name} remains in detention.`);
      player.inJail = false; player.jailTurns = 0;
      next = transfer(next, playerId, null, 50, "to leave detention");
    }
  } else if (next.doublesInTurn >= 3) {
    player.position = 10; player.inJail = true; player.jailTurns = 0;
    return addLog({ ...next, doublesInTurn: 0 }, `${player.name} rolled three doubles and was detained.`);
  }

  const oldPosition = player.position;
  player.position = (player.position + dice[0] + dice[1]) % BOARD.length;
  if (player.position < oldPosition) {
    player.cash += 200;
    next = addLog(next, `${player.name} passed Visionex Gate and collected $200.`);
  }
  next = addLog(next, `${player.name} rolled ${dice[0]} + ${dice[1]}.`);
  return land(next, playerId, dice[0] + dice[1], random);
}

export function buyPending(state: GameState): GameState {
  if (!state.pending) return state;
  const space = BOARD[state.pending.spaceIndex];
  const player = state.players[state.currentPlayer];
  if (!space.price || player.cash < space.price || state.properties[space.index]) return { ...state, pending: null };
  const players = state.players.map((item) => ({ ...item }));
  players[state.currentPlayer].cash -= space.price;
  return addLog({
    ...state, players, pending: null,
    properties: { ...state.properties, [space.index]: { ownerId: state.currentPlayer, buildings: 0, mortgaged: false } },
  }, `${player.name} bought ${space.name} for $${space.price}.`);
}

export function declinePending(state: GameState) {
  return state.pending ? addLog({ ...state, pending: null }, `${state.players[state.currentPlayer].name} declined the property.`) : state;
}

export function canBuild(state: GameState, playerId: number, spaceIndex: number) {
  const space = BOARD[spaceIndex];
  const owned = state.properties[spaceIndex];
  if (!space.group || !owned || owned.ownerId !== playerId || owned.mortgaged || owned.buildings >= 5 || !ownsGroup(state, playerId, space.group)) return false;
  const groupOwned = BOARD.filter((item) => item.group === space.group).map((item) => state.properties[item.index]!);
  return owned.buildings === Math.min(...groupOwned.map((item) => item.buildings));
}

export function buildOn(state: GameState, spaceIndex: number): GameState {
  const playerId = state.currentPlayer;
  const space = BOARD[spaceIndex];
  if (!canBuild(state, playerId, spaceIndex) || !space.buildCost || state.players[playerId].cash < space.buildCost) return state;
  const players = state.players.map((item) => ({ ...item }));
  players[playerId].cash -= space.buildCost;
  const properties = { ...state.properties, [spaceIndex]: { ...state.properties[spaceIndex], buildings: state.properties[spaceIndex].buildings + 1 } };
  return addLog({ ...state, players, properties }, `${players[playerId].name} developed ${space.name}.`);
}

export function sellBuilding(state: GameState, spaceIndex: number): GameState {
  const owned = state.properties[spaceIndex];
  const space = BOARD[spaceIndex];
  if (!owned || owned.ownerId !== state.currentPlayer || owned.buildings <= 0 || !space.group || !space.buildCost) return state;
  const groupOwned = BOARD.filter((item) => item.group === space.group).map((item) => state.properties[item.index]!);
  if (owned.buildings !== Math.max(...groupOwned.map((item) => item.buildings))) return state;
  const players = state.players.map((item) => ({ ...item }));
  players[state.currentPlayer].cash += Math.floor(space.buildCost / 2);
  return addLog({
    ...state, players,
    properties: { ...state.properties, [spaceIndex]: { ...owned, buildings: owned.buildings - 1 } },
  }, `${players[state.currentPlayer].name} sold a development on ${space.name}.`);
}

export function tradeProperty(state: GameState, buyerId: number, spaceIndex: number, offer: number): GameState {
  const owned = state.properties[spaceIndex];
  const buyer = state.players[buyerId];
  if (!owned || owned.ownerId === buyerId || owned.buildings > 0 || owned.mortgaged || offer <= 0 || buyer.cash < offer) return state;
  const sellerId = owned.ownerId;
  const players = state.players.map((item) => ({ ...item }));
  players[buyerId].cash -= offer;
  players[sellerId].cash += offer;
  return addLog({
    ...state, players,
    properties: { ...state.properties, [spaceIndex]: { ...owned, ownerId: buyerId } },
  }, `${players[buyerId].name} traded $${offer} to ${players[sellerId].name} for ${BOARD[spaceIndex].name}.`);
}

export function toggleMortgage(state: GameState, spaceIndex: number): GameState {
  const owned = state.properties[spaceIndex];
  const space = BOARD[spaceIndex];
  if (!owned || owned.ownerId !== state.currentPlayer || owned.buildings > 0 || !space.price) return state;
  const players = state.players.map((item) => ({ ...item }));
  const amount = Math.floor(space.price / 2);
  if (owned.mortgaged) {
    const cost = Math.ceil(amount * 1.1);
    if (players[state.currentPlayer].cash < cost) return state;
    players[state.currentPlayer].cash -= cost;
  } else {
    players[state.currentPlayer].cash += amount;
  }
  return addLog({
    ...state, players,
    properties: { ...state.properties, [spaceIndex]: { ...owned, mortgaged: !owned.mortgaged } },
  }, `${space.name} was ${owned.mortgaged ? "unmortgaged" : "mortgaged"}.`);
}

export function leaveJail(state: GameState, option: "pay" | "card"): GameState {
  const player = state.players[state.currentPlayer];
  if (!player.inJail) return state;
  const players = state.players.map((item) => ({ ...item }));
  if (option === "card" && player.getOutCards > 0) players[state.currentPlayer].getOutCards -= 1;
  else if (option === "pay" && player.cash >= 50) players[state.currentPlayer].cash -= 50;
  else return state;
  players[state.currentPlayer].inJail = false;
  players[state.currentPlayer].jailTurns = 0;
  return addLog({ ...state, players }, `${player.name} left detention.`);
}

function checkWinner(state: GameState): GameState {
  const active = state.players.filter((player) => player.active);
  if (active.length === 1) return { ...state, status: "finished", winnerId: active[0].id };
  return state;
}

export function netWorth(state: GameState, playerId: number) {
  return state.players[playerId].cash + Object.entries(state.properties)
    .filter(([, owned]) => owned.ownerId === playerId)
    .reduce((sum, [index, owned]) => {
      const space = BOARD[Number(index)];
      return sum + (owned.mortgaged ? Math.floor((space.price ?? 0) / 2) : (space.price ?? 0)) + owned.buildings * (space.buildCost ?? 0);
    }, 0);
}

export function endTurn(state: GameState): GameState {
  if (state.status !== "playing" || state.pending) return state;
  const current = state.players[state.currentPlayer];
  if (state.dice[0] === state.dice[1] && !current.inJail && state.doublesInTurn > 0) {
    return addLog({ ...state, dice: [0, 0] }, `${current.name} earned another roll.`);
  }
  let nextId = state.currentPlayer;
  do nextId = (nextId + 1) % state.players.length;
  while (!state.players[nextId].active);
  const wrapped = nextId <= state.currentPlayer;
  const round = state.round + (wrapped ? 1 : 0);
  if (state.maxRounds && round > state.maxRounds) {
    const winner = state.players.filter((player) => player.active).sort((a, b) => netWorth(state, b.id) - netWorth(state, a.id))[0];
    return addLog({ ...state, status: "finished", winnerId: winner.id, round }, `${winner.name} won by net worth.`);
  }
  return { ...state, currentPlayer: nextId, round, dice: [0, 0], doublesInTurn: 0 };
}

export function isValidSavedGame(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<GameState>;
  return state.version === 1 && Array.isArray(state.players) && state.players.length >= 2 && state.players.length <= 4
    && typeof state.currentPlayer === "number" && state.currentPlayer >= 0 && state.currentPlayer < state.players.length
    && state.properties !== null && typeof state.properties === "object"
    && (state.status === "playing" || state.status === "finished");
}
