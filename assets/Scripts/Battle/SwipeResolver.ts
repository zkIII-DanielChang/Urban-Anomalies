import { BattleGrid, Cell, sameCell } from './BattleGrid';
import { DIRS, dirNames, WeaponDef } from './WeaponDefs';

export interface SwipeOutcome {
  legal: boolean;
  reason: string;
  /** 攻击实际经过的格子，按顺序；弹射时跨段连续排列。 */
  path: Cell[];
  /** 弹射分段。近战恒为一段。 */
  segments: Cell[][];
  /** 真正受伤害的格子（endOnly 只取终点）。 */
  damageCells: Cell[];
  hitUnitIds: string[];
  endPos: Cell;
  moved: boolean;
  truncatedByWall: boolean;
  bounces: number;
}

function illegal(reason: string, from: Cell): SwipeOutcome {
  return {
    legal: false, reason, path: [], segments: [], damageCells: [],
    hitUnitIds: [], endPos: { c: from.c, r: from.r }, moved: false,
    truncatedByWall: false, bounces: 0
  };
}

/**
 * 一次方向滑动的全部结算。纯函数，不修改 grid。
 * 攻击方向会被弹射改变，但位移始终沿原始滑动方向 —— 后坐力不会因为你射歪而变向。
 */
export function resolveSwipe(grid: BattleGrid, weapon: WeaponDef, from: Cell, dirName: string): SwipeOutcome {
  const base = DIRS[dirName];
  if (!base) return illegal('未知方向 ' + dirName, from);
  if (dirNames(weapon.dirs).indexOf(dirName) < 0) {
    return illegal(weapon.name + '不能用' + dirName + '方向', from);
  }

  const path: Cell[] = [];
  const segments: Cell[][] = [[]];
  const hitUnitIds: string[] = [];
  let dc = base.dc;
  let dr = base.dr;
  let cursor: Cell = { c: from.c, r: from.r };
  let remaining = weapon.atkLen;
  let bounces = 0;
  let truncatedByWall = false;
  let stoppedAtUnit = false;

  while (remaining > 0) {
    const next: Cell = { c: cursor.c + dc, r: cursor.r + dr };

    if (grid.blocks(next)) {
      if (weapon.ranged && bounces < weapon.bounce) {
        const reflected = reflect(dc, dr, grid, cursor);
        if (!reflected) {
          truncatedByWall = true;
          break;
        }
        dc = reflected.dc;
        dr = reflected.dr;
        bounces++;
        segments.push([]);
        continue;
      }
      truncatedByWall = true;
      break;
    }

    path.push(next);
    segments[segments.length - 1].push(next);
    cursor = next;
    remaining--;

    const unit = grid.unitAt(next);
    if (unit && !sameCell(next, from)) {
      hitUnitIds.push(unit.id);
      if (weapon.hit === 'firstUnit') {
        stoppedAtUnit = true;
        break;
      }
    }
  }

  const damageCells = weapon.hit === 'endOnly' ? path.slice(-1) : path;
  const endPos = resolveMove(grid, weapon, from, base);

  return {
    legal: true,
    reason: stoppedAtUnit ? '命中单位后停止' : truncatedByWall ? '被墙截断' : 'ok',
    path,
    segments,
    damageCells,
    hitUnitIds,
    endPos: endPos.pos,
    moved: endPos.moved,
    truncatedByWall,
    bounces
  };
}

/**
 * 45° 入射 → 45° 反射。撞竖直面翻转 dc，撞水平面翻转 dr。
 * 斜向箭撞「对角相邻」的墙时射线正好穿过格角，几何上没有唯一反射面，
 * 这里约定按竖直面处理（关卡里的墙多为竖直走廊壁）。因为三层高亮会把
 * 完整折线预先画出来，玩家从不需要猜这条约定。
 * 三面全堵（死角）不弹。
 */
function reflect(dc: number, dr: number, grid: BattleGrid, at: Cell): { dc: number; dr: number } | null {
  const horizBlocked = dc !== 0 && grid.blocks({ c: at.c + dc, r: at.r });
  const vertBlocked = dr !== 0 && grid.blocks({ c: at.c, r: at.r + dr });
  if (horizBlocked && vertBlocked) return null;
  if (vertBlocked && !horizBlocked) return { dc, dr: -dr };
  return { dc: -dc, dr };
}

function resolveMove(grid: BattleGrid, weapon: WeaponDef, from: Cell, base: { dc: number; dr: number }): { pos: Cell; moved: boolean } {
  if (weapon.moveKind === 'none' || weapon.moveLen <= 0) {
    return { pos: { c: from.c, r: from.r }, moved: false };
  }

  if (weapon.moveKind === 'teleport') {
    const target: Cell = { c: from.c + base.dc * weapon.moveLen, r: from.r + base.dr * weapon.moveLen };
    return grid.isFree(target) ? { pos: target, moved: true } : { pos: { c: from.c, r: from.r }, moved: false };
  }

  const sign = weapon.moveKind === 'same' ? 1 : -1;
  let cur: Cell = { c: from.c, r: from.r };
  let moved = false;
  for (let i = 0; i < weapon.moveLen; i++) {
    const next: Cell = { c: cur.c + base.dc * sign, r: cur.r + base.dr * sign };
    if (!grid.isFree(next)) break;
    cur = next;
    moved = true;
  }
  return { pos: cur, moved };
}

/** 该武器从这一格出发所有合法方向的落点，供「可达层」高亮使用。 */
export function reachableEndPositions(grid: BattleGrid, weapon: WeaponDef, from: Cell): Cell[] {
  const out: Cell[] = [];
  for (const name of dirNames(weapon.dirs)) {
    const res = resolveSwipe(grid, weapon, from, name);
    if (res.legal && !out.some(c => sameCell(c, res.endPos))) out.push(res.endPos);
  }
  return out;
}
