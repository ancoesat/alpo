// Server-only (Node runtime). The first password comes from SITE_PASSWORD;
// once changed from the desktop, a salted scrypt hash is kept in DATA_DIR
// (a Docker volume) and the env password stops working.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { timingSafeStringEqual } from "@/lib/session";

const FILE = path.join(process.env.DATA_DIR ?? "data", "password");

function hashWithSalt(password: string, salt: string): Buffer {
  return scryptSync(password, salt, 64);
}

export async function checkPassword(password: string): Promise<boolean> {
  const stored = await readFile(FILE, "utf8").catch(() => null);
  if (stored) {
    const [salt, hex] = stored.trim().split(":");
    const expected = Buffer.from(hex ?? "", "hex");
    const actual = hashWithSalt(password, salt ?? "");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
  const envPassword = process.env.SITE_PASSWORD;
  return Boolean(envPassword) && timingSafeStringEqual(password, envPassword!);
}

export async function setPassword(password: string): Promise<void> {
  const salt = randomBytes(16).toString("hex");
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, `${salt}:${hashWithSalt(password, salt).toString("hex")}`, { mode: 0o600 });
}
