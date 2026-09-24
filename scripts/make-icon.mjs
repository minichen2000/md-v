import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";

const svgPath = new URL("../assets-src/icon.svg", import.meta.url);
const outPath = new URL("../assets-src/icon.png", import.meta.url);

const svg = readFileSync(svgPath, "utf8");
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1024 },
  font: { loadSystemFonts: true },
  background: "rgba(0,0,0,0)",
});
const png = resvg.render().asPng();
writeFileSync(outPath, png);
console.log(`written assets-src/icon.png (${png.length} bytes, 1024x1024)`);
