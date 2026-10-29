import { BattleGrid, Cell, sameCell, Unit } from './BattleGrid';
import { Rng, rollDice } from './Dice';
import { resolveSwipe, SwipeOutcome } from './SwipeResolver';
import { WeaponDef } from './WeaponDefs';

export interface SwipeReport {
  outcome: SwipeOutcome;
  damage: { unitId: string; amount: number; killed: boolean }[];
  trapsTriggered: Cell[];
  apLeft: number;
}

export type Phase = 'player' | 'enemy' | 'win' | 'lose';

/**
 * 一场战斗的回合状态。敌人 AI 尚未实装（方案四落地路径 ②），
 * threat 由外部直接给定，模拟「固定红区 + 木桩敌人」。
 */
export class BattleSession {
  readonly grid: BattleGrid;
  weapon: WeaponDef;
  player: Unit;
  phase: Phase = 'player';
  apLeft: number;
  turn = 1;
  /** 敌人下回合的攻击范围。固定不重瞄，见方案四 7.1。 */
  threat: Cell[] = [];

  private readonly rng: Rng;

  constructor(grid: BattleGrid, player: Unit, weapon: WeaponDef, rng: Rng = Math.random) {
    this.grid = grid;
    this.player = player;
    this.weapon = weapon;
    this.apLeft = weapon.ap;
    this.rng = rng;
  }

  canSwipe(dirName: string): boolean {
    return this.phase === 'player' && this.apLeft > 0 && resolveSwipe(this.grid, this.weapon, this.player.pos, dirName).legal;
  }

  /**
   * 先整体解算再落地：伤害不会反过来改变本次位移的落点。
   * 所以「杀死挡路的敌人然后站进它腾出的格子」在一笔内做不到 ——
   * 这是为了让三层高亮的预测永远准确（方案四第 8 节）。
   */
  swipe(dirName: string): SwipeReport | null {
    if (this.phase !== 'player' || this.apLeft <= 0) return null;
    const outcome = resolveSwipe(this.grid, this.weapon, this.player.pos, dirName);
    if (!outcome.legal) return null;

    const trapsTriggered = this.weapon.ranged ? [] : this.collectTraps(outcome);
    const damage = this.applyDamage(outcome);
    this.grid.moveUnit(this.player.id, outcome.endPos);
    this.player.pos = outcome.endPos;

    this.apLeft--;

    if (this.grid.allUnits().every(u => u.side !== 'enemy')) this.phase = 'win';
    return { outcome, damage, trapsTriggered, apLeft: this.apLeft };
  }

  private applyDamage(outcome: SwipeOutcome): { unitId: string; amount: number; killed: boolean }[] {
    const results: { unitId: string; amount: number; killed: boolean }[] = [];
    const seen = new Set<string>();
    for (const cell of outcome.damageCells) {
      const unit = this.grid.unitAt(cell);
      if (!unit || unit.side === 'player' || seen.has(unit.id)) continue;
      seen.add(unit.id);
      const amount = rollDice(this.weapon.damage, this.rng);
      unit.hp -= amount;
      const killed = unit.hp <= 0;
      if (killed) this.grid.removeUnit(unit.id);
      results.push({ unitId: unit.id, amount, killed });
    }
    return results;
  }

  /** 远程不触发陷阱：箭飞过去不算踩上去。见方案四第五节。 */
  private collectTraps(outcome: SwipeOutcome): Cell[] {
    const seen = new Set<string>();
    const out: Cell[] = [];
    const stepped = outcome.path.concat(outcome.moved ? [outcome.endPos] : []);
    for (const c of stepped) {
      const k = c.c + ',' + c.r;
      if (seen.has(k)) continue;
      seen.add(k);
      if (this.grid.terrainAt(c) === 'trap') out.push(c);
    }
    return out;
  }

  /** 玩家 ap 用完或主动结束 → 敌人执行 threat → 回到玩家回合。 */
  endTurn(enemyDamage: number): { damageTaken: number; phase: Phase } {
    if (this.phase !== 'player') return { damageTaken: 0, phase: this.phase };

    const inThreat = this.threat.some(c => sameCell(c, this.player.pos));
    const damageTaken = inThreat ? enemyDamage : 0;
    this.player.hp -= damageTaken;

    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.phase = 'lose';
      return { damageTaken, phase: this.phase };
    }
    if (this.grid.allUnits().every(u => u.side !== 'enemy')) {
      this.phase = 'win';
      return { damageTaken, phase: this.phase };
    }

    this.phase = 'player';
    this.apLeft = this.weapon.ap;
    this.turn++;
    return { damageTaken, phase: this.phase };
  }

  switchWeapon(weapon: WeaponDef): void {
    this.weapon = weapon;
    this.apLeft = weapon.ap;
  }
}
