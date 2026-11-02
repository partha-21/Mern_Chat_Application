// Bundles the store (Vite-specific import.meta.env) with esbuild and runs the test in Node.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
await build({
  entryPoints: ["test/store.test.js"],
  bundle: true,
  packages: "external", // keep npm deps as real imports (axios etc. use require internally)
  platform: "node",
  format: "esm",
  outfile: ".tmp/store.test.mjs",
  define: { "import.meta.env": "{}" }, // all VITE_* vars undefined, as in a default build
  logLevel: "error",
});
execFileSync("node", [".tmp/store.test.mjs"], { stdio: "inherit" });
