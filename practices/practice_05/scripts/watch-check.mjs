import { watch, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterSave } from "../hooks/after-save.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const config = JSON.parse(
  readFileSync(resolve(root, "hooks/config.json"), "utf8"),
);
const once = process.argv.includes("--once");
const changed = new Set();
const watchers = [];
let timer,
  running = false;
function close() {
  clearTimeout(timer);
  for (const watcher of watchers) watcher.close();
}
async function check() {
  if (running || !changed.size) return;
  running = true;
  const files = [...changed].sort();
  changed.clear();
  try {
    const code = await afterSave(root, config, files);
    if (once) {
      close();
      process.exitCode = code;
      return;
    }
  } catch (error) {
    console.error(`[save-hook] ${error.message}`);
    close();
    process.exitCode = 1;
    return;
  } finally {
    running = false;
  }
  if (changed.size) timer = setTimeout(check, config.debounceMs);
}
for (const dir of config.watchPaths) {
  const watcher = watch(resolve(root, dir), { recursive: true }, (_, name) => {
    if (!name || !config.extensions.includes(extname(name))) return;
    changed.add(`${dir}/${name}`);
    clearTimeout(timer);
    timer = setTimeout(check, config.debounceMs);
  });
  watcher.on("error", (error) => {
    console.error(`[save-hook] Watcher failed: ${error.message}`);
    close();
    process.exitCode = 1;
  });
  watchers.push(watcher);
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
console.log(
  `[save-hook] READY: ${config.watchPaths.join(", ")}; debounce ${config.debounceMs} ms`,
);
