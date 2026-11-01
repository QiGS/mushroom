import { BOSSES } from "./progression.js";
import { MAP_SPACE } from "./terrain.js";
export function bossMapMarker(s, enemies = []) {
  return bossMapMarkers(s, enemies).find(b => b.chapter === s.chapter) || null;
}
export function bossMapMarkers(s, enemies = []) {
  return Object.values(BOSSES).map(boss => {
  const live = enemies.find((e) => e.id === boss.id),
    defeated = s.defeated.includes(boss.id);
  return {
    ...boss,
    x: live?.x ?? boss.x,
    z: live?.z ?? boss.z,
    health: defeated ? 0 : (live?.hp ?? boss.hp),
    defeated,
    sealed: boss.species === 'antQueen' && s.chapter === 3 && !s.gateOpen,
  };
  });
}
export function mapViewport(s, large, zoom = 1, centre = s.position) {
  zoom = Math.max(1, Math.min(6, Number(zoom) || 1));
  if (!large || zoom === 1) return MAP_SPACE;
  const span = MAP_SPACE.span / zoom;
  return {
    span,
    x: Math.max(
      MAP_SPACE.x,
      Math.min(MAP_SPACE.x + MAP_SPACE.span - span, centre.x - span / 2),
    ),
    z: Math.max(
      MAP_SPACE.z,
      Math.min(MAP_SPACE.z + MAP_SPACE.span - span, centre.z - span / 2),
    ),
  };
}
export function zoomMapViewport(s, zoom, centre, u, v, delta) {
  const old = mapViewport(s, true, zoom, centre);
  const nextZoom = Math.max(1, Math.min(6, zoom * Math.exp(-Math.max(-300, Math.min(300, delta)) * .002)));
  const span = MAP_SPACE.span / nextZoom;
  const next = mapViewport(s, true, nextZoom, {
    x: old.x + u * old.span + (.5 - u) * span,
    z: old.z + v * old.span + (.5 - v) * span,
  });
  return { zoom: nextZoom, centre: { x: next.x + next.span / 2, z: next.z + next.span / 2 } };
}
// Canvas paths stay crisp at minimap scale and don't depend on emoji fonts.
export function drawMapSymbol(
  ctx,
  kind,
  x,
  y,
  size,
  color = "#745344",
  done = false,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 12, size / 12);
  ctx.fillStyle = done ? "#91a48a" : color;
  ctx.strokeStyle = "#fff0cd";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#fff2d3";
  ctx.fillStyle = "#fff2d3";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (done) {
    ctx.moveTo(-5, 0);
    ctx.lineTo(-1, 4);
    ctx.lineTo(6, -4);
    ctx.stroke();
  } else if (kind === 'anchor') {
    ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0); ctx.closePath(); ctx.stroke();
    ctx.moveTo(-8, 5); ctx.lineTo(8, 5); ctx.stroke();
  } else if (kind === "butterfly") {
    ctx.ellipse(-4, -2, 3.5, 5, -0.5, 0, Math.PI * 2);
    ctx.ellipse(4, -2, 3.5, 5, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(0, 7);
    ctx.stroke();
  } else if (kind === "scorpion") {
    ctx.arc(0, 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(9, -8, -6, -10, -5, -3);
    ctx.moveTo(-2, 4);
    ctx.lineTo(-7, 1);
    ctx.lineTo(-7, -2);
    ctx.moveTo(2, 4);
    ctx.lineTo(7, 1);
    ctx.lineTo(7, -2);
    ctx.stroke();
  } else if (kind === "ant") {
    for (const y of [-5, 0, 5]) {
      ctx.moveTo(2, y);
      ctx.arc(0, y, 2.2, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.beginPath();
    for (const y of [-3, 1, 4]) {
      ctx.moveTo(-2, y);
      ctx.lineTo(-7, y - 2);
      ctx.moveTo(2, y);
      ctx.lineTo(7, y - 2);
    }
    ctx.stroke();
  } else if (kind === "serpent") {
    ctx.moveTo(-5, 6);
    ctx.bezierCurveTo(11, 6, -9, -3, 2, -6);
    ctx.lineTo(5, -4);
    ctx.stroke();
  } else if (kind === "shop") {
    ctx.rect(-6, -2, 12, 8);
    ctx.moveTo(-7, -3);
    ctx.lineTo(-4, -7);
    ctx.lineTo(4, -7);
    ctx.lineTo(7, -3);
    ctx.closePath();
    ctx.stroke();
  } else if (kind === "granny") {
    ctx.arc(0, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 7, 5, Math.PI, Math.PI * 2);
    ctx.stroke();
  } else if (kind === "camp") {
    ctx.moveTo(-7, 5);
    ctx.lineTo(0, -7);
    ctx.lineTo(7, 5);
    ctx.closePath();
    ctx.moveTo(0, -2);
    ctx.lineTo(0, 5);
    ctx.stroke();
  }
  ctx.restore();
}
