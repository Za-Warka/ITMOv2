import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { demoSnapshot } from "../src/fixtures/demo";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const client = new Client({ name: "repo-atlas-verifier", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["--import", "tsx", resolve("mcp/server.ts")],
  stderr: "pipe",
});
try {
  await client.connect(transport);
  const tools = await client.listTools();
  const snapshot = {
    ...demoSnapshot,
    commits: demoSnapshot.commits.slice(0, 30),
    coverage: {
      ...demoSnapshot.coverage,
      loadedCommitCount: 30,
      rangeEnd: demoSnapshot.commits[29].date,
      historyComplete: false,
      reasons: ["Тестовая выборка: 30 коммитов."],
    },
  };
  const args = { snapshot, date: snapshot.coverage.rangeEnd };
  const success = await client.callTool({
    name: "preview_civilization",
    arguments: args,
  });
  const invalidDate = await client.callTool({
    name: "preview_civilization",
    arguments: { ...args, date: "not-a-date" },
  });
  const invalidLanguage = await client.callTool({
    name: "preview_civilization",
    arguments: {
      ...args,
      snapshot: { ...snapshot, languages: { Python: -1 } },
    },
  });
  if (success.isError || !invalidDate.isError || !invalidLanguage.isError)
    throw new Error("MCP verification failed");
  const content = success.content as { type: string; text: string }[];
  const result = JSON.parse(content[0].text);
  if (result.eraName !== "Поселение" || result.commitCount !== 30)
    throw new Error("Unexpected world");
  const evidence = {
    transport: "MCP stdio, SDK Client → SDK Server",
    verifiedAt: new Date().toISOString(),
    tools: tools.tools.map((t) => t.name),
    success: { input: args, result },
    invalidDate: { input: { date: "not-a-date" }, response: invalidDate },
    invalidLanguage: {
      input: { languages: { Python: -1 } },
      response: invalidLanguage,
    },
  };
  await mkdir("docs", { recursive: true });
  await writeFile(
    "docs/mcp-verification.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(
    "MCP passed: tools/list, 30 commits → Поселение, invalid date and negative language rejected. Evidence: docs/mcp-verification.json",
  );
} finally {
  await client.close();
}
