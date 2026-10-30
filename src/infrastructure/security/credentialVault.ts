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

export type TokenBundle = {
  access_token: string;
  refresh_token?: string | null;
  expires_at?: string | null;
  scopes?: string[];
};

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

/** Test helper — clears cached vault after env key changes. */
export function resetCredentialVault() {
  vault = null;
}

export function hasAesCredentialEncryption(): boolean {
  const key = process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY?.trim();
  return Boolean(key && key.length >= 16);
}

export function getCredentialVault(): CredentialVault {
  if (vault) return vault;
  if (hasAesCredentialEncryption()) {
    vault = new AesGcmVault(
      deriveKey(process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY!.trim()),
    );
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

export function sealTokenBundle(bundle: TokenBundle): string {
  return getCredentialVault().seal(JSON.stringify(bundle));
}

/**
 * Seal LIVE provider tokens. Requires AES-GCM (never the base64 simulation vault).
 * credential_ref must never contain raw access tokens.
 */
export function sealLiveTokenBundle(bundle: TokenBundle): string {
  if (!hasAesCredentialEncryption()) {
    throw new Error(
      "PROVIDER_CREDENTIAL_ENCRYPTION_KEY required to store LIVE provider credentials",
    );
  }
  const aes = new AesGcmVault(
    deriveKey(process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY!.trim()),
  );
  const sealed = aes.seal(JSON.stringify(bundle));
  if (!sealed.startsWith("aesgcm:")) {
    throw new Error("LIVE credentials must use AES-GCM sealing");
  }
  if (
    sealed.includes(bundle.access_token) ||
    (bundle.refresh_token && sealed.includes(bundle.refresh_token))
  ) {
    throw new Error("Sealed credential_ref must not contain raw tokens");
  }
  return sealed;
}

export function openTokenBundle(ref: string): TokenBundle {
  return JSON.parse(getCredentialVault().open(ref)) as TokenBundle;
}

export function isAesGcmCredentialRef(ref: string): boolean {
  return ref.startsWith("aesgcm:");
}
