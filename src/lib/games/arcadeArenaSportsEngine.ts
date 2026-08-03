export type ShotResult = { scored: boolean; quality: number };

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function penaltyShot(aim: number, power: number, keeper: number): ShotResult {
  const separation = Math.abs(aim - keeper);
  const control = 100 - Math.abs(power - 76) * 1.8;
  const quality = Math.round(clamp(separation * 1.35 + control * 0.45));
  return { scored: separation >= 18 && power >= 38 && power <= 96, quality };
}

export function basketballShot(power: number, aim: number, distance: number): ShotResult {
  const idealPower = 42 + distance * 4.2;
  const error = Math.abs(power - idealPower) * 1.25 + Math.abs(aim - 50) * 1.4;
  const quality = Math.round(clamp(100 - error));
  return { scored: error <= 18, quality };
}

export function tableTennisReturn(placement: number, spin: number, opponent: number): ShotResult {
  const openCourt = Math.abs(placement - opponent);
  const controlPenalty = Math.max(0, Math.abs(spin - 50) - 36);
  const quality = Math.round(clamp(42 + openCourt - controlPenalty * 2));
  return { scored: openCourt >= 24 && controlPenalty < 8, quality };
}

export function airHockeyShot(direction: number, power: number, defense: number): ShotResult {
  const lane = Math.abs(direction - defense);
  const powerControl = Math.max(0, 100 - Math.abs(power - 82) * 2);
  const quality = Math.round(clamp(lane * 1.25 + powerControl * 0.45));
  return { scored: lane >= 20 && power >= 46, quality };
}
