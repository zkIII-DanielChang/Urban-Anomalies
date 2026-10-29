export type DirSet = 'ortho4' | 'diag4' | 'all8';
export type HitRule = 'allPath' | 'firstUnit' | 'endOnly';
export type MoveKind = 'same' | 'reverse' | 'none' | 'teleport';

export interface Vec2 {
  dc: number;
  dr: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  dirs: DirSet;
  atkLen: number;
  hit: HitRule;
  moveKind: MoveKind;
  moveLen: number;
  ap: number;
  damage: string;
  bounce: number;
  ranged: boolean;
}

/** r 轴向下为正：r=0 是屏幕上边（敌方），r=rows-1 是下边（我方）。 */
export const DIRS: Readonly<Record<string, Vec2>> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
  upLeft: { dc: -1, dr: -1 },
  upRight: { dc: 1, dr: -1 },
  downLeft: { dc: -1, dr: 1 },
  downRight: { dc: 1, dr: 1 }
};

const ORTHO4 = ['up', 'down', 'left', 'right'];
const DIAG4 = ['upLeft', 'upRight', 'downLeft', 'downRight'];
const ALL8 = ORTHO4.concat(DIAG4);

export function dirNames(set: DirSet): string[] {
  return set === 'ortho4' ? ORTHO4.slice() : set === 'diag4' ? DIAG4.slice() : ALL8.slice();
}

export const WEAPONS: Readonly<Record<string, WeaponDef>> = {
  shortsword: { id: 'shortsword', name: '单手剑', dirs: 'ortho4', atkLen: 3, hit: 'allPath', moveKind: 'same', moveLen: 1, ap: 2, damage: '1D6+1', bounce: 0, ranged: false },
  greatsword: { id: 'greatsword', name: '大剑', dirs: 'ortho4', atkLen: 5, hit: 'allPath', moveKind: 'same', moveLen: 2, ap: 1, damage: '2D6', bounce: 0, ranged: false },
  spear: { id: 'spear', name: '长枪', dirs: 'ortho4', atkLen: 6, hit: 'allPath', moveKind: 'none', moveLen: 0, ap: 2, damage: '1D8', bounce: 0, ranged: false },
  dagger: { id: 'dagger', name: '匕首', dirs: 'all8', atkLen: 1, hit: 'allPath', moveKind: 'same', moveLen: 1, ap: 3, damage: '1D4+2', bounce: 0, ranged: false },
  bow: { id: 'bow', name: '弓', dirs: 'diag4', atkLen: 6, hit: 'firstUnit', moveKind: 'reverse', moveLen: 1, ap: 2, damage: '1D6+1', bounce: 1, ranged: true },
  shield: { id: 'shield', name: '盾', dirs: 'ortho4', atkLen: 1, hit: 'firstUnit', moveKind: 'none', moveLen: 0, ap: 2, damage: '1D3+2', bounce: 0, ranged: false }
};

/** 净接近：>0 打了就贴近，<0 打了就退开，0 锚定。见方案四 4.1。 */
export function netApproach(w: WeaponDef): number {
  if (w.moveKind === 'same') return w.moveLen;
  if (w.moveKind === 'reverse') return -w.moveLen;
  return 0;
}

/** 总机动 = ap × 步进；总覆盖 = ap × 触及。见方案四 4.3 旋钮一。 */
export function totalMobility(w: WeaponDef): number {
  return w.moveKind === 'none' || w.moveKind === 'teleport' ? 0 : w.ap * w.moveLen;
}

export function totalCoverage(w: WeaponDef): number {
  return w.ap * w.atkLen;
}
