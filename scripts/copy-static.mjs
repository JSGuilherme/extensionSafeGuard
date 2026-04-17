import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const staticFiles = ["manifest.json", "popup.html", "popup.css"];
const distPath = resolve("dist");

if (!existsSync(distPath)) {
  mkdirSync(distPath, { recursive: true });
}

for (const fileName of staticFiles) {
  cpSync(resolve(fileName), resolve("dist", fileName));
}
