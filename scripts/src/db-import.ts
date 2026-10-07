import { access } from "node:fs/promises";
import path from "node:path";
import {
  isMain,
  parseConnectionString,
  readConnectionString,
  reportScriptError,
  runPostgresTool,
  sameDatabase,
} from "./postgres-tools.js";

function printUsage(): void {
  process.stdout.write(
    "Usage: RESTORE_DATABASE_URL=... pnpm --filter @workspace/scripts run db:import -- <archive.dump> [--replace]\n" +
      "Restores a custom-format PostgreSQL archive into RESTORE_DATABASE_URL.\n" +
      "--replace drops conflicting objects before restoring; this is destructive.\n",
  );
}

async function importDatabase(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

  const replace = args.includes("--replace");
  const archiveArgs = args.filter((arg) => arg !== "--replace");
  if (archiveArgs.length !== 1) {
    printUsage();
    throw new Error("Provide exactly one archive file path.");
  }

  const archivePath = path.resolve(archiveArgs[0]);
  await access(archivePath).catch(() => {
    throw new Error(`Archive file not found: ${archivePath}`);
  });

  const targetConnectionString = readConnectionString("RESTORE_DATABASE_URL");
  const target = parseConnectionString(targetConnectionString, "RESTORE_DATABASE_URL");
  const sourceConnectionString = process.env.DATABASE_URL;

  if (
    sourceConnectionString &&
    sameDatabase(target, parseConnectionString(sourceConnectionString, "DATABASE_URL"))
  ) {
    throw new Error("The restore target matches DATABASE_URL; refusing to restore over the source.");
  }

  const restoreArgs = [
    "--no-owner",
    "--no-privileges",
    "--exit-on-error",
    "--single-transaction",
  ];
  if (replace) {
    restoreArgs.push("--clean", "--if-exists");
  }
  restoreArgs.push(archivePath);

  if (replace) {
    process.stdout.write(
      "Warning: --replace will drop objects included in the archive from the target database.\n",
    );
  }
  await runPostgresTool("pg_restore", targetConnectionString, restoreArgs);
  process.stdout.write(`Database archive restored to ${target.host}/${target.database}\n`);
}

if (isMain(import.meta.url)) {
  importDatabase().catch(reportScriptError);
}
