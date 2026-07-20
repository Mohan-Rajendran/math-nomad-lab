import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const output = fileURLToPath(new URL("../dist/", import.meta.url));

async function collectJavaScript(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectJavaScript(path));
    if (entry.isFile() && entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}

test("the deployment contains the Math Nomad application shell", async () => {
  const html = await readFile(join(output, "index.html"), "utf8");
  assert.match(html, /<title>Kolam Lab · Math Nomad<\/title>/);
  assert.match(html, /mathnomad-logo\.png/);
  assert.match(html, /<div id="root" data-page="landing"><\/div>/);
  assert.match(html, /\.\/assets\/[^\"]+\.js/);
  assert.ok((await stat(join(output, "mathnomad-logo.png"))).size > 1_000);
});

test("the deployment contains refresh-safe square pages and an embed entry", async () => {
  const entries = [
    ["square-kolam-tile-challenge/index.html", "square-challenge"],
    ["sandbox-2/index.html", "sandbox-2"],
    ["sandbox-3/index.html", "sandbox-3"],
    ["embed/square-kolam-tile-challenge/index.html", "square-challenge-embed"],
  ];

  for (const [path, page] of entries) {
    const html = await readFile(join(output, path), "utf8");
    assert.match(html, new RegExp(`data-page="${page}"`));
    assert.match(html, /assets\/[^\"]+\.js/);
  }

  const challenge = await readFile(join(output, "square-kolam-tile-challenge/index.html"), "utf8");
  const embed = await readFile(join(output, "embed/square-kolam-tile-challenge/index.html"), "utf8");
  assert.match(challenge, /<title>Square Kolam Tile Challenge · Math Nomad<\/title>/);
  assert.match(embed, /<title>Square Kolam Tile Challenge · Math Nomad<\/title>/);
});

test("the deployment contains the octahedron page and article embed", async () => {
  const standalone = await readFile(join(output, "kolams-on-an-octahedron/index.html"), "utf8");
  const embed = await readFile(join(output, "embed/kolams-on-an-octahedron/index.html"), "utf8");

  assert.match(standalone, /<title>Kolams on an Octahedron · Math Nomad<\/title>/);
  assert.match(embed, /<title>Kolams on an Octahedron · Math Nomad<\/title>/);
  assert.match(standalone, /id="octahedron-root" data-mode="standalone"/);
  assert.match(embed, /id="octahedron-root" data-mode="embed"/);
  assert.match(standalone, /assets\/[^\"]+\.js/);
  assert.match(embed, /assets\/[^\"]+\.js/);
});

test("the client bundle contains all four interactive sandboxes", async () => {
  const files = await collectJavaScript(join(output, "assets"));
  const bundle = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  assert.match(bundle, /Build/);
  assert.match(bundle, /Slide/);
  assert.match(bundle, /Match/);
  assert.match(bundle, /Square Kolam Tile Challenge/);
  assert.match(bundle, /Slide to a New Kolam/);
  assert.match(bundle, /Move X to Y/);
  assert.match(bundle, /Show solution/);
  assert.match(bundle, /Choose an orbit/);
  assert.match(bundle, /Kolams on an octahedron/);
  assert.match(bundle, /Fold the net/);
  assert.match(bundle, /Three equal arms/);
  assert.doesNotMatch(bundle, /littleboy300\.chatgpt\.site/);
});
