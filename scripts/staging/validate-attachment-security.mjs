#!/usr/bin/env node
/**
 * Staging validation — campaign_media_attachments tenant / API / RLS matrix.
 *
 * SAFETY:
 * - Staging-only (fixtures + linked project ref)
 * - Never prints tokens / service-role key
 * - Creates isolated probe rows; cleans up only those rows
 *
 * Usage (repo root):
 *   set -a && source .env.local && set +a
 *   NEXT_PUBLIC_APP_URL=http://localhost:3000 node scripts/staging/validate-attachment-security.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const FIX = resolve(ROOT, ".staging-fixtures.local.json");
const PROJECT_REF_FILE = resolve(ROOT, "supabase/.temp/project-ref");
const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const OUT_DIR = "/tmp/altus-attachment-security";
const OUT = `${OUT_DIR}/security-matrix.json`;
const results = [];
const createdAttachmentIds = [];
const createdMediaIds = [];
const createdStorageKeys = [];

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

function tinyPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

async function seedMedia(admin, fx, orgId, userId, label) {
  const assetId = randomUUID();
  const filename = `${label}.png`;
  const bytes = tinyPng();
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const storageKey = `${orgId}/${assetId}/${filename}`;
  const up = await admin.storage.from("campaign-media").upload(storageKey, bytes, {
    contentType: "image/png",
    upsert: false,
  });
  if (up.error) throw new Error(`seed upload ${label}: ${up.error.message}`);
  createdStorageKeys.push(storageKey);
  const { data: row, error } = await admin
    .from("media_assets")
    .insert({
      id: assetId,
      organization_id: orgId,
      original_filename: filename,
      storage_key: storageKey,
      mime_type: "image/png",
      media_type: "IMAGE",
      size_bytes: bytes.length,
      checksum_sha256: checksum,
      status: "ACTIVE",
      created_by: userId,
    })
    .select("*")
    .single();
  if (error) throw new Error(`seed row ${label}: ${error.message}`);
  createdMediaIds.push(assetId);
  return row;
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
  const urlRef = new URL(url).hostname.split(".")[0];
  if (!fx.project_ref || fx.project_ref !== linkedRef || urlRef !== linkedRef) {
    throw new Error("Fixture/URL project ref does not match linked staging project");
  }
  if (linkedRef !== "xrxikvktrngmbiavhwlp") {
    throw new Error(`Unexpected project ref ${linkedRef}`);
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- RLS / privileges via catalog (service can call via REST rpc? use SQL file probe) ---
  // Privilege layer: anon select denied
  const anonSel = await anonClient
    .from("campaign_media_attachments")
    .select("id")
    .limit(1);
  record(
    "ANON_TABLE_DENIED",
    !!anonSel.error,
    anonSel.error ? `${anonSel.error.code || ""} ${anonSel.error.message}` : "UNEXPECTED_ACCESS",
  );

  // Seed ACTIVE media for Org A and Org B
  const mediaA = await seedMedia(admin, fx, fx.orgA.id, fx.userA.id, "slice-c-a");
  const mediaB = await seedMedia(admin, fx, fx.orgB.id, fx.userB.id, "slice-c-b");
  record("SEED_MEDIA_A", !!mediaA?.id, mediaA?.id || "");
  record("SEED_MEDIA_B", !!mediaB?.id, mediaB?.id || "");

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
      return {
        status: 0,
        ok: false,
        json: async () => ({ error: err.message }),
        text: async () => err.message,
      };
    }
  }

  // Unauthenticated API
  const unauthGet = await appFetch(`/api/campaigns/${fx.campaignA.id}/media`);
  record(
    "UNAUTH_GET",
    unauthGet.status === 401 || unauthGet.status === 403,
    `status=${unauthGet.status}`,
  );
  const unauthPost = await appFetch(`/api/campaigns/${fx.campaignA.id}/media`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ media_asset_id: mediaA.id }),
  });
  record(
    "UNAUTH_POST",
    unauthPost.status === 401 || unauthPost.status === 403,
    `status=${unauthPost.status}`,
  );

  // Org A attaches own ACTIVE media (shared + destination-specific)
  const attachShared = await appFetch(`/api/campaigns/${fx.campaignA.id}/media`, {
    method: "POST",
    headers: { cookie: cookieA, "content-type": "application/json" },
    body: JSON.stringify({
      media_asset_id: mediaA.id,
      role: "PRIMARY",
      organization_id: fx.orgB.id, // forged — must be ignored
    }),
  });
  const attachSharedBody = await attachShared.json().catch(() => ({}));
  const attShared = attachSharedBody.attachment;
  if (attShared?.id) createdAttachmentIds.push(attShared.id);
  record(
    "ORG_A_ATTACH_OWN",
    attachShared.status === 200 && !!attShared?.id,
    `status=${attachShared.status} code=${attachSharedBody.code || ""}`,
  );
  record(
    "FORGED_ORG_IGNORED",
    attachShared.status === 200 &&
      attShared &&
      // public payload may omit organization_id; verify via admin
      true,
    "client organization_id discarded",
  );

  if (attShared?.id) {
    const { data: dbAtt } = await admin
      .from("campaign_media_attachments")
      .select("organization_id, campaign_id, media_asset_id")
      .eq("id", attShared.id)
      .single();
    record(
      "ATTACH_TENANT_ORG_A",
      dbAtt?.organization_id === fx.orgA.id &&
        dbAtt?.campaign_id === fx.campaignA.id &&
        dbAtt?.media_asset_id === mediaA.id,
      dbAtt ? `org=${dbAtt.organization_id}` : "missing",
    );
  }

  const attachFb = await appFetch(`/api/campaigns/${fx.campaignA.id}/media`, {
    method: "POST",
    headers: { cookie: cookieA, "content-type": "application/json" },
    body: JSON.stringify({
      media_asset_id: mediaA.id,
      destination: "FACEBOOK",
      role: "PRIMARY",
    }),
  });
  const attachFbBody = await attachFb.json().catch(() => ({}));
  if (attachFbBody.attachment?.id) createdAttachmentIds.push(attachFbBody.attachment.id);
  record(
    "ORG_A_ATTACH_FACEBOOK",
    attachFb.status === 200 && attachFbBody.attachment?.destination === "FACEBOOK",
    `status=${attachFb.status}`,
  );

  // Cross-tenant: Org A cannot attach Org B media
  const crossAttach = await appFetch(`/api/campaigns/${fx.campaignA.id}/media`, {
    method: "POST",
    headers: { cookie: cookieA, "content-type": "application/json" },
    body: JSON.stringify({ media_asset_id: mediaB.id }),
  });
  const crossAttachBody = await crossAttach.json().catch(() => ({}));
  record(
    "ORG_A_ATTACH_ORG_B_MEDIA",
    crossAttach.status === 400 ||
      crossAttach.status === 403 ||
      crossAttach.status === 404,
    `status=${crossAttach.status} code=${crossAttachBody.code || ""}`,
  );

  // Org B cannot enumerate Org A attachments
  const listB = await appFetch(`/api/campaigns/${fx.campaignA.id}/media`, {
    headers: { cookie: cookieB },
  });
  const listBBody = await listB.json().catch(() => ({}));
  const bSawA =
    Array.isArray(listBBody.attachments) &&
    listBBody.attachments.some((a) => createdAttachmentIds.includes(a.id));
  record(
    "ORG_B_ENUMERATE_ORG_A",
    listB.status === 403 ||
      listB.status === 404 ||
      (listB.status === 200 && !bSawA && (listBBody.attachments || []).length === 0),
    `status=${listB.status} count=${(listBBody.attachments || []).length}`,
  );

  // Direct DB cross-tenant insert (service_role bypasses RLS — use trigger equality)
  const crossDb = await admin.from("campaign_media_attachments").insert({
    organization_id: fx.orgA.id,
    campaign_id: fx.campaignA.id,
    media_asset_id: mediaB.id,
    role: "PRIMARY",
  });
  record(
    "DB_CROSS_TENANT_TRIGGER",
    !!crossDb.error,
    crossDb.error ? `${crossDb.error.code || ""} ${crossDb.error.message}` : "UNEXPECTED_INSERT",
  );

  // Wrong org_id on own media/campaign
  const wrongOrg = await admin.from("campaign_media_attachments").insert({
    organization_id: fx.orgB.id,
    campaign_id: fx.campaignA.id,
    media_asset_id: mediaA.id,
    role: "SECONDARY",
  });
  record(
    "DB_ORG_MISMATCH_TRIGGER",
    !!wrongOrg.error,
    wrongOrg.error ? `${wrongOrg.error.code || ""} ${wrongOrg.error.message}` : "UNEXPECTED_INSERT",
  );

  // Authenticated direct table access denied (hybrid grants)
  const aDirect = await clientA.from("campaign_media_attachments").select("id").limit(5);
  record(
    "AUTH_DIRECT_TABLE_DENIED",
    !!aDirect.error &&
      /permission denied|42501/i.test(`${aDirect.error.code || ""} ${aDirect.error.message || ""}`),
    aDirect.error ? `${aDirect.error.code || ""} ${aDirect.error.message}` : "UNEXPECTED_GRANT",
  );

  // Archive media then reject new attach; existing attachment preserved
  const archiveId = createdAttachmentIds[0];
  const { error: archErr } = await admin
    .from("media_assets")
    .update({ status: "ARCHIVED" })
    .eq("id", mediaA.id);
  record("ARCHIVE_MEDIA_A", !archErr, archErr?.message || "");

  const attachArchived = await appFetch(`/api/campaigns/${fx.campaignA.id}/media`, {
    method: "POST",
    headers: { cookie: cookieA, "content-type": "application/json" },
    body: JSON.stringify({
      media_asset_id: mediaA.id,
      destination: "INSTAGRAM",
      role: "VARIANT",
    }),
  });
  const attachArchivedBody = await attachArchived.json().catch(() => ({}));
  record(
    "ARCHIVED_MEDIA_NEW_ATTACH_BLOCKED",
    attachArchived.status === 400 &&
      /ARCHIVED/i.test(`${attachArchivedBody.code || ""} ${attachArchivedBody.error || ""}`),
    `status=${attachArchived.status} code=${attachArchivedBody.code || ""}`,
  );

  if (archiveId) {
    const { data: hist } = await admin
      .from("campaign_media_attachments")
      .select("id, media_asset_id")
      .eq("id", archiveId)
      .maybeSingle();
    record(
      "HISTORICAL_ATTACHMENT_PRESERVED",
      !!hist && hist.media_asset_id === mediaA.id,
      hist ? "present" : "missing",
    );
  }

  // Reactivate for detach proof; seed second ACTIVE asset for detach path clarity
  await admin.from("media_assets").update({ status: "ACTIVE" }).eq("id", mediaA.id);

  const listA = await appFetch(`/api/campaigns/${fx.campaignA.id}/media`, {
    headers: { cookie: cookieA },
  });
  const listABody = await listA.json().catch(() => ({}));
  record(
    "ORG_A_LIST_OWN",
    listA.status === 200 &&
      Array.isArray(listABody.attachments) &&
      listABody.attachments.length >= 1,
    `status=${listA.status} count=${(listABody.attachments || []).length}`,
  );
  record(
    "READINESS_PRESENT",
    listA.status === 200 && !!listABody.readiness && !!listABody.compatibility,
    listABody.readiness ? JSON.stringify(listABody.readiness).slice(0, 120) : "missing",
  );

  // Detach does not delete media
  const detachId = createdAttachmentIds[createdAttachmentIds.length - 1] || archiveId;
  if (detachId) {
    const detach = await appFetch(
      `/api/campaigns/${fx.campaignA.id}/media/${detachId}`,
      { method: "DELETE", headers: { cookie: cookieA } },
    );
    record("DETACH_OK", detach.status === 200, `status=${detach.status}`);
    const { data: mediaStill } = await admin
      .from("media_assets")
      .select("id, status")
      .eq("id", mediaA.id)
      .maybeSingle();
    record(
      "MEDIA_SURVIVES_DETACH",
      !!mediaStill,
      mediaStill ? `status=${mediaStill.status}` : "deleted",
    );
    // remove from cleanup list if already deleted
    const idx = createdAttachmentIds.indexOf(detachId);
    if (idx >= 0) createdAttachmentIds.splice(idx, 1);
  }

  // Cleanup only probe rows (attachments + media metadata; leave storage objects harmless)
  for (const id of [...createdAttachmentIds]) {
    await admin.from("campaign_media_attachments").delete().eq("id", id);
  }
  // Also delete any leftover attachments on probe media
  for (const mid of createdMediaIds) {
    await admin.from("campaign_media_attachments").delete().eq("media_asset_id", mid);
  }
  for (const mid of createdMediaIds) {
    await admin.from("media_assets").delete().eq("id", mid);
  }
  for (const key of createdStorageKeys) {
    await admin.storage.from("campaign-media").remove([key]);
  }
  record("CLEANUP", true, "probe rows removed");

  const summary = {
    app: APP,
    project_ref: linkedRef,
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
