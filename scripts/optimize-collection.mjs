import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, weld, simplify, prune } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const entries = [
  ["bolete", "牛肝菌"],
  ["chanterelle", "鸡油菌"],
  ["russula", "红菇"],
  ["milkcap", "奶浆菌"],
  ["greenhead", "青头菌"],
  ["termite", "鸡纵菌"],
  ["ganba", "干巴菌"],
  ["bluebolete", "见手青"],
  ["bamboofungus", "竹荪"],
  ["morel", "羊肚菌"],
  ["matsutake", "松茸"],
  ["truffle", "松露"],
  ["basket", "竹篮"],
  ["chest-closed", "宝箱"],
  ["chest-open", "宝箱开箱版"],
];
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await mkdir("public/assets/collection", { recursive: true });
await mkdir("work/collection-textures", { recursive: true });
const only = process.argv
  .find((arg) => arg.startsWith("--only="))
  ?.slice(7)
  .split(",");
const report = only
  ? JSON.parse(await readFile("public/assets/collection/manifest.json", "utf8"))
  : [];
for (const [id, name] of entries) {
  if (only && !only.includes(id)) continue;
  const out = `public/assets/collection/${id}.glb`;
  console.log(`Preparing ${name}...`);
  const doc = await io.read(`mushroom/${name}.glb`);
  const triangles = () =>
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
  const before = triangles();
  await doc.transform(
    dedup(),
    weld(),
    simplify({
      simplifier: MeshoptSimplifier,
      ratio: Math.min(1, (id.startsWith("chest-") ? 18000 : 10000) / before),
      error: 0.01,
    }),
    prune(),
  );
  let i = 0;
  for (const texture of doc.getRoot().listTextures()) {
    const file = `work/collection-textures/${id}-${i++}`;
    await writeFile(`${file}.source`, texture.getImage());
    execFileSync("python", [
      "scripts/texture.py",
      `${file}.source`,
      `${file}.jpg`,
      id.startsWith("chest-") ? "1024" : "512",
    ]);
    texture.setImage(await readFile(`${file}.jpg`)).setMimeType("image/jpeg");
  }
  await io.write(out, doc);
  const item = {
    id,
    source: `${name}.glb`,
    sourceTriangles: before,
    triangles: triangles(),
    bytes: (await stat(out)).size,
  };
  const existing = report.findIndex((p) => p.id === id);
  if (existing >= 0) report[existing] = item;
  else report.push(item);
  console.log(JSON.stringify(item));
  execFileSync(
    "python",
    [
      "scripts/render-collection.py",
      out,
      `public/assets/collection/${id}.webp`,
    ],
    { stdio: "inherit" },
  );
}
await writeFile(
  "public/assets/collection/manifest.json",
  JSON.stringify(report, null, 2),
);
