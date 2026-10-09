#!/usr/bin/env node
/**
 * Rendu image par image de render/film.html.
 *
 *   node tools/render.mjs stills 5 30 61.5 ...            → build/stills/t_XXX.png
 *   node tools/render.mjs video <debut> <fin> <sortie.mp4> → segment vidéo (25 i/s, sans perte visible)
 *   node tools/render.mjs all [workers]                     → build/video_clean.mp4 (0 → 300 s, en parallèle)
 *
 * Chaque image est une fonction pure de t : on appelle window.render(t) puis on capture.
 * Chromium : PLAYWRIGHT_BROWSERS_PATH ou CHROMIUM_PATH. Dépendance : playwright (voir README).
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(process.env.PLAYWRIGHT_REQUIRE_FROM || join(ROOT, "tools", "package.json"));
const { chromium } = require("playwright");
const FPS = 25, TOTAL = 300;
const PAGE = pathToFileURL(join(ROOT, "render", "film.html")).href;

async function openPage() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--allow-file-access-from-files", "--force-color-profile=srgb", "--hide-scrollbars", "--font-render-hinting=none"],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => { console.error("Erreur page :", e.message); process.exitCode = 2; });
  await page.goto(PAGE, { waitUntil: "load" });
  await page.evaluate(() => window.ready);
  return { browser, page };
}

async function frame(page, t, type = "jpeg") {
  await page.evaluate((t) => window.render(t), t);
  return page.screenshot({ type, quality: type === "jpeg" ? 96 : undefined, animations: "disabled" });
}

async function stills(times) {
  const { browser, page } = await openPage();
  const dir = join(ROOT, "build", "stills");
  mkdirSync(dir, { recursive: true });
  for (const t of times) {
    const buf = await frame(page, t, "png");
    const f = join(dir, `t_${String(t.toFixed(2)).padStart(6, "0")}.png`);
    writeFileSync(f, buf);
    console.log(f);
  }
  await browser.close();
}

async function video(from, to, out) {
  const { browser, page } = await openPage();
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p", "-r", String(FPS), out], { stdio: ["pipe", "inherit", "inherit"] });
  const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS);
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const buf = await frame(page, f / FPS);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if ((f - f0) % 250 === 0) console.log(`[${from}-${to}] image ${f - f0}/${f1 - f0} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on("close", (c) => (c === 0 ? r() : j(new Error("ffmpeg " + c)))));
  await browser.close();
}

async function all(workers = 4) {
  const dir = join(ROOT, "build", "segments");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // Découpage sur des secondes entières : chaque segment contient exactement (fin-début)*25 images.
  const step = Math.ceil(TOTAL / workers);
  const parts = [];
  for (let i = 0; i < workers; i++) {
    const a = i * step, b = Math.min(TOTAL, (i + 1) * step);
    if (a < b) parts.push([a, b, join(dir, `seg_${i}.mp4`)]);
  }
  const self = fileURLToPath(import.meta.url);
  await Promise.all(parts.map(([a, b, out]) => new Promise((res, rej) => {
    const p = spawn(process.execPath, [self, "video", String(a), String(b), out], { stdio: "inherit", env: process.env });
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(`segment ${a}-${b} : ${c}`))));
  })));
  const list = join(dir, "list.txt");
  writeFileSync(list, parts.map(([, , o]) => `file '${o}'`).join("\n") + "\n");
  const out = join(ROOT, "build", "video_clean.mp4");
  await new Promise((r, j) => spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", out], { stdio: "inherit" })
    .on("close", (c) => (c === 0 ? r() : j(new Error("concat " + c)))));
  console.log("→", out);
}

const [mode, ...args] = process.argv.slice(2);
if (mode === "stills") await stills(args.map(Number));
else if (mode === "video") await video(Number(args[0]), Number(args[1]), args[2]);
else if (mode === "all") await all(Number(args[0] || 4));
else { console.log("Usage : stills <t...> | video <début> <fin> <sortie> | all [workers]"); process.exit(1); }
