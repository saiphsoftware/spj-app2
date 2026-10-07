import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

type ParsedConnection = {
  uri: URL;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
};

function decode(value: string, label: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(`The database connection string has an invalid encoded ${label}.`);
  }
}

export function parseConnectionString(value: string, variableName: string): ParsedConnection {
  let uri: URL;
  try {
    uri = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL connection URL.`);
  }

  if (!["postgres:", "postgresql:"].includes(uri.protocol)) {
    throw new Error(`${variableName} must use the postgres:// or postgresql:// scheme.`);
  }

  const host = uri.hostname.replace(/^\[|\]$/g, "");
  const database = decode(uri.pathname.replace(/^\/+/, ""), "database name");
  const username = decode(uri.username, "username");
  const queryPassword = uri.searchParams.get("password");
  if (
    queryPassword !== null &&
    [...uri.searchParams.keys()].some((key) => key.toLowerCase() === "sslpassword")
  ) {
    throw new Error(`${variableName} uses an unsupported combination of password URL parameters.`);
  }
  const password = decode(uri.password || queryPassword || "", "password");

  if (!host || host.includes(",") || !database || !username) {
    throw new Error(
      `${variableName} must include one database host, a database name, and a username.`,
    );
  }

  return {
    uri,
    host,
    port: uri.port || "5432",
    database,
    username,
    password,
  };
}

export function readConnectionString(variableName: string): string {
  const value = process.env[variableName];
  if (!value) {
    throw new Error(`${variableName} is required. Set it in the workspace environment, not in chat.`);
  }
  return value;
}

export function sameDatabase(first: ParsedConnection, second: ParsedConnection): boolean {
  return (
    first.host.toLowerCase() === second.host.toLowerCase() &&
    first.port === second.port &&
    first.database === second.database
  );
}

function escapePassfileField(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/\*/g, "\\*");
}

export async function runPostgresTool(
  tool: "pg_dump" | "pg_restore",
  connectionString: string,
  args: string[],
): Promise<void> {
  const parsed = parseConnectionString(connectionString, "Database URL");
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "spotjiggy-pg-"));
  const passfile = path.join(tempDir, "pgpass");

  try {
    const fields = [
      parsed.host,
      parsed.port,
      parsed.database,
      parsed.username,
      parsed.password,
    ].map(escapePassfileField);
    await writeFile(passfile, `${fields.join(":")}\n`, { mode: 0o600 });

    const safeUri = new URL(parsed.uri);
    safeUri.password = "";
    safeUri.searchParams.delete("password");

    const env: NodeJS.ProcessEnv = { ...process.env, PGPASSFILE: passfile };
    delete env.PGPASSWORD;
    delete env.DATABASE_URL;
    delete env.RESTORE_DATABASE_URL;

    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn(tool, ["--dbname", safeUri.toString(), ...args], {
        env,
        stdio: "inherit",
      });
      child.once("error", reject);
      child.once("close", (code) => resolve(code ?? 1));
    });

    if (exitCode !== 0) {
      throw new Error(`${tool} failed with exit code ${exitCode}.`);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function reportScriptError(error: unknown): void {
  const message = error instanceof Error ? error.message : "An unexpected error occurred.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

export function isMain(moduleUrl: string): boolean {
  return Boolean(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === moduleUrl);
}
