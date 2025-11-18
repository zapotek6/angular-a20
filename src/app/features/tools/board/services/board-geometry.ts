import {CardModel, ConnectionPoint, LinkModel} from '../models/board.models';

export interface Pt { x: number; y: number; }

export function getDefaultConnectionPoints(card: CardModel): ConnectionPoint[] {
  return [
    { id: 'top', relX: 0.5, relY: 0, shape: 'circle', hotRadius: 1.2 },
    { id: 'right', relX: 1, relY: 0.5, shape: 'circle', hotRadius: 1.2 },
    { id: 'bottom', relX: 0.5, relY: 1, shape: 'circle', hotRadius: 1.2 },
    { id: 'left', relX: 0, relY: 0.5, shape: 'circle', hotRadius: 1.2 },
  ];
}


export function getConnectionPoints(card: CardModel): ConnectionPoint[] {
  return card.connectionPoints && card.connectionPoints.length ? card.connectionPoints : getDefaultConnectionPoints(card);
}

export function toCardAbsoluteUnits(card: CardModel, cp: ConnectionPoint): Pt {
  return {
    x: card.x + cp.relX * card.width,
    y: card.y + cp.relY * card.height,
  };
}

export function nearestConnectionPoint(card: CardModel, x: number, y: number): ConnectionPoint {
  const cps = getConnectionPoints(card);
  let best = cps[0];
  let bestD = Infinity;
  for (const cp of cps) {
    const p = toCardAbsoluteUnits(card, cp);
    const dx = p.x - x;
    const dy = p.y - y;
    const d2 = dx*dx + dy*dy;
    if (d2 < bestD) { bestD = d2; best = cp; }
  }
  return best;
}

function dominantDirectionForCp(cp: ConnectionPoint): 'left'|'right'|'up'|'down' {
  if (cp.relX <= 0.001) return 'left';
  if (cp.relX >= 0.999) return 'right';
  if (cp.relY <= 0.001) return 'up';
  return 'down';
}

export function bezierForEndpoints(a: {p: Pt; cp: ConnectionPoint}, b: {p: Pt; cp: ConnectionPoint}) {
  const p0 = a.p;
  const p3 = b.p;
  const dirA = dominantDirectionForCp(a.cp);
  const dirB = dominantDirectionForCp(b.cp);
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const hx = Math.abs(dx) * 0.4; // handle lengths
  const hy = Math.abs(dy) * 0.4;
  let p1: Pt = {x: p0.x, y: p0.y};
  let p2: Pt = {x: p3.x, y: p3.y};
  switch (dirA) {
    case 'left':  p1 = {x: p0.x - hx, y: p0.y}; break;
    case 'right': p1 = {x: p0.x + hx, y: p0.y}; break;
    case 'up':    p1 = {x: p0.x, y: p0.y - hy}; break;
    case 'down':  p1 = {x: p0.x, y: p0.y + hy}; break;
  }
  switch (dirB) {
    case 'left':  p2 = {x: p3.x - hx, y: p3.y}; break;
    case 'right': p2 = {x: p3.x + hx, y: p3.y}; break;
    case 'up':    p2 = {x: p3.x, y: p3.y - hy}; break;
    case 'down':  p2 = {x: p3.x, y: p3.y + hy}; break;
  }
  return {p0, p1, p2, p3};
}

export function cubicPoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt; // (1-t)^3
  const b = 3 * mt2 * t; // 3(1-t)^2 t
  const c = 3 * mt * t2; // 3(1-t) t^2
  const d = t * t2; // t^3
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

export function buildBezierPathD(p0: Pt, p1: Pt, p2: Pt, p3: Pt): string {
  return `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;
}
