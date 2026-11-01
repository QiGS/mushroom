// Small spatial hash for moving bodies. Rendering visibility does not determine
// solidity: an off-camera creature is still solid, a dead one is not.
export class ActorSpace {
  constructor(cellSize = 4) { this.cellSize = cellSize; this.records = new Map(); this.cells = new Map(); }
  keys(discs) {
    const keys = new Set(), s = this.cellSize;
    for (const d of discs)
      for (let x = Math.floor((d.x - d.radius) / s); x <= Math.floor((d.x + d.radius) / s); x++)
        for (let z = Math.floor((d.z - d.radius) / s); z <= Math.floor((d.z + d.radius) / s); z++) keys.add(`${x},${z}`);
    return keys;
  }
  track(owner, read, kind = 'enemy') {
    this.remove(owner);
    this.records.set(owner, { owner, read, kind, keys: new Set(), shape: null });
    this.refresh(owner);
  }
  unlink(record) {
    for (const key of record.keys) {
      const cell = this.cells.get(key);
      cell?.delete(record);
      if (!cell?.size) this.cells.delete(key);
    }
  }
  refresh(owner) {
    const record = this.records.get(owner);
    if (!record) return;
    this.unlink(record);
    record.shape = record.read();
    record.keys = record.shape ? this.keys(record.shape.discs) : new Set();
    for (const key of record.keys) {
      if (!this.cells.has(key)) this.cells.set(key, new Set());
      this.cells.get(key).add(record);
    }
  }
  refreshAll() { for (const owner of this.records.keys()) this.refresh(owner); }
  remove(owner) { const r = this.records.get(owner); if (r) this.unlink(r); this.records.delete(owner); }
  blocker(discs, bottom, top, ignore, previous = []) {
    const nearby = new Set();
    for (const key of this.keys(discs)) for (const r of this.cells.get(key) || []) nearby.add(r);
    for (const r of nearby) {
      if (r.owner === ignore || !r.shape || bottom >= r.shape.top || top <= r.shape.bottom) continue;
      let nextDepth = 0, oldDepth = 0;
      for (const other of r.shape.discs) {
        for (const d of discs) nextDepth = Math.max(nextDepth, d.radius + other.radius - Math.hypot(d.x - other.x, d.z - other.z));
        for (const d of previous) oldDepth = Math.max(oldDepth, d.radius + other.radius - Math.hypot(d.x - other.x, d.z - other.z));
      }
      // Old saves or respawns may overlap. Only outward movement is allowed.
      if (nextDepth > .00001 && nextDepth >= oldDepth - .00001) return r;
    }
    return null;
  }
}
