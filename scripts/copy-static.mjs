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

// Copy the entire icon tree so logo and Phosphor assets stay organized together.
const iconsPath = resolve("src/icons");
const distIconsPath = resolve("dist/icons");
if (existsSync(iconsPath)) {
  cpSync(iconsPath, distIconsPath, { recursive: true });
}

// Copy vendor assets (e.g., balloon.css) into the dist folder so extension
// can load local CSS/JS without external CDNs.
const vendorPath = resolve("src/vendor");
const distVendorPath = resolve("dist/vendor");
if (existsSync(vendorPath)) {
  cpSync(vendorPath, distVendorPath, { recursive: true });
}
