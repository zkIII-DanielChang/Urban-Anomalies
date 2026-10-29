export type Rng = () => number;

export interface DiceSpec {
  count: number;
  sides: number;
  bonus: number;
}

const DICE_RE = /^(\d+)[dD](\d+)(?:([+-])(\d+))?$/;

/** 解析 CoC 伤害骰写法：'1D6+1' / '2D6' / '1D4+2'。 */
export function parseDice(spec: string): DiceSpec {
  const m = DICE_RE.exec(spec.trim());
  if (!m) throw new Error('无法解析伤害骰: ' + spec);
  const bonus = m[3] ? (m[3] === '-' ? -1 : 1) * parseInt(m[4], 10) : 0;
  return { count: parseInt(m[1], 10), sides: parseInt(m[2], 10), bonus };
}

export function rollDice(spec: string, rng: Rng = Math.random): number {
  const { count, sides, bonus } = parseDice(spec);
  let total = bonus;
  for (let i = 0; i < count; i++) {
    total += 1 + Math.floor(rng() * sides);
  }
  return total;
}

export function averageDice(spec: string): number {
  const { count, sides, bonus } = parseDice(spec);
  return count * (sides + 1) / 2 + bonus;
}
