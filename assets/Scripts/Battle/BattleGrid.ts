export interface Cell {
  c: number;
  r: number;
}

export type UnitSide = 'player' | 'ally' | 'enemy';

export interface Unit {
  id: string;
  side: UnitSide;
  hp: number;
  maxHp: number;
  pos: Cell;
}

export type Terrain = 'trap' | 'weapon' | 'exit';

export function keyOf(c: number, r: number): string {
  return c + ',' + r;
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.c === b.c && a.r === b.r;
}

/** 6 列 × 8 行的战场。r=0 是敌方侧，r=rows-1 是我方侧。 */
export class BattleGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly walls = new Set<string>();
  private readonly terrain = new Map<string, Terrain>();
  private readonly units = new Map<string, Unit>();

  constructor(cols = 6, rows = 8) {
    this.cols = cols;
    this.rows = rows;
  }

  inBounds(cell: Cell): boolean {
    return cell.c >= 0 && cell.c < this.cols && cell.r >= 0 && cell.r < this.rows;
  }

  isWall(cell: Cell): boolean {
    return this.walls.has(keyOf(cell.c, cell.r));
  }

  addWall(cell: Cell): void {
    this.walls.add(keyOf(cell.c, cell.r));
  }

  /** 棋盘边界视为墙：远程能在边界弹射，近战被边界截断。 */
  blocks(cell: Cell): boolean {
    return !this.inBounds(cell) || this.isWall(cell);
  }

  setTerrain(cell: Cell, kind: Terrain): void {
    this.terrain.set(keyOf(cell.c, cell.r), kind);
  }

  terrainAt(cell: Cell): Terrain | undefined {
    return this.terrain.get(keyOf(cell.c, cell.r));
  }

  unitAt(cell: Cell): Unit | undefined {
    for (const u of this.units.values()) {
      if (u.pos.c === cell.c && u.pos.r === cell.r) return u;
    }
    return undefined;
  }

  unitById(id: string): Unit | undefined {
    return this.units.get(id);
  }

  addUnit(unit: Unit): void {
    this.units.set(unit.id, unit);
  }

  removeUnit(id: string): void {
    this.units.delete(id);
  }

  moveUnit(id: string, to: Cell): void {
    const u = this.units.get(id);
    if (u) u.pos = { c: to.c, r: to.r };
  }

  allUnits(): Unit[] {
    return Array.from(this.units.values());
  }

  /** 落点是否可用：在界内、不是墙、没有单位占据。 */
  isFree(cell: Cell): boolean {
    return this.inBounds(cell) && !this.isWall(cell) && this.unitAt(cell) === undefined;
  }
}
