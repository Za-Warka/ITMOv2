// Filesystem save hook. Works independently of the agent client.
import { watch } from "node:fs";
import { spawn } from "node:child_process";
let timer,
  running = false,
  queued = false;
function check() {
  if (running) {
    queued = true;
    return;
  }
  running = true;
  console.log("[save-hook] Running lint, types and unit tests");
  const child = spawn("npm", ["run", "check"], { stdio: "inherit" });
  child.on("exit", (code) => {
    running = false;
    console.log(`[save-hook] Result: ${code === 0 ? "PASS" : "FAIL"}`);
    if (queued) {
      queued = false;
      check();
    }
  });
}
for (const dir of ["src", "tests", "mcp"])
  watch(dir, { recursive: true }, (_, name) => {
    if (!name || !/\.(ts|tsx|css)$/.test(name)) return;
    clearTimeout(timer);
    timer = setTimeout(check, 500);
  });
console.log(
  "[save-hook] Watching src/, tests/, mcp/. Save a source file to run checks.",
);
