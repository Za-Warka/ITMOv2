import { spawn } from "node:child_process";
import { copyFile, mkdir, writeFile, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const probe = resolve(root, `src/hook-demo-${process.pid}.ts`);
const child = spawn(
  process.execPath,
  [resolve(root, "scripts/watch-check.mjs"), "--once"],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
);
let output = "",
  triggered = false,
  created = false,
  writeJob;
child.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  output += text;
  process.stdout.write(text);
  if (!triggered && output.includes("[save-hook] READY")) {
    triggered = true;
    writeJob = writeFile(
      probe,
      "// Temporary source save to demonstrate the after-save hook.\nexport {};\n",
      { flag: "wx" },
    ).then(() => {
      created = true;
    });
    writeJob.catch((error) => {
      console.error(error);
      child.kill("SIGTERM");
    });
  }
});
child.stderr.on("data", (chunk) => process.stderr.write(chunk));
const timeout = setTimeout(() => child.kill("SIGTERM"), 120000);
try {
  const code = await new Promise((done, reject) => {
    child.on("error", reject);
    child.on("close", done);
  });
  await writeJob;
  if (code !== 0 || !output.includes("[save-hook] Result: PASS"))
    throw new Error("Hook demo did not pass");
  await mkdir(resolve(root, "docs"), { recursive: true });
  await copyFile(
    resolve(root, "output/hooks/latest.log"),
    resolve(root, "docs/hook-example.log"),
  );
  console.log("Evidence: docs/hook-example.log");
} finally {
  clearTimeout(timeout);
  if (created) await unlink(probe);
}
