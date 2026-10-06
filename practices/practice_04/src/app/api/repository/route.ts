import { loadRepository, GitHubError } from "@/server/github/client";
import { parseRepository } from "@/domain/world";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  let name: string;
  try {
    name = parseRepository(new URL(request.url).searchParams.get("repo") ?? "");
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Некорректная ссылка" },
      { status: 400 },
    );
  }
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        if (!closed)
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        const snapshot = await loadRepository(name, (stage, count) =>
          send({ type: "progress", stage, count }),
        );
        send({ type: "result", snapshot });
      } catch (error) {
        send({
          type: "error",
          message:
            error instanceof GitHubError
              ? error.message
              : "Не удалось прочитать данные GitHub. Попробуйте ещё раз.",
          retryAfter:
            error instanceof GitHubError ? error.retryAfter : undefined,
        });
      } finally {
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
