import { open, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  isMain,
  readConnectionString,
  reportScriptError,
  runPostgresTool,
} from "./postgres-tools.js";

function defaultOutputPath(): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return path.join("db-exports", `spotjiggy-dev-${timestamp}.dump`);
}

async function exportDatabase(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(
      "Usage: pnpm --filter @workspace/scripts run db:export -- [output.dump]\n" +
        "Exports the development database in PostgreSQL custom archive format.\n",
    );
    return;
  }
  if (args.length > 1) {
    throw new Error("Provide at most one output file path.");
  }

  const connectionString = readConnectionString("DATABASE_URL");
  const outputPath = path.resolve(args[0] ?? defaultOutputPath());
  await mkdir(path.dirname(outputPath), { recursive: true, mode: 0o700 });

  const outputFile = await open(outputPath, "wx", 0o600).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EEXIST") {
      throw new Error("The output file already exists; choose a new path to avoid overwriting it.");
    }
    throw error;
  });
  await outputFile.close();

  try {
    await runPostgresTool("pg_dump", connectionString, [
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      `--file=${outputPath}`,
    ]);
  } catch (error) {
    await rm(outputPath, { force: true });
    throw error;
  }

  process.stdout.write(`Development database exported to ${outputPath}\n`);
  process.stdout.write("The archive contains database schema and data; keep it private.\n");
}

if (isMain(import.meta.url)) {
  exportDatabase().catch(reportScriptError);
}
