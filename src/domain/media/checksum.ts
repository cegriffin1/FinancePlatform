import { createHash } from "crypto";

/** Deterministic SHA-256 hex digest of the original file bytes. */
export function sha256Hex(bytes: ArrayBuffer | Uint8Array | Buffer): string {
  const buf = Buffer.isBuffer(bytes)
    ? bytes
    : Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes);
  return createHash("sha256").update(buf).digest("hex");
}
