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
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /\.\/assets\/[^\"]+\.js/);
  assert.ok((await stat(join(output, "mathnomad-logo.png"))).size > 1_000);
});

test("the client bundle contains all three interactive sandboxes", async () => {
  const files = await collectJavaScript(join(output, "assets"));
  const bundle = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  assert.match(bundle, /Build/);
  assert.match(bundle, /Slide/);
  assert.match(bundle, /Match/);
  assert.match(bundle, /Show solution/);
  assert.match(bundle, /Choose an orbit/);
  assert.doesNotMatch(bundle, /littleboy300\.chatgpt\.site/);
});
