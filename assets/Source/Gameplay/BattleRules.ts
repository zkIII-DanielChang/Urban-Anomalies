/** Pure TypeScript turn-based rules; intentionally has no Cocos Creator dependency. */
export type BattleState = 'investigation' | 'player' | 'enemy' | 'win' | 'lose';
export type PlayerAction = 'investigate' | 'attack' | 'skill' | 'guard';
export interface BattleSnapshot { state: BattleState; hp: number; san: number; enemyHp: number; weaknessFound: boolean; guarding: boolean; enemyTurns: number; }
export interface BattleResult { ok: boolean; message: string; state: BattleState; snapshot: BattleSnapshot; }

/** Rules/state machine for one investigation and one enemy encounter. */
export class BattleRules {
  private _state: BattleState = 'investigation'; private _hp = 100; private _san = 80; private _enemyHp = 120;
  private _weaknessFound = false; private _guarding = false; private _enemyTurns = 0;
  get state(): BattleState { return this._state; }
  get snapshot(): BattleSnapshot { return { state: this._state, hp: this._hp, san: this._san, enemyHp: this._enemyHp, weaknessFound: this._weaknessFound, guarding: this._guarding, enemyTurns: this._enemyTurns }; }
  /** Investigate once, then use attack/skill/guard during player phase. */
  act(action: PlayerAction): BattleResult {
    if (action === 'investigate') {
      if (this._state !== 'investigation') return this.result(false, '调查已经完成');
      this._weaknessFound = true; this._state = 'player'; return this.result(true, '发现敌人弱点，开始战斗');
    }
    if (this._state !== 'player') return this.result(false, '现在不是玩家行动阶段');
    switch (action) {
      case 'attack': this._enemyHp -= 24; this._state = this._enemyHp <= 0 ? 'win' : 'enemy'; return this.result(true, '普通攻击造成 24 点伤害');
      case 'skill':
        if (this._san < 15) return this.result(false, '理智不足，无法使用技能');
        this._san -= 15; this._enemyHp -= this._weaknessFound ? 56 : 42; this._state = this._enemyHp <= 0 ? 'win' : 'enemy';
        return this.result(true, this._weaknessFound ? '技能命中弱点，造成 56 点伤害' : '技能造成 42 点伤害');
      case 'guard': this._guarding = true; this._san = Math.min(80, this._san + 12); this._state = 'enemy'; return this.result(true, '进入防御姿态，恢复 12 点理智');
      default: return this.result(false, '未知行动');
    }
  }
  /** Resolve the enemy alternating normal (14) and pollution (10 damage, 12 san). */
  enemyTurn(): BattleResult {
    if (this._state !== 'enemy') return this.result(false, '现在不是敌人行动阶段');
    const pollution = this._enemyTurns % 2 === 1; const damage = pollution ? 10 : 14; const actual = this._guarding ? Math.ceil(damage / 2) : damage;
    this._hp -= actual; if (pollution) this._san -= 12; this._guarding = false; this._enemyTurns++;
    if (this._hp <= 0 || this._san <= 0) { this._hp = Math.max(0, this._hp); this._san = Math.max(0, this._san); this._state = 'lose'; return this.result(true, pollution ? '敌人施放污染，行动力崩溃' : '敌人普通攻击击倒了调查员'); }
    this._state = 'player'; return this.result(true, pollution ? '敌人施放污染，损失 10 点生命和 12 点理智' : '敌人普通攻击造成 14 点伤害');
  }
  reset(): BattleSnapshot { this._state = 'investigation'; this._hp = 100; this._san = 80; this._enemyHp = 120; this._weaknessFound = false; this._guarding = false; this._enemyTurns = 0; return this.snapshot; }
  private result(ok: boolean, message: string): BattleResult { return { ok, message, state: this._state, snapshot: this.snapshot }; }
}
export default BattleRules;
