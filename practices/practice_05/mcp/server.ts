import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { buildWorld, snapshotSchema } from "../src/domain/world";
const server = new McpServer({ name: "repo-atlas", version: "0.1.0" });
server.registerTool(
  "preview_civilization",
  {
    title: "Предпросмотр цивилизации",
    description:
      "Рассчитать эпоху, жителей и постройки по нормализованной истории репозитория. Та же модель, что используется на карте Repo Atlas. До 10000 коммитов.",
    inputSchema: {
      snapshot: snapshotSchema,
      date: z.iso.datetime(),
      includeBots: z.boolean().optional(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ snapshot, date, includeBots }) => {
    const world = buildWorld(snapshot, date, includeBots);
    return { content: [{ type: "text", text: JSON.stringify(world) }] };
  },
);
await server.connect(new StdioServerTransport());
