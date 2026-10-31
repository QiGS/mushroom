// Exercise the real launcher without opening a browser or leaving a server behind.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";

const project = process.argv[2]
  ? path.resolve(process.argv[2])
  : fileURLToPath(new URL("..", import.meta.url));
const mac = process.platform === "darwin";
const bundledNode = path.join(project, "runtime", "node.exe");
const executable =
  process.platform === "win32" && existsSync(bundledNode)
    ? bundledNode
    : process.execPath;
const child = spawn(
  mac ? "/bin/bash" : executable,
  mac ? ["启动游戏.command"] : ["scripts/serve-game.cjs"],
  {
    cwd: project,
    env: { ...process.env, MUSHROOM_NO_OPEN: "1", MUSHROOM_PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
let log = "";
let startupError;
let exited = false;
child.stdout.on("data", (chunk) => {
  log += chunk;
});
child.stderr.on("data", (chunk) => {
  log += chunk;
});
child.on("error", (error) => {
  startupError = error;
});
child.on("exit", () => {
  exited = true;
});
const done = new Promise((resolve) => child.on("close", resolve));
try {
  const deadline = Date.now() + 120_000;
  let url;
  while (!(url = log.match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0])) {
    if (startupError) throw startupError;
    if (exited || Date.now() > deadline)
      throw new Error(`Launcher did not start:\n${log}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const options = { signal: AbortSignal.timeout(5000) };
  const health = await fetch(`${url}__mushroom_health`, options);
  assert.equal((await health.json()).app, "mushroom-local-game");
  const page = await fetch(url, options);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<html/);
  const model = await fetch(`${url}assets/traveler.glb`, {
    ...options,
    method: "HEAD",
  });
  assert.equal(model.status, 200);
  assert.equal(model.headers.get("content-type"), "model/gltf-binary");
  assert.ok(Number(model.headers.get("content-length")) > 2_000_000);
  const manifest = await (
    await fetch(`${url}assets/collection/manifest.json`, options)
  ).json();
  assert.equal(manifest.length, 15);
  await Promise.all(
    manifest.flatMap((item) =>
      ["glb", "webp"].map(async (ext) => {
        const asset = await fetch(`${url}assets/collection/${item.id}.${ext}`, {
          ...options,
          method: "HEAD",
        });
        assert.equal(asset.status, 200, `${item.id}.${ext}`);
        assert.equal(
          asset.headers.get("content-type"),
          ext === "glb" ? "model/gltf-binary" : "image/webp",
        );
        assert.ok(Number(asset.headers.get("content-length")) > 1000);
      }),
    ),
  );
  const artwork = await (
    await fetch(`${url}assets/journal/manifest.json`, options)
  ).json();
  assert.equal(artwork.length, 24);
  await Promise.all(
    artwork.map(async (item) => {
      const asset = await fetch(`${url}assets/journal/${item.file}`, {
        ...options,
        method: "HEAD",
      });
      assert.equal(asset.status, 200);
      assert.equal(asset.headers.get("content-type"), "image/webp");
      assert.ok(Number(asset.headers.get("content-length")) > 1000);
    }),
  );
  for (const [file, mime] of [
    ["villagers/grandma.glb", "model/gltf-binary"],
    ["villagers/uncle.glb", "model/gltf-binary"],
    ["fonts/wildwood-wenkai.woff2", "font/woff2"],
    ["fonts/jingmai-rounded.woff2", "font/woff2"],
    ...["note", "fruit", "hat", "shoes", "bell", "compass"].map((id) => [
      `tools/${id}.webp`,
      "image/webp",
    ]),
    ...["weather-board", "grandma-dialog", "jingmai-logo"].map((id) => [
      `ui/${id}.webp`,
      "image/webp",
    ]),
    ...["near_A_v3", "near_B", "mid_A", "mid_B", "far_A", "far_B"].map((id) => [
      `mountains/mountain_${id}.glb`,
      "model/gltf-binary",
    ]),
    ["ui/jingmai-title-white.png", "image/png"],
  ]) {
    const r = await fetch(`${url}assets/${file}`, {
      ...options,
      method: "HEAD",
    });
    assert.equal(r.status, 200, file);
    assert.equal(r.headers.get("content-type"), mime);
    assert.ok(Number(r.headers.get("content-length")) > 1000);
  }
  assert.equal((await fetch(`${url}missing-file`, options)).status, 404);
  for (const id of [
    "bridge",
    "rock",
    "noticeboard",
    "stele",
    "campfire",
    "bed",
    "weather-vane",
    "canyon-one", "canyon-two", "poison-ant", "fallen-log", "rock-two", "rock-three",
  ]) {
    const r = await fetch(`${url}assets/props/${id}.glb`, {
      ...options,
      method: "HEAD",
    });
    assert.equal(r.status, 200, id);
    assert.equal(r.headers.get("content-type"), "model/gltf-binary");
  }
  const music = `${url}assets/audio/jingmai-bgm.mp3`;
  for(const file of ['ui/wild-mushrooms-title.webp',...['axe','rifle','boots','rice','water','salt','herb'].map(id=>`tools/${id}.webp`)]) {
    const r=await fetch(`${url}assets/${file}`,{...options,method:'HEAD'});assert.equal(r.status,200,file);assert.equal(r.headers.get('content-type'),'image/webp');
  }
  const audio = await fetch(music, { ...options, method: "HEAD" });
  assert.equal(audio.status, 200);
  assert.equal(audio.headers.get("content-type"), "audio/mpeg");
  const size = Number(audio.headers.get("content-length"));
  assert.ok(size > 1_000_000);
  for (const [range, start, end] of [
    ["bytes=0-1", 0, 1],
    ["bytes=100-199", 100, 199],
    ["bytes=-32", size - 32, size - 1],
    [`bytes=${size - 20}-`, size - 20, size - 1],
  ]) {
    const r = await fetch(music, { ...options, headers: { Range: range } });
    assert.equal(r.status, 206);
    assert.equal(
      r.headers.get("content-range"),
      `bytes ${start}-${end}/${size}`,
    );
    assert.equal((await r.arrayBuffer()).byteLength, end - start + 1);
  }
  for (const range of [
    "bytes=-0",
    "bytes=9-1",
    `bytes=${size}-`,
    "bytes=0-1,4-5",
  ])
    assert.equal(
      (await fetch(music, { ...options, headers: { Range: range } })).status,
      416,
    );
  assert.equal((await fetch(url, { ...options, method: "POST" })).status, 405);
  assert.equal(
    (await fetch(`${url}%2e%2e%2fpackage.json`, options)).status,
    400,
  );
  console.log(
    `Launcher passed on ${process.platform}/${process.arch}: page, traveler, 30 collection assets, 24 journal illustrations, villagers, offline font, title artwork, HTTP boundaries.`,
  );
} finally {
  if (!exited) child.kill("SIGTERM");
  await done;
}
