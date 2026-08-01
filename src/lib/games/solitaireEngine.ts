export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
export const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠",
};
export const RANK_LABEL = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export interface Card {
  id: string;
  suit: Suit;
  /** 1 = Ace … 13 = King. */
  rank: number;
  faceUp: boolean;
}

export interface GameState {
  stock: Card[];
  waste: Card[];
  foundations: Record<Suit, Card[]>;
  tableau: Card[][];
  moves: number;
}

/** Source of a drag/click, used by `moveTo` to find the card being played. */
export type Source =
  | { pile: "waste" }
  | { pile: "foundation"; suit: Suit }
  | { pile: "tableau"; column: number; index: number };

export type Target =
  | { pile: "foundation"; suit: Suit }
  | { pile: "tableau"; column: number };

export function isRed(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({ id: `${suit}-${rank}`, suit, rank, faceUp: false });
    }
  }
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function createGame(): GameState {
  const deck = buildDeck();
  const tableau: Card[][] = [];

  for (let column = 0; column < 7; column += 1) {
    const pile = deck.splice(0, column + 1);
    pile[pile.length - 1].faceUp = true;
    tableau.push(pile);
  }

  return {
    stock: deck,
    waste: [],
    foundations: { hearts: [], diamonds: [], clubs: [], spades: [] },
    tableau,
    moves: 0,
  };
}

function clone(state: GameState): GameState {
  return {
    stock: [...state.stock],
    waste: [...state.waste],
    foundations: {
      hearts: [...state.foundations.hearts],
      diamonds: [...state.foundations.diamonds],
      clubs: [...state.foundations.clubs],
      spades: [...state.foundations.spades],
    },
    tableau: state.tableau.map((pile) => [...pile]),
    moves: state.moves,
  };
}

/** Turns one card from stock to waste; recycles the waste when stock runs out. */
export function drawFromStock(state: GameState): GameState {
  const next = clone(state);
  if (next.stock.length === 0) {
    if (next.waste.length === 0) return state;
    next.stock = next.waste.reverse().map((card) => ({ ...card, faceUp: false }));
    next.waste = [];
  } else {
    const card = next.stock.pop() as Card;
    next.waste.push({ ...card, faceUp: true });
  }
  next.moves += 1;
  return next;
}

export function canStackOnFoundation(card: Card, foundation: Card[]): boolean {
  const top = foundation[foundation.length - 1];
  return top ? card.rank === top.rank + 1 : card.rank === 1;
}

export function canStackOnTableau(card: Card, pile: Card[]): boolean {
  const top = pile[pile.length - 1];
  if (!top) return card.rank === 13;
  return top.faceUp && isRed(top.suit) !== isRed(card.suit) && card.rank === top.rank - 1;
}

/** Cards taken from a source — a tableau click carries the whole face-up run below it. */
function takeFrom(state: GameState, source: Source): Card[] | null {
  if (source.pile === "waste") {
    const card = state.waste[state.waste.length - 1];
    return card ? [card] : null;
  }
  if (source.pile === "foundation") {
    const card = state.foundations[source.suit][state.foundations[source.suit].length - 1];
    return card ? [card] : null;
  }
  const pile = state.tableau[source.column];
  if (!pile || source.index < 0 || source.index >= pile.length) return null;
  const run = pile.slice(source.index);
  return run.every((card) => card.faceUp) ? run : null;
}

function removeFrom(state: GameState, source: Source, count: number): void {
  if (source.pile === "waste") { state.waste.splice(state.waste.length - count, count); return; }
  if (source.pile === "foundation") { state.foundations[source.suit].splice(state.foundations[source.suit].length - count, count); return; }
  const pile = state.tableau[source.column];
  pile.splice(pile.length - count, count);
  const exposed = pile[pile.length - 1];
  if (exposed && !exposed.faceUp) exposed.faceUp = true;
}

export function moveTo(state: GameState, source: Source, target: Target): GameState {
  const cards = takeFrom(state, source);
  if (!cards || cards.length === 0) return state;

  if (target.pile === "foundation") {
    // Only a single card can be promoted, and only onto its own suit pile.
    if (cards.length !== 1) return state;
    const [card] = cards;
    if (card.suit !== target.suit) return state;
    if (!canStackOnFoundation(card, state.foundations[target.suit])) return state;
    const next = clone(state);
    removeFrom(next, source, 1);
    next.foundations[target.suit].push({ ...card, faceUp: true });
    next.moves += 1;
    return next;
  }

  if (source.pile === "tableau" && source.column === target.column) return state;
  if (!canStackOnTableau(cards[0], state.tableau[target.column])) return state;

  const next = clone(state);
  removeFrom(next, source, cards.length);
  next.tableau[target.column].push(...cards.map((card) => ({ ...card, faceUp: true })));
  next.moves += 1;
  return next;
}

/** Sends every card that can legally go to a foundation, repeating until stable. */
export function autoCollect(state: GameState): GameState {
  let current = state;
  let progressed = true;

  while (progressed) {
    progressed = false;

    const waste = current.waste[current.waste.length - 1];
    if (waste && canStackOnFoundation(waste, current.foundations[waste.suit])) {
      const moved = moveTo(current, { pile: "waste" }, { pile: "foundation", suit: waste.suit });
      if (moved !== current) { current = moved; progressed = true; continue; }
    }

    for (let column = 0; column < current.tableau.length; column += 1) {
      const pile = current.tableau[column];
      const card = pile[pile.length - 1];
      if (!card || !card.faceUp) continue;
      if (!canStackOnFoundation(card, current.foundations[card.suit])) continue;
      const moved = moveTo(
        current,
        { pile: "tableau", column, index: pile.length - 1 },
        { pile: "foundation", suit: card.suit },
      );
      if (moved !== current) { current = moved; progressed = true; break; }
    }
  }

  return current;
}

export function isWon(state: GameState): boolean {
  return SUITS.every((suit) => state.foundations[suit].length === 13);
}

export function score(state: GameState): number {
  return SUITS.reduce((total, suit) => total + state.foundations[suit].length * 10, 0);
}

export function cardLabel(card: Card, ar: boolean): string {
  const suitNames: Record<Suit, string> = ar
    ? { hearts: "قلوب", diamonds: "ديناري", clubs: "سباتي", spades: "بستوني" }
    : { hearts: "hearts", diamonds: "diamonds", clubs: "clubs", spades: "spades" };
  return `${RANK_LABEL[card.rank]} ${suitNames[card.suit]}`;
}
