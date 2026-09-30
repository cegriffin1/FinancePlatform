#!/usr/bin/env node
/**
 * Staging-only synthetic fixture seeder for ALTUS Production Foundation validation.
 *
 * SAFETY:
 * - Refuses to run without ALTUS_STAGING_FIXTURE_CONFIRM=YES
 * - Refuses unless NEXT_PUBLIC_SUPABASE_URL host matches linked staging project ref
 * - Never prints passwords or service-role key
 * - Writes credentials only to gitignored .staging-fixtures.local.json
 *
 * Usage (from repo root, with .env.local loaded by the operator):
 *   set -a && source .env.local && set +a
 *   ALTUS_STAGING_FIXTURE_CONFIRM=YES node scripts/staging/seed-foundation-fixtures.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { ensureDirectRetirementSource } from "../bootstrap/ensure-direct-retirement-source.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const OUT = resolve(ROOT, ".staging-fixtures.local.json");
const PROJECT_REF_FILE = resolve(ROOT, "supabase/.temp/project-ref");

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

if (process.env.ALTUS_STAGING_FIXTURE_CONFIRM !== "YES") {
  fail("Set ALTUS_STAGING_FIXTURE_CONFIRM=YES to run this staging-only seeder.");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !service || !anon) fail("Missing Supabase env (url/anon/service).");

let expectedRef = null;
if (existsSync(PROJECT_REF_FILE)) {
  expectedRef = readFileSync(PROJECT_REF_FILE, "utf8").trim();
}
const host = new URL(url).hostname; // <ref>.supabase.co
const urlRef = host.split(".")[0];
if (!expectedRef) fail("supabase/.temp/project-ref missing — link staging first.");
if (urlRef !== expectedRef) {
  fail(`URL project ref (${urlRef}) does not match linked staging ref.`);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function password() {
  return `Altus!${randomBytes(18).toString("base64url")}`;
}

async function upsertOrg(slug, name) {
  const { data: existing } = await admin
    .from("organizations")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await admin
    .from("organizations")
    .insert({ name, slug, status: "active" })
    .select("id, slug, name")
    .single();
  if (error) throw new Error(`org ${slug}: ${error.message}`);
  return data;
}

async function ensureUser(email, fullName) {
  const pwd = password();
  // Try create; if exists, list and reset password
  const created = await admin.auth.admin.createUser({
    email,
    password: pwd,
    email_confirm: true,
    user_metadata: { full_name: fullName, synthetic: true },
  });
  let userId = created.data.user?.id;
  let finalPwd = pwd;
  if (created.error) {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list.data.users?.find((u) => u.email === email);
    if (!found) throw new Error(`create user ${email}: ${created.error.message}`);
    userId = found.id;
    finalPwd = password();
    const upd = await admin.auth.admin.updateUserById(userId, {
      password: finalPwd,
      email_confirm: true,
    });
    if (upd.error) throw new Error(`update user ${email}: ${upd.error.message}`);
  }

  const { error: profileErr } = await admin.from("profiles").upsert({
    id: userId,
    email,
    full_name: fullName,
    is_platform_admin: false,
  });
  if (profileErr) throw new Error(`profile ${email}: ${profileErr.message}`);

  return { userId, email, password: finalPwd, fullName };
}

async function ensureMembership(orgId, userId, roleKey) {
  const { data: member, error: memErr } = await admin
    .from("organization_members")
    .upsert(
      {
        organization_id: orgId,
        profile_id: userId,
        status: "active",
        title: "Staging Validation Agent",
      },
      { onConflict: "organization_id,profile_id" },
    )
    .select("id")
    .single();
  if (memErr) throw new Error(`membership: ${memErr.message}`);

  const { data: role, error: roleErr } = await admin
    .from("roles")
    .select("id, key")
    .eq("key", roleKey)
    .is("organization_id", null)
    .maybeSingle();
  if (roleErr || !role) throw new Error(`system role ${roleKey} missing`);

  await admin.from("member_roles").upsert(
    { member_id: member.id, role_id: role.id },
    { onConflict: "member_id,role_id" },
  );
  return member.id;
}

async function ensureCampaign(orgId, orgSlug) {
  const slug = "staging-retirement-validation";
  const { data: existing } = await admin
    .from("campaigns")
    .select("id, slug, organization_id, name")
    .eq("organization_id", orgId)
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await admin
    .from("campaigns")
    .insert({
      organization_id: orgId,
      name: "ALTUS Staging Retirement Validation",
      slug,
      status: "published",
      description: "Synthetic campaign for foundation validation",
      owner_type: "SUBSCRIBER_CAMPAIGN",
      owner_id: orgId,
      qualification_template_key: "retirement-opportunity-v1",
      workflow_status: "ACTIVE",
    })
    .select("id, slug, organization_id, name")
    .single();
  if (error) throw new Error(`campaign: ${error.message}`);
  return { ...data, organization_slug: orgSlug };
}

async function main() {
  console.log("Seeding synthetic staging fixtures for Altus-Lead-Staging…");
  console.log(`Project ref: ${expectedRef}`);

  // Canonical homepage Direct Retirement source (not a test-org fixture)
  const direct = await ensureDirectRetirementSource(admin);
  console.log(
    `Direct source: ${direct.organization.slug}/${direct.campaign.slug}`,
  );

  const orgA = await upsertOrg("altus-test-org-a", "ALTUS TEST ORG A");
  const orgB = await upsertOrg("altus-test-org-b", "ALTUS TEST ORG B");
  const userA = await ensureUser(
    "altus.test.user.a@example.invalid",
    "ALTUS TEST USER A",
  );
  const userB = await ensureUser(
    "altus.test.user.b@example.invalid",
    "ALTUS TEST USER B",
  );
  const memberA = await ensureMembership(orgA.id, userA.userId, "admin");
  const memberB = await ensureMembership(orgB.id, userB.userId, "admin");
  const campaignA = await ensureCampaign(orgA.id, orgA.slug);
  const campaignB = await ensureCampaign(orgB.id, orgB.slug);

  const fixtures = {
    created_at: new Date().toISOString(),
    project_ref: expectedRef,
    directRetirement: {
      organization: {
        id: direct.organization.id,
        slug: direct.organization.slug,
        name: direct.organization.name,
      },
      campaign: {
        id: direct.campaign.id,
        slug: direct.campaign.slug,
        organization_id: direct.campaign.organization_id,
        name: direct.campaign.name,
        owner_type: direct.campaign.owner_type,
      },
    },
    orgA: { id: orgA.id, slug: orgA.slug, name: orgA.name },
    orgB: { id: orgB.id, slug: orgB.slug, name: orgB.name },
    userA: {
      id: userA.userId,
      email: userA.email,
      password: userA.password,
      memberId: memberA,
    },
    userB: {
      id: userB.userId,
      email: userB.email,
      password: userB.password,
      memberId: memberB,
    },
    campaignA: {
      id: campaignA.id,
      slug: campaignA.slug,
      organization_id: orgA.id,
      organization_slug: orgA.slug,
    },
    campaignB: {
      id: campaignB.id,
      slug: campaignB.slug,
      organization_id: orgB.id,
      organization_slug: orgB.slug,
    },
  };

  writeFileSync(OUT, JSON.stringify(fixtures, null, 2), { mode: 0o600 });
  console.log("Wrote gitignored fixture file: .staging-fixtures.local.json");
  console.log("Orgs:", orgA.slug, orgB.slug);
  console.log("Users:", userA.email, userB.email);
  console.log("Campaign A slug:", campaignA.slug);
  console.log("DONE (passwords only in gitignored local file)");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
