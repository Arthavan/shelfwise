// The legacy build ships core-js polyfills (e.g. Map.prototype.getOrInsertComputed, used by pdf.js v6),
// so it works in browsers that do not yet have those APIs. It must match the build loaded in src/components/reader/pdf-loader.ts.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const src = path.resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs");
const dest = path.resolve("public/pdf.worker.min.mjs");
if (!existsSync(src)) {
  console.warn("pdfjs-dist not installed; skipping worker copy");
  process.exit(0);
}
mkdirSync(path.dirname(dest), { recursive: true });
copyFileSync(src, dest);
