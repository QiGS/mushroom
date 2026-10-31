import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  weld,
  simplify,
  prune,
  normals,
} from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  report = [];
await mkdir("work/encounter-assets", { recursive: true });
for (const [id, source, budget] of [
  ["poison-butterfly", "new/毒蝴蝶3d.glb", 14000],
  ["poison-scorpion", "new/毒蝎子.glb", 16000],
  ["shotgun", "new/霰弹枪.glb", 6000],
  ["sniper", "new/狙击枪.glb", 6500],
  ["cannon", "new/手持炮.glb", 6500],
]) {
  if (process.argv[2] && id !== process.argv[2]) continue;
  const doc = await io.read(source);
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
              (s, p) =>
                s +
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
      error: 0.025,
    }),
    prune(),
  );
  let i = 0;
  for (const t of doc.getRoot().listTextures()) {
    const f = `work/encounter-assets/${id}-${i++}`;
    await writeFile(f + ".source", t.getImage());
    execFileSync("python", [
      "scripts/texture.py",
      f + ".source",
      f + ".jpg",
      "1024",
    ]);
    t.setImage(await readFile(f + ".jpg")).setMimeType("image/jpeg");
  }
  if (
    doc
      .getRoot()
      .listMeshes()
      .some((m) => m.listPrimitives().some((p) => !p.getAttribute("NORMAL")))
  )
    await doc.transform(normals({ overwrite: false }), weld());
  const output = `public/assets/props/${id}.glb`;
  await io.write(output, doc);
  const record = {
    id,
    source,
    sourceTriangles: before,
    triangles: count(),
    bytes: (await stat(output)).size,
  };
  report.push(record);
  console.log(record);
  execFileSync(
    "python",
    [
      "scripts/render-collection.py",
      output,
      `work/encounter-assets/${id}.webp`,
    ],
    { stdio: "inherit" },
  );
  const portrait = id.startsWith("poison-")
    ? `public/assets/bosses/${id}.webp`
    : `public/assets/tools/${id === "shotgun" ? "rifle" : id}.webp`;
  execFileSync("python", [
    "-c",
    'from PIL import Image; from pathlib import Path; import sys; im=Image.open(sys.argv[1]).convert("RGBA"); im.thumbnail((384,384)); Path(sys.argv[2]).parent.mkdir(parents=True,exist_ok=True); im.save(sys.argv[2],"WEBP",quality=90)',
    `work/encounter-assets/${id}.webp`,
    portrait,
  ]);
}
await writeFile(
  "public/assets/props/encounter-manifest.json",
  JSON.stringify(report, null, 2),
);
