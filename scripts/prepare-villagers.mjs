import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, weld, simplify, prune } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  report = [];
await mkdir("public/assets/villagers", { recursive: true });
await mkdir("work/villager-textures", { recursive: true });
for (const [id, name] of [
  ["grandma", "奶奶"],
  ["uncle", "采菌大叔"],
]) {
  const doc = await io.read(`mushroom/${name}.glb`);
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
      ratio: Math.min(1, 30000 / before),
      error: 0.005,
    }),
    prune(),
  );
  let i = 0;
  for (const texture of doc.getRoot().listTextures()) {
    const file = `work/villager-textures/${id}-${i++}`;
    await writeFile(file + ".source", texture.getImage());
    execFileSync("python", [
      "scripts/texture.py",
      file + ".source",
      file + ".jpg",
      "1024",
    ]);
    texture.setImage(await readFile(file + ".jpg")).setMimeType("image/jpeg");
  }
  const output = `public/assets/villagers/${id}.glb`;
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
    [
      "scripts/render-collection.py",
      output,
      `work/villager-textures/${id}.webp`,
    ],
    { stdio: "inherit" },
  );
}
await writeFile(
  "public/assets/villagers/manifest.json",
  JSON.stringify(report, null, 2),
);
