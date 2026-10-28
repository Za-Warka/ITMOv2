import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// The caller serializes runs. Neither this hook nor the runner edits watched files.
export async function afterSave(root, config, changedFiles) {
  const header = `[save-hook] ${new Date().toISOString()}\n[save-hook] Changed: ${changedFiles.join(", ")}\n[save-hook] Runner: sh ${config.runner}\n`;
  process.stdout.write(header);
  let output = header;
  const code = await new Promise((done) => {
    const child = spawn("sh", [resolve(root, config.runner)], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (chunk) => {
        const text = chunk.toString();
        output += text;
        process.stdout.write(text);
      });
    child.on("error", (error) => {
      const text = `[save-hook] Cannot start runner: ${error.message}\n`;
      output += text;
      process.stderr.write(text);
    });
    child.on("close", (status) => done(status ?? 1));
  });
  const result = `[save-hook] Result: ${code === 0 ? "PASS" : "FAIL"} (exit ${code})\n`;
  output += result;
  const log = resolve(root, config.log);
  await mkdir(dirname(log), { recursive: true });
  await writeFile(log, output);
  process.stdout.write(result);
  return code;
}
