
import Fastify from "fastify";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const app = Fastify({ logger: true });

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../pandora-runtime",
);

type PluginId =
  | "add"
  | "logger"
  | "infinite_loop"
  | "unauthorized"
  | "memory";

interface RunReport {
  success: boolean;
  duration_us: number;
  fuel_remaining: number;
  message: string;
}

app.get("/health", async () => ({
  status: "ok",
  service: "pandora-api",
}));

app.post<{
  Body: {
    plugin?: PluginId;
    input?: { a?: number; b?: number };
  };
}>("/api/plugins/run", async (request, reply) => {
  const { plugin, input } = request.body ?? {};

  if (
    !plugin ||
    !["add", "logger", "infinite_loop", "unauthorized", "memory"].includes(plugin)
  ) {
    return reply.code(400).send({
      error: "Invalid plugin ID",
      allowed: ["add", "logger", "infinite_loop", "unauthorized", "memory"],
    });
  }

  const args: string[] = ["run", "--quiet", "--bin", "run_plugin", "--", plugin];

  if (plugin === "add") {
    const { a, b } = input ?? {};

    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a! < -2147483648 ||
      a! > 2147483647 ||
      b! < -2147483648 ||
      b! > 2147483647
    ) {
      return reply.code(400).send({
        error: "Plugin add requires integer inputs a and b in the i32 range",
      });
    }

    args.push(String(a), String(b));
  }

  return await new Promise((resolve) => {
    const child = spawn("cargo", args, {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (status: number, body: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(reply.code(status).send(body));
    };

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(504, { error: "Plugin execution timed out" });
    }, 5000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > 64 * 1024) {
        child.kill("SIGKILL");
        finish(502, { error: "Runtime output exceeded limit" });
      }
    });

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk.slice(0, 4096);
    });

    child.on("error", (error) => {
      finish(500, { error: "Could not start runtime", details: error.message });
    });

    child.on("close", (code) => {
      if (settled) return;

      try {
        const report = JSON.parse(stdout.trim()) as RunReport;
        finish(200, {
          ...report,
          runtime_exit_code: code,
          logs: stderr.trim(),
        });
      } catch {
        finish(500, {
          error: "Runtime returned invalid JSON",
          runtime_exit_code: code,
          details: stderr.trim(),
        });
      }
    });
  });
});

try {
  await app.listen({ port: 3001, host: "127.0.0.1" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
