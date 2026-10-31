import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, weld, simplify, prune } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  report = [];
await mkdir("public/assets/props", { recursive: true });
await mkdir("work/prop-textures", { recursive: true });
for (const [id, name, budget] of [
  ["bridge", "桥", 22000],
  ["rock", "岩石", 2500],
  ["noticeboard", "路边公告牌", 12000],
  ["stele", "石碑", 8000],
  ["campfire", "篝火", 12000],
  ["bed", "床", 16000],
  ["weather-vane", "天气指向器", 12000],
]) {
  const doc = await io.read(`道具二维/${name}.glb`);
  const count = () =>
    doc
      .getRoot()
      .listMeshes()
      .reduce(
        (n, m) =>
          n +
          m
            .listPrimitives()
            .reduce(
              (v, p) =>
                v +
                (p.getIndices()?.getCount() ||
                  p.getAttribute("POSITION").getCount()) /
                  3,
              0,
            ),
        0,
      );
  const before = count();
  await doc.transform(
    dedup(),
    weld(),
    simplify({
      simplifier: MeshoptSimplifier,
      ratio: Math.min(1, budget / before),
      error: 0.01,
    }),
    prune(),
  );
  let i = 0;
  for (const texture of doc.getRoot().listTextures()) {
    const file = `work/prop-textures/${id}-${i++}`;
    await writeFile(file + ".source", texture.getImage());
    execFileSync("python", [
      "scripts/texture.py",
      file + ".source",
      file + ".jpg",
      "1024",
    ]);
    texture.setImage(await readFile(file + ".jpg")).setMimeType("image/jpeg");
  }
  const output = `public/assets/props/${id}.glb`;
  await io.write(output, doc);
  report.push({
    id,
    source: name + ".glb",
    sourceTriangles: before,
    triangles: count(),
    bytes: (await stat(output)).size,
  });
  console.log(report.at(-1));
  execFileSync(
    "python",
    ["scripts/render-collection.py", output, `work/prop-textures/${id}.webp`],
    { stdio: "inherit" },
  );
}
await writeFile(
  "public/assets/props/manifest.json",
  JSON.stringify(report, null, 2),
);
await mkdir("public/assets/tools", { recursive: true });
await mkdir("public/assets/audio", { recursive: true });
for (const [source, name] of [
  ["bed", "bed"],
  ["weather-vane", "weatherVane"],
])
  await writeFile(
    `public/assets/tools/${name}.webp`,
    await readFile(`work/prop-textures/${source}.webp`),
  );
for (const [source, name] of [
  ["bgm.MP3", "jingmai-bgm.mp3"],
  ["自然鸟鸣流水.MP3", "forest-stream.mp3"],
])
  await writeFile(
    `public/assets/audio/${name}`,
    await readFile(`道具二维/${source}`),
  );
