import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getEnv } from "@/lib/env";

/**
 * Server-side credential vault abstraction.
 * Production should use KMS / secret manager; local uses AES-256-GCM when a key is set,
 * otherwise opaque base64 refs suitable for SIMULATION only.
 */
export interface CredentialVault {
  seal(plaintext: string): string;
  open(sealed: string): string;
}

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

class AesGcmVault implements CredentialVault {
  constructor(private readonly key: Buffer) {}

  seal(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `aesgcm:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
  }

  open(sealed: string): string {
    const [prefix, ivB64, tagB64, dataB64] = sealed.split(":");
    if (prefix !== "aesgcm" || !ivB64 || !tagB64 || !dataB64) {
      throw new Error("Invalid sealed credential");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }
}

class SimulationVault implements CredentialVault {
  seal(plaintext: string): string {
    return `sim:${Buffer.from(plaintext, "utf8").toString("base64")}`;
  }
  open(sealed: string): string {
    if (!sealed.startsWith("sim:")) throw new Error("Invalid simulation credential");
    return Buffer.from(sealed.slice(4), "base64").toString("utf8");
  }
}

let vault: CredentialVault | null = null;

export function getCredentialVault(): CredentialVault {
  if (vault) return vault;
  const key = process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY;
  if (key && key.length >= 16) {
    vault = new AesGcmVault(deriveKey(key));
  } else {
    vault = new SimulationVault();
  }
  return vault;
}

export function getProviderMode(): "SIMULATION" | "LIVE" {
  const env = getEnv();
  if (env.PROVIDER_MODE === "LIVE" && env.ALLOW_LIVE_AD_PUBLISH) {
    return "LIVE";
  }
  return "SIMULATION";
}

export type TokenBundle = {
  access_token: string;
  refresh_token?: string | null;
  expires_at?: string | null;
  scopes?: string[];
};

export function sealTokenBundle(bundle: TokenBundle): string {
  return getCredentialVault().seal(JSON.stringify(bundle));
}

export function openTokenBundle(ref: string): TokenBundle {
  return JSON.parse(getCredentialVault().open(ref)) as TokenBundle;
}
