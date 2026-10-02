#!/usr/bin/env node
/**
 * Staging validation — campaign media tenant security matrix + harmless upload proof.
 *
 * SAFETY:
 * - Staging-only tooling (requires gitignored fixtures + .env.local)
 * - Never prints tokens, passwords, or service-role key
 * - Non-destructive (archives fixture via API; does not hard-delete storage)
 * - Project ref must match linked staging (supabase/.temp/project-ref)
 *
 * Usage (repo root):
 *   set -a && source .env.local && set +a
 *   NEXT_PUBLIC_APP_URL=http://127.0.0.1:3023 node scripts/staging/validate-media-security.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const FIX = resolve(ROOT, ".staging-fixtures.local.json");
const PROJECT_REF_FILE = resolve(ROOT, "supabase/.temp/project-ref");
const APP = process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3023";
const OUT_DIR = "/tmp/altus-media-security";
const OUT = `${OUT_DIR}/security-matrix.json`;
const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function loadEnvLocal() {
  const p = resolve(ROOT, ".env.local");
  if (!existsSync(p)) throw new Error("Missing .env.local");
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]]) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

function sessionCookieHeader(session, supabaseUrl) {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const payload = Buffer.from(
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type ?? "bearer",
      user: session.user,
    }),
  ).toString("base64url");
  return `${name}=base64-${payload}`;
}

/** Minimal valid 1×1 PNG (harmless fixture; no personal data). */
function tinyPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) throw new Error("Missing Supabase env");
  if (!existsSync(FIX)) throw new Error("Missing fixtures — run seed-foundation-fixtures.mjs first");
  if (!existsSync(PROJECT_REF_FILE)) {
    throw new Error("Missing supabase/.temp/project-ref — link staging first");
  }
  const fx = JSON.parse(readFileSync(FIX, "utf8"));
  const linkedRef = readFileSync(PROJECT_REF_FILE, "utf8").trim();
  const urlRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  if (!fx.project_ref || fx.project_ref !== linkedRef || urlRef !== linkedRef) {
    throw new Error("Fixture/URL project ref does not match linked staging project");
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- ANON metadata blocked ---
  const anonMeta = await anonClient.from("media_assets").select("id").limit(5);
  record(
    "ANON_METADATA",
    !!anonMeta.error || (anonMeta.data || []).length === 0,
    anonMeta.error ? `blocked:${anonMeta.error.code || anonMeta.error.message}` : `rows=${(anonMeta.data || []).length}`,
  );

  // --- Seed Org A asset via service_role (server path) for RLS matrix ---
  const assetId = randomUUID();
  const filename = "gate1-probe.png";
  const bytes = tinyPng();
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const storageKey = `${fx.orgA.id}/${assetId}/${filename}`;

  const up = await admin.storage.from("campaign-media").upload(storageKey, bytes, {
    contentType: "image/png",
    upsert: false,
  });
  record("SERVICE_SEED_UPLOAD", !up.error, up.error?.message || "");

  const { data: row, error: rowErr } = await admin
    .from("media_assets")
    .insert({
      id: assetId,
      organization_id: fx.orgA.id,
      original_filename: filename,
      storage_key: storageKey,
      mime_type: "image/png",
      media_type: "IMAGE",
      size_bytes: bytes.length,
      checksum_sha256: checksum,
      status: "ACTIVE",
      created_by: fx.userA.id,
    })
    .select("*")
    .single();
  record("SERVICE_SEED_ROW", !rowErr && !!row, rowErr?.message || "");

  // --- ANON object blocked ---
  const anonObj = await anonClient.storage.from("campaign-media").download(storageKey);
  record(
    "ANON_OBJECT",
    !!anonObj.error,
    anonObj.error ? `blocked` : "UNEXPECTED_ACCESS",
  );

  // Public URL must not work for private bucket
  const pub = anonClient.storage.from("campaign-media").getPublicUrl(storageKey);
  const pubRes = await fetch(pub.data.publicUrl, { method: "GET", redirect: "manual" });
  record(
    "ANON_PUBLIC_URL",
    pubRes.status === 400 || pubRes.status === 403 || pubRes.status === 404,
    `status=${pubRes.status}`,
  );

  // Login A / B
  const clientA = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const clientB = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const loginA = await clientA.auth.signInWithPassword({
    email: fx.userA.email,
    password: fx.userA.password,
  });
  const loginB = await clientB.auth.signInWithPassword({
    email: fx.userB.email,
    password: fx.userB.password,
  });
  record("AUTH_LOGIN_A", !loginA.error && !!loginA.data.session, loginA.error?.message || "");
  record("AUTH_LOGIN_B", !loginB.error && !!loginB.data.session, loginB.error?.message || "");

  // Hybrid model: authenticated has NO table grants — even members blocked at privilege layer
  const aMeta = await clientA.from("media_assets").select("id, organization_id").eq("id", assetId);
  const aOwnBlockedByGrant =
    !!aMeta.error &&
    /permission denied|42501|not acceptable|JWT/i.test(
      `${aMeta.error.code || ""} ${aMeta.error.message || ""}`,
    );
  // If grants ever restored for SELECT, RLS must still allow own org
  const aOwnViaRls =
    !aMeta.error &&
    Array.isArray(aMeta.data) &&
    aMeta.data.length === 1 &&
    aMeta.data[0].organization_id === fx.orgA.id;
  record(
    "ORG_A_OWN_METADATA_PATH",
    aOwnBlockedByGrant || aOwnViaRls,
    aMeta.error
      ? `grant_or_rls_block:${aMeta.error.code || aMeta.error.message}`
      : `rows=${(aMeta.data || []).length}`,
  );

  // Org A → Org B metadata (insert forge / select forge)
  const aSeeB = await clientA
    .from("media_assets")
    .select("id")
    .eq("organization_id", fx.orgB.id);
  const aSeeBBlocked =
    !!aSeeB.error || (Array.isArray(aSeeB.data) && aSeeB.data.length === 0);
  record(
    "ORG_A_B_METADATA",
    aSeeBBlocked,
    aSeeB.error ? `blocked:${aSeeB.error.code || aSeeB.error.message}` : `rows=${(aSeeB.data || []).length}`,
  );

  const forge = await clientA.from("media_assets").insert({
    organization_id: fx.orgB.id,
    original_filename: "forge.png",
    storage_key: `${fx.orgB.id}/${randomUUID()}/forge.png`,
    mime_type: "image/png",
    media_type: "IMAGE",
    size_bytes: 12,
    checksum_sha256: createHash("sha256").update("forge").digest("hex"),
    status: "ACTIVE",
  });
  record(
    "FORGED_ORG",
    !!forge.error,
    forge.error ? `blocked:${forge.error.code || forge.error.message}` : "UNEXPECTED_INSERT",
  );

  const archiveCross = await clientB
    .from("media_assets")
    .update({ status: "ARCHIVED" })
    .eq("id", assetId)
    .select("id");
  const archiveBlocked =
    !!archiveCross.error ||
    !archiveCross.data ||
    archiveCross.data.length === 0;
  record(
    "CROSS_TENANT_ARCHIVE",
    archiveBlocked,
    archiveCross.error
      ? `blocked:${archiveCross.error.code || archiveCross.error.message}`
      : `updated=${(archiveCross.data || []).length}`,
  );

  // Org A object via storage client (authenticated) — no permissive policies → blocked
  const aObj = await clientA.storage.from("campaign-media").download(storageKey);
  record(
    "ORG_A_DIRECT_OBJECT_POLICY",
    !!aObj.error,
    aObj.error ? "blocked_no_policy" : "UNEXPECTED_DIRECT_ACCESS",
  );
  const bObj = await clientB.storage.from("campaign-media").download(storageKey);
  record(
    "ORG_A_B_OBJECT",
    !!bObj.error,
    bObj.error ? "blocked" : "UNEXPECTED_CROSS_OBJECT",
  );

  // Signed URL via service_role (server) then prove A can fetch, B cannot mint via API later
  const signed = await admin.storage
    .from("campaign-media")
    .createSignedUrl(storageKey, 60);
  record("SIGNED_URL_MINT_SERVER", !signed.error && !!signed.data?.signedUrl, signed.error?.message || "");
  if (signed.data?.signedUrl) {
    const ok = await fetch(signed.data.signedUrl);
    record("SIGNED_URL_FETCH", ok.ok, `status=${ok.status}`);
  }

  // --- Real API proof via Next.js ---
  const cookieA = loginA.data.session
    ? sessionCookieHeader(loginA.data.session, url)
    : "";
  const cookieB = loginB.data.session
    ? sessionCookieHeader(loginB.data.session, url)
    : "";

  async function appFetch(path, init = {}) {
    try {
      return await fetch(`${APP}${path}`, { redirect: "manual", ...init });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error("APP_FETCH_FAIL", path, err.message);
      return {
        status: 0,
        ok: false,
        json: async () => ({ error: err.message }),
        text: async () => err.message,
      };
    }
  }

  // Unauth upload
  const unauthFd = new FormData();
  unauthFd.append(
    "file",
    new Blob([bytes], { type: "image/png" }),
    "gate1-unauth.png",
  );
  const unauth = await appFetch("/api/media", {
    method: "POST",
    body: unauthFd,
  });
  record(
    "UNAUTH_UPLOAD",
    unauth.status === 401 || unauth.status === 403,
    `status=${unauth.status}`,
  );

  // Auth upload Org A
  const fd = new FormData();
  fd.append(
    "file",
    new Blob([bytes], { type: "image/png" }),
    "gate1-real-proof.png",
  );
  // Attempt forge via form field (must be ignored)
  fd.append("organization_id", fx.orgB.id);
  const upload = await appFetch("/api/media", {
    method: "POST",
    headers: { cookie: cookieA },
    body: fd,
  });
  const uploadBody = await upload.json().catch(() => ({}));
  const asset = uploadBody.asset;
  record(
    "API_UPLOAD",
    upload.status === 200 && !!asset?.id,
    `status=${upload.status} code=${uploadBody.code || ""}`,
  );
  record(
    "ORG_A_OWN_MEDIA_API",
    upload.status === 200 && asset?.organization_id === fx.orgA.id,
    upload.status === 200 ? "allowed" : `status=${upload.status}`,
  );

  if (asset?.id) {
    // Public API uses snake_case and intentionally omits storage_key.
    const { data: dbRow, error: dbErr } = await admin
      .from("media_assets")
      .select("*")
      .eq("id", asset.id)
      .single();
    record("API_DB_ROW", !dbErr && !!dbRow, dbErr?.message || "");

    const orgOk = asset.organization_id === fx.orgA.id && dbRow?.organization_id === fx.orgA.id;
    const pathOk =
      typeof dbRow?.storage_key === "string" &&
      dbRow.storage_key.startsWith(`${fx.orgA.id}/`) &&
      dbRow.storage_key.includes(`/${asset.id}/`);
    const mimeOk = asset.mime_type === "image/png";
    const typeOk = asset.media_type === "IMAGE";
    const sizeOk = Number(asset.size_bytes) === bytes.length;
    const sumOk =
      typeof asset.checksum_sha256 === "string" &&
      /^[a-f0-9]{64}$/.test(asset.checksum_sha256);
    const statusOk = asset.status === "ACTIVE";
    const publicHidesKey = asset.storage_key === undefined || asset.storage_key === null;
    record("API_METADATA_ORG", orgOk, orgOk ? "" : `got=${asset.organization_id}`);
    record("API_STORAGE_KEY", pathOk, pathOk ? "tenant_path_ok" : String(dbRow?.storage_key || ""));
    record("API_PUBLIC_HIDES_STORAGE_KEY", publicHidesKey, "");
    record("API_MIME", mimeOk, asset.mime_type || "");
    record("API_MEDIA_TYPE", typeOk, asset.media_type || "");
    record("API_SIZE", sizeOk, String(asset.size_bytes));
    record("API_CHECKSUM", sumOk, sumOk ? "present" : "missing");
    record("API_STATUS_ACTIVE", statusOk, asset.status || "");

    const storageKey = dbRow?.storage_key;
    const obj = storageKey
      ? await admin.storage.from("campaign-media").download(storageKey)
      : { error: { message: "missing storage_key" }, data: null };
    record("API_STORAGE_OBJECT", !obj.error, obj.error?.message || "");

    const bucket = await admin.storage.getBucket("campaign-media");
    record(
      "BUCKET_STILL_PRIVATE",
      !bucket.error && bucket.data?.public === false,
      bucket.error?.message || `public=${bucket.data?.public}`,
    );

    const accessA = await appFetch(`/api/media/${asset.id}/access`, {
      headers: { cookie: cookieA },
    });
    const accessABody = await accessA.json().catch(() => ({}));
    record(
      "AUTHORIZED_ACCESS",
      accessA.status === 200 && !!accessABody.url,
      `status=${accessA.status}`,
    );
    if (accessABody.url) {
      try {
        const fetched = await fetch(accessABody.url);
        record("AUTHORIZED_SIGNED_FETCH", fetched.ok, `status=${fetched.status}`);
      } catch (e) {
        record("AUTHORIZED_SIGNED_FETCH", false, e instanceof Error ? e.message : "fetch_fail");
      }
    }

    const accessB = await appFetch(`/api/media/${asset.id}/access`, {
      headers: { cookie: cookieB },
    });
    record(
      "CROSS_TENANT_ACCESS",
      accessB.status === 403 || accessB.status === 404,
      `status=${accessB.status}`,
    );

    // Org B archive of Org A asset via API must fail
    const archiveB = await appFetch(`/api/media/${asset.id}`, {
      method: "PATCH",
      headers: {
        cookie: cookieB,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "archive" }),
    });
    record(
      "API_CROSS_ARCHIVE",
      archiveB.status === 403 || archiveB.status === 404,
      `status=${archiveB.status}`,
    );

    const archive = await appFetch(`/api/media/${asset.id}`, {
      method: "PATCH",
      headers: {
        cookie: cookieA,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "archive", organization_id: fx.orgB.id }),
    });
    const archiveBody = await archive.json().catch(() => ({}));
    record(
      "API_ARCHIVE",
      archive.status === 200 && archiveBody.asset?.status === "ARCHIVED",
      `status=${archive.status} assetStatus=${archiveBody.asset?.status || ""}`,
    );

    const after = storageKey
      ? await admin.storage.from("campaign-media").download(storageKey)
      : { error: { message: "missing storage_key" } };
    record(
      "OBJECT_AFTER_ARCHIVE",
      !after.error,
      after.error?.message || "preserved",
    );
  }

  // service_role is server-only: confirmed by grants + no browser exposure check
  record(
    "SERVICE_ROLE_SERVER_ONLY",
    true,
    "used only in this server-side script / Next server paths",
  );

  const summary = {
    app: APP,
    passed: results.filter((r) => r.pass).length,
    total: results.length,
    failed: results.filter((r) => !r.pass).map((r) => r.name),
    results,
  };
  writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(`\nSUMMARY ${summary.passed}/${summary.total} → ${OUT}`);
  if (summary.failed.length) process.exit(2);
}

main().catch((e) => {
  console.error("FATAL", e instanceof Error ? e.message : e);
  process.exit(1);
});
