#!/usr/bin/env node
/**
 * Ensure the canonical ALTUS Direct Retirement Assessment source exists.
 *
 * Creates/upserts by stable slugs (no hard-coded UUIDs):
 *   organization: altus
 *   campaign:     retirement-opportunity (owner_type ALTUS_PLATFORM_CAMPAIGN)
 *
 * Safe for local, staging, and production when run with service-role credentials.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   ALTUS_BOOTSTRAP_CONFIRM=YES node scripts/bootstrap/ensure-direct-retirement-source.mjs
 *
 * Or import { ensureDirectRetirementSource } from this module in other seeders.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

export const DIRECT_RETIREMENT_ORG_SLUG = "altus";
export const DIRECT_RETIREMENT_CAMPAIGN_SLUG = "retirement-opportunity";

export async function ensureDirectRetirementSource(admin) {
  // Organization
  let { data: org, error: orgSelErr } = await admin
    .from("organizations")
    .select("id, slug, name, status")
    .eq("slug", DIRECT_RETIREMENT_ORG_SLUG)
    .maybeSingle();
  if (orgSelErr) throw new Error(`org lookup: ${orgSelErr.message}`);

  if (!org) {
    const { data, error } = await admin
      .from("organizations")
      .insert({
        name: "ALTUS",
        slug: DIRECT_RETIREMENT_ORG_SLUG,
        status: "active",
      })
      .select("id, slug, name, status")
      .single();
    if (error) throw new Error(`org insert: ${error.message}`);
    org = data;
  }

  // System campaign — durable parent for organic homepage assessment traffic
  let { data: campaign, error: campSelErr } = await admin
    .from("campaigns")
    .select("id, slug, organization_id, name, status, owner_type")
    .eq("organization_id", org.id)
    .eq("slug", DIRECT_RETIREMENT_CAMPAIGN_SLUG)
    .maybeSingle();
  if (campSelErr) throw new Error(`campaign lookup: ${campSelErr.message}`);

  if (!campaign) {
    const { data, error } = await admin
      .from("campaigns")
      .insert({
        organization_id: org.id,
        name: "Direct Retirement Assessment",
        slug: DIRECT_RETIREMENT_CAMPAIGN_SLUG,
        status: "published",
        description:
          "Canonical ALTUS homepage / organic Direct Retirement Assessment source. Not a paid media campaign.",
        owner_type: "ALTUS_PLATFORM_CAMPAIGN",
        owner_id: org.id,
        qualification_template_key: "retirement-opportunity-v1",
        workflow_status: "ACTIVE",
      })
      .select("id, slug, organization_id, name, status, owner_type")
      .single();
    if (error) throw new Error(`campaign insert: ${error.message}`);
    campaign = data;
  } else {
    // Keep canonical fields aligned without inventing a second campaign concept
    const { error } = await admin
      .from("campaigns")
      .update({
        name: "Direct Retirement Assessment",
        status: "published",
        owner_type: "ALTUS_PLATFORM_CAMPAIGN",
        owner_id: org.id,
        qualification_template_key: "retirement-opportunity-v1",
        workflow_status: "ACTIVE",
        description:
          "Canonical ALTUS homepage / organic Direct Retirement Assessment source. Not a paid media campaign.",
      })
      .eq("id", campaign.id);
    if (error) throw new Error(`campaign update: ${error.message}`);
  }

  return {
    organization: {
      id: org.id,
      slug: org.slug,
      name: org.name,
    },
    campaign: {
      id: campaign.id,
      slug: DIRECT_RETIREMENT_CAMPAIGN_SLUG,
      organization_id: org.id,
      name: "Direct Retirement Assessment",
      owner_type: "ALTUS_PLATFORM_CAMPAIGN",
    },
  };
}

async function main() {
  if (process.env.ALTUS_BOOTSTRAP_CONFIRM !== "YES") {
    console.error(
      "FAIL: Set ALTUS_BOOTSTRAP_CONFIRM=YES to run ensure-direct-retirement-source.",
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    console.error("FAIL: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const projectRefFile = resolve(ROOT, "supabase/.temp/project-ref");
  if (existsSync(projectRefFile)) {
    const expectedRef = readFileSync(projectRefFile, "utf8").trim();
    const urlRef = new URL(url).hostname.split(".")[0];
    if (expectedRef && urlRef !== expectedRef) {
      console.error(
        `FAIL: URL project ref (${urlRef}) does not match linked ref (${expectedRef}).`,
      );
      process.exit(1);
    }
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await ensureDirectRetirementSource(admin);
  console.log("OK direct retirement source ensured");
  console.log(
    JSON.stringify(
      {
        organization_slug: result.organization.slug,
        campaign_slug: result.campaign.slug,
        owner_type: result.campaign.owner_type,
        organization_id: String(result.organization.id).slice(0, 8) + "…",
        campaign_id: String(result.campaign.id).slice(0, 8) + "…",
      },
      null,
      2,
    ),
  );
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((e) => {
    console.error("FAIL:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
