import { terrainHeight, colliderActive, insideHouse } from "./terrain.js";
import { collidersNear } from "./spatial.js";
const top = (c) =>
  c.height ??
  (c.id === "house-bed"
    ? 1.2
    : c.id === "house-table"
      ? 1
      : c.id === "house-shelf"
        ? 2.7
        : c.id?.includes("table") || c.id === "shop-counter"
          ? 1.2
          : c.house
            ? 3.9
            : 5.5);
// Sweep a camera-sized volume against collision solids, including back faces.
// Constrain both the desired position and the smoothed result to prevent corner cuts.
export function constrainCamera(world, state, focus, candidate, radius = 0.28) {
  let end = { ...candidate };
  if (insideHouse(focus.x, focus.z)) {
    const base = terrainHeight(-6, 33) + 0.16;
    end.y = Math.min(base + 3.25, Math.max(base + 0.4, end.y));
  }
  const d = { x: end.x - focus.x, y: end.y - focus.y, z: end.z - focus.z };
  let fraction = 1;
  for (const c of collidersNear(
    world,
    (focus.x + end.x) / 2,
    (focus.z + end.z) / 2,
    Math.hypot(d.x, d.z) / 2 + radius,
  )) {
    if (!colliderActive(c, state)) continue;
    const base = terrainHeight(c.x, c.z),
      hx = (c.hx ?? c.r) + radius,
      hz = (c.hz ?? c.r) + radius;
    const bounds = {
      x: [c.x - hx, c.x + hx],
      y: [base - radius, base + top(c) + radius],
      z: [c.z - hz, c.z + hz],
    };
    // Ignore a solid containing the look target (e.g. the edge of a low prop).
    if (
      Object.keys(d).every(
        (a) => focus[a] >= bounds[a][0] && focus[a] <= bounds[a][1],
      )
    )
      continue;
    let enter = 0,
      leave = 1;
    for (const a of ["x", "y", "z"]) {
      if (Math.abs(d[a]) < 1e-8) {
        if (focus[a] < bounds[a][0] || focus[a] > bounds[a][1]) {
          enter = 2;
          break;
        }
      } else {
        const t1 = (bounds[a][0] - focus[a]) / d[a],
          t2 = (bounds[a][1] - focus[a]) / d[a];
        enter = Math.max(enter, Math.min(t1, t2));
        leave = Math.min(leave, Math.max(t1, t2));
      }
    }
    if (enter <= leave && enter >= 0 && enter < fraction)
      fraction = Math.max(0, enter - 0.015);
  }
  end = Object.fromEntries(
    ["x", "y", "z"].map((a) => [a, focus[a] + d[a] * fraction]),
  );
  end.y = Math.max(end.y, terrainHeight(end.x, end.z) + 0.35);
  return end;
}

export function softenFoliage(material, focus, eye) {
  const before = material.onBeforeCompile,
    oldKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader) => {
    before(shader);
    shader.uniforms.uFoliageFocus = { value: focus };
    shader.uniforms.uFoliageEye = { value: eye };
    shader.vertexShader = "varying vec3 vFoliageWorld;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
vec4 foliageWorld=vec4(transformed,1.0);
#ifdef USE_INSTANCING
foliageWorld=instanceMatrix*foliageWorld;
#endif
vFoliageWorld=(modelMatrix*foliageWorld).xyz;`,
    );
    shader.fragmentShader =
      "varying vec3 vFoliageWorld; uniform vec3 uFoliageFocus; uniform vec3 uFoliageEye;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <clipping_planes_fragment>",
      `#include <clipping_planes_fragment>
vec3 sight=uFoliageEye-uFoliageFocus;
float along=clamp(dot(vFoliageWorld-uFoliageFocus,sight)/max(dot(sight,sight),0.001),0.0,1.0);
float away=length(vFoliageWorld-(uFoliageFocus+sight*along));
float keep=mix(0.08,1.0,smoothstep(0.75,1.8,away));
float pattern=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);
if(pattern>keep) discard;`,
    );
  };
  material.customProgramCacheKey = () => oldKey + "-clear-sight-v1";
}
