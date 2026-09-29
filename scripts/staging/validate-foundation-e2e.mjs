#!/usr/bin/env node
/**
 * Staging foundation E2E validation against localhost app + linked Supabase.
 * Reads credentials from gitignored .staging-fixtures.local.json only.
 * Never prints secrets, tokens, or service-role key.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";

const ROOT = resolve(import.meta.dirname, "../..");
const FIX = resolve(ROOT, ".staging-fixtures.local.json");
const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function requireEnv() {
  for (const k of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    if (!process.env[k]) throw new Error(`Missing ${k}`);
  }
}

function loadFixtures() {
  if (!existsSync(FIX)) {
    throw new Error("Missing .staging-fixtures.local.json — run seed script first");
  }
  return JSON.parse(readFileSync(FIX, "utf8"));
}

/** Cookie header for Next.js @supabase/ssr server client (no secret logging). */
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

const ANSWERS = {
  age_range: "60–64",
  state: "FL",
  employment: "Retired",
  retirement_timing: "Within 2 years",
  marital_status: "Married",
  total_retirement_assets: "$750K–$999K",
  repositionable_assets: "$750K–$999K",
  asset_location: "401(k)|IRA",
  employer_assets: "Former employer",
  existing_annuity: "None",
  liquidity_timeline: "3–5 years",
  // BALANCE unlocks principal protection + lifetime income branch questions
  primary_objective: "BALANCE",
  principal_protection: "9",
  growth_participation: "7",
  income_start: "Within 1 year",
  lifetime_income_importance: "9",
  inflation_concern: "8",
  liquidity_importance: "7",
  legacy_importance: "5",
  healthcare_concern: "7",
  carrier_strength_importance: "8",
  advisor_team_importance: "8",
  current_advisor: "Not currently",
  decision_timeline: "Within 30 days",
};

async function jsonFetch(path, init = {}) {
  const res = await fetch(`${APP}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    redirect: "manual",
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body, headers: res.headers };
}

async function main() {
  requireEnv();
  const fx = loadFixtures();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const health = await fetch(APP).then((r) => r.status).catch(() => 0);
  record("APP_REACHABLE", health === 200 || health === 304, `status=${health}`);

  const clientA = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const loginA = await clientA.auth.signInWithPassword({
    email: fx.userA.email,
    password: fx.userA.password,
  });
  record("AUTH_LOGIN_A", !loginA.error && !!loginA.data.session, loginA.error?.message);
  const sessionA = loginA.data.session;
  const jwtA = sessionA?.access_token;

  const clientB = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const loginB = await clientB.auth.signInWithPassword({
    email: fx.userB.email,
    password: fx.userB.password,
  });
  record("AUTH_LOGIN_B", !loginB.error && !!loginB.data.session, loginB.error?.message);
  const sessionB = loginB.data.session;
  const jwtB = sessionB?.access_token;

  // Membership + role resolution (authenticated GRANT + RLS)
  if (jwtA) {
    const { data: memA, error } = await clientA
      .from("organization_members")
      .select("id, organization_id, status")
      .eq("status", "active");
    const seesA = (memA || []).some((m) => m.organization_id === fx.orgA.id);
    const seesB = (memA || []).some((m) => m.organization_id === fx.orgB.id);
    record(
      "ORG_MEMBERSHIP_A",
      !error && seesA && !seesB,
      error?.message || `a=${seesA} b=${seesB} count=${memA?.length ?? 0}`,
    );

    const memberId = (memA || []).find((m) => m.organization_id === fx.orgA.id)?.id;
    const { data: roles, error: roleErr } = await clientA
      .from("member_roles")
      .select("role_id, roles(key)")
      .eq("member_id", memberId || "00000000-0000-0000-0000-000000000000");
    const roleKeys = (roles || [])
      .map((r) => {
        const rolesObj = r.roles;
        if (Array.isArray(rolesObj)) return rolesObj[0]?.key;
        return rolesObj?.key;
      })
      .filter(Boolean);
    record(
      "ROLE_RESOLUTION_A",
      !roleErr && roleKeys.includes("admin"),
      roleErr?.message || `roles=${roleKeys.join(",")}`,
    );
  }

  // Spoof headers without session
  const spoof = await jsonFetch("/api/campaigns/state", {
    headers: {
      "x-altus-role": "owner",
      "x-altus-organization-id": fx.orgA.id,
    },
  });
  record(
    "SPOOF_HEADERS_REJECTED",
    spoof.status === 401 || spoof.status === 403,
    `status=${spoof.status}`,
  );

  const unauth = await jsonFetch("/api/leads/" + randomUUID());
  record(
    "INTERNAL_UNAUTH_REJECTED",
    unauth.status === 401 || unauth.status === 403,
    `status=${unauth.status}`,
  );

  // Protected route without auth
  const appGate = await jsonFetch("/app");
  record(
    "PROTECTED_ROUTE_UNAUTH",
    appGate.status === 307 ||
      appGate.status === 302 ||
      appGate.status === 401 ||
      appGate.status === 403,
    `status=${appGate.status}`,
  );

  // Marker leads for tenant boundary
  const markerA = {
    organization_id: fx.orgA.id,
    status: "new",
    first_name: "Synth",
    last_name: "OrgA",
    email: `synth.orga.${Date.now()}@example.invalid`,
    source: "staging_rls_marker",
  };
  const markerB = {
    organization_id: fx.orgB.id,
    status: "new",
    first_name: "Synth",
    last_name: "OrgB",
    email: `synth.orgb.${Date.now()}@example.invalid`,
    source: "staging_rls_marker",
  };
  const insA = await admin.from("leads").insert(markerA).select("id").single();
  const insB = await admin.from("leads").insert(markerB).select("id").single();
  record(
    "RLS_MARKERS_CREATED",
    !!insA.data?.id && !!insB.data?.id,
    `${insA.error?.message || ""} ${insB.error?.message || ""}`.trim(),
  );

  if (jwtA && insA.data?.id && insB.data?.id) {
    // Authenticated has NO leads GRANT — both reads must fail/empty
    const { data: seeOwn, error: ownErr } = await clientA
      .from("leads")
      .select("id")
      .eq("id", insA.data.id);
    const { data: seeOther, error: otherErr } = await clientA
      .from("leads")
      .select("id")
      .eq("id", insB.data.id);
    record(
      "AUTH_JWT_LEADS_GRANT_BLOCKED",
      (seeOwn || []).length === 0 && (seeOther || []).length === 0,
      `own=${seeOwn?.length} other=${seeOther?.length} err=${ownErr?.code || otherErr?.code || "none"}`,
    );

    // Membership cross-tenant: User A cannot see Org B memberships
    const { data: foreignMem } = await clientA
      .from("organization_members")
      .select("id, organization_id")
      .eq("organization_id", fx.orgB.id);
    record(
      "CROSS_TENANT_MEMBERSHIP_READ_BLOCKED",
      (foreignMem || []).length === 0,
      `count=${foreignMem?.length ?? 0}`,
    );

    const upd = await clientA
      .from("leads")
      .update({ first_name: "HACKED" })
      .eq("id", insB.data.id)
      .select("id");
    record(
      "CROSS_TENANT_UPDATE_BLOCKED",
      !!upd.error || (upd.data || []).length === 0,
      `updated=${upd.data?.length ?? 0} code=${upd.error?.code || "none"}`,
    );

    const del = await clientA
      .from("leads")
      .delete()
      .eq("id", insB.data.id)
      .select("id");
    record(
      "CROSS_TENANT_DELETE_BLOCKED",
      !!del.error || (del.data || []).length === 0,
      `deleted=${del.data?.length ?? 0} code=${del.error?.code || "none"}`,
    );

    const createCross = await clientA
      .from("leads")
      .insert({
        organization_id: fx.orgB.id,
        status: "new",
        first_name: "Cross",
        last_name: "Write",
        email: `cross.write.${Date.now()}@example.invalid`,
        source: "staging_rls_probe",
      })
      .select("id");
    record(
      "CROSS_TENANT_INSERT_BLOCKED",
      !!createCross.error || (createCross.data || []).length === 0,
      createCross.error?.code || `rows=${createCross.data?.length ?? 0}`,
    );
  }

  if (jwtB && insA.data?.id) {
    const { data: bMemA } = await clientB
      .from("organization_members")
      .select("id")
      .eq("organization_id", fx.orgA.id);
    record(
      "USER_B_CANNOT_READ_ORG_A_MEMBERSHIP",
      (bMemA || []).length === 0,
      `count=${bMemA?.length ?? 0}`,
    );
  }

  // Command Center durable read via authenticated cookie + service_role server path
  if (sessionA) {
    const cookie = sessionCookieHeader(sessionA, url);
    const state = await jsonFetch("/api/campaigns/state", {
      headers: { cookie },
    });
    const leads = state.body?.leads || [];
    const seesOrgA = leads.some((l) => l.organization_id === fx.orgA.id);
    const seesOrgB = leads.some((l) => l.organization_id === fx.orgB.id);
    record(
      "COMMAND_CENTER_AUTH",
      state.status === 200 && state.body?.dataMode === "supabase",
      `status=${state.status} mode=${state.body?.dataMode}`,
    );
    record(
      "COMMAND_CENTER_TENANT_SCOPE",
      state.status === 200 && !seesOrgB,
      `orgA=${seesOrgA} orgB=${seesOrgB} count=${leads.length}`,
    );

    // Org spoof via query/body must not expand scope
    const spoofOrg = await jsonFetch(
      `/api/campaigns/state?organization_id=${fx.orgB.id}`,
      { headers: { cookie } },
    );
    const spoofLeads = spoofOrg.body?.leads || [];
    record(
      "ORG_QUERY_SPOOF_BLOCKED",
      spoofOrg.status === 200 &&
        !spoofLeads.some((l) => l.organization_id === fx.orgB.id),
      `orgB=${spoofLeads.some((l) => l.organization_id === fx.orgB.id)}`,
    );
  }

  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonRpc = await anonClient.rpc("is_org_member", {
    target_org: fx.orgA.id,
  });
  record(
    "UNAUTH_IS_ORG_MEMBER_FALSE",
    anonRpc.data === false ||
      anonRpc.data === null ||
      !!anonRpc.error,
    `data=${String(anonRpc.data)} err=${anonRpc.error?.message || "none"}`,
  );

  // Direct anon table probes
  for (const table of [
    "leads",
    "organizations",
    "organization_members",
    "assessment_sessions",
    "lead_scores",
  ]) {
    const { data, error } = await anonClient.from(table).select("id").limit(1);
    record(
      `ANON_TABLE_BLOCKED_${table.toUpperCase()}`,
      !!error || (data || []).length === 0,
      error?.code || `rows=${data?.length ?? 0}`,
    );
  }

  // Logout
  if (sessionA) {
    const logout = await clientA.auth.signOut();
    record("AUTH_LOGOUT_A", !logout.error, logout.error?.message || "");
    const after = await clientA.auth.getSession();
    record("AUTH_SESSION_CLEARED", !after.data.session, "");
    // re-login for remaining authenticated API tests after public assessment
    await clientA.auth.signInWithPassword({
      email: fx.userA.email,
      password: fx.userA.password,
    });
  }

  const attr = {
    utm_source: "meta",
    utm_medium: "paid_social",
    utm_campaign: "altus_staging_validation",
    altus_click_id: "click_staging_validation_001",
    provider: "meta",
  };
  const created = await jsonFetch("/api/public/assessment-session", {
    method: "POST",
    body: JSON.stringify({
      organizationSlug: fx.campaignA.organization_slug,
      campaignSlug: fx.campaignA.slug,
      attribution: attr,
    }),
  });
  record(
    "PUBLIC_SESSION_CREATE",
    created.status === 200 &&
      !!created.body?.sessionId &&
      !!created.body?.resumeToken,
    `status=${created.status} err=${created.body?.error || ""}`,
  );
  const sessionId = created.body?.sessionId;
  const resumeToken = created.body?.resumeToken;

  if (sessionId && resumeToken) {
    await jsonFetch("/api/public/assessment-session", {
      method: "PATCH",
      body: JSON.stringify({ sessionId, resumeToken, action: "start" }),
    });

    let answersOk = true;
    let branch = null;
    for (const [questionId, value] of Object.entries(ANSWERS)) {
      const patch = await jsonFetch("/api/public/assessment-session", {
        method: "PATCH",
        body: JSON.stringify({
          sessionId,
          resumeToken,
          action: "answer",
          questionId,
          value,
          stage: null,
        }),
      });
      if (patch.status !== 200) {
        answersOk = false;
        record(
          "PUBLIC_ANSWER_PERSIST",
          false,
          `${questionId} status=${patch.status} err=${patch.body?.error || ""}`,
        );
        break;
      }
      branch = patch.body?.branch ?? branch;
    }
    if (answersOk) {
      record(
        "PUBLIC_ANSWER_PERSIST",
        true,
        `questions=${Object.keys(ANSWERS).length} branch=${branch}`,
      );
    }

    // Change answer / branch
    const change = await jsonFetch("/api/public/assessment-session", {
      method: "PATCH",
      body: JSON.stringify({
        sessionId,
        resumeToken,
        action: "answer",
        questionId: "primary_objective",
        value: "BALANCE",
      }),
    });
    record("PUBLIC_ANSWER_CHANGE", change.status === 200, `status=${change.status}`);

    const badTok = await jsonFetch("/api/public/assessment-session", {
      method: "PATCH",
      body: JSON.stringify({
        sessionId,
        resumeToken: "0".repeat(64),
        action: "answer",
        questionId: "state",
        value: "TX",
      }),
    });
    record(
      "RESUME_TOKEN_REJECTS_WRONG",
      badTok.status === 404,
      `status=${badTok.status}`,
    );

    // Another session's token cannot modify this session
    const other = await jsonFetch("/api/public/assessment-session", {
      method: "POST",
      body: JSON.stringify({
        organizationSlug: fx.campaignA.organization_slug,
        campaignSlug: fx.campaignA.slug,
        attribution: attr,
      }),
    });
    if (other.body?.resumeToken) {
      const steal = await jsonFetch("/api/public/assessment-session", {
        method: "PATCH",
        body: JSON.stringify({
          sessionId,
          resumeToken: other.body.resumeToken,
          action: "answer",
          questionId: "state",
          value: "TX",
        }),
      });
      record(
        "RESUME_TOKEN_CROSS_SESSION_BLOCKED",
        steal.status === 404,
        `status=${steal.status}`,
      );
    }

    const enumGet = await jsonFetch(
      `/api/public/assessment-session?sessionId=${sessionId}`,
    );
    record(
      "SESSION_ENUMERATION_BLOCKED",
      enumGet.status === 400 ||
        enumGet.status === 404 ||
        !enumGet.body?.answers,
      `status=${enumGet.status}`,
    );

    const resume = await jsonFetch(
      `/api/public/assessment-session?resumeToken=${encodeURIComponent(resumeToken)}`,
    );
    record(
      "RESUME_BY_TOKEN",
      resume.status === 200 && resume.body?.sessionId === sessionId,
      `status=${resume.status}`,
    );
    record(
      "PUBLIC_NO_INTERNAL_SCORE",
      resume.body &&
        !("score" in resume.body) &&
        !("temperature" in resume.body) &&
        !("opportunity_score" in resume.body),
      "",
    );

    const crm = await jsonFetch("/api/crm");
    record(
      "PUBLIC_CRM_BLOCKED",
      crm.status === 401 || crm.status === 403 || crm.status === 405,
      `status=${crm.status}`,
    );

    const contactBody = {
      organizationSlug: fx.campaignA.organization_slug,
      campaignSlug: fx.campaignA.slug,
      answers: ANSWERS,
      contact: {
        firstName: "Synth",
        lastName: "Prospect",
        businessName: "Synth Prospect Household",
        email: `synth.prospect.${Date.now()}@example.invalid`,
        phone: "5550100999",
        state: "FL",
        preferredContact: "phone",
        consent: true,
      },
      appointmentRequested: false,
      sessionId,
      resumeToken,
      attribution: attr,
      submissionStartedAt: new Date(Date.now() - 20_000).toISOString(),
    };
    const lead1 = await jsonFetch("/api/public/leads", {
      method: "POST",
      body: JSON.stringify(contactBody),
    });
    record(
      "LEAD_CREATE",
      lead1.status === 200 && !!lead1.body?.leadId,
      `status=${lead1.status} err=${lead1.body?.error || ""}`,
    );
    record(
      "CONSUMER_NO_SCORE_FIELD",
      lead1.status === 200 &&
        lead1.body &&
        !("score" in (lead1.body.consumerProfile || {})) &&
        !("temperature" in (lead1.body.consumerProfile || {})),
      "",
    );
    const leadId = lead1.body?.leadId;

    const lead2 = await jsonFetch("/api/public/leads", {
      method: "POST",
      body: JSON.stringify(contactBody),
    });
    const lead3 = await jsonFetch("/api/public/leads", {
      method: "POST",
      body: JSON.stringify(contactBody),
    });
    record(
      "IDEMPOTENT_LEAD",
      lead2.status === 200 &&
        lead3.status === 200 &&
        lead2.body?.leadId === leadId &&
        lead3.body?.leadId === leadId,
      `same=${lead2.body?.leadId === leadId}`,
    );

    if (leadId && sessionId) {
      const { data: sess } = await admin
        .from("assessment_sessions")
        .select(
          "id, lead_id, status, branch, completion_percentage, attribution, answers, campaign_id",
        )
        .eq("id", sessionId)
        .single();
      record(
        "DURABLE_SESSION",
        !!sess && sess.lead_id === leadId,
        `status=${sess?.status} branch=${sess?.branch}`,
      );
      record(
        "ATTRIBUTION_PERSISTED",
        sess?.attribution?.utm_source === "meta" &&
          sess?.attribution?.utm_campaign === "altus_staging_validation" &&
          sess?.attribution?.altus_campaign_id === fx.campaignA.id &&
          sess?.campaign_id === fx.campaignA.id,
        `utm=${sess?.attribution?.utm_source}`,
      );

      const { data: answers, error: ansErr } = await admin
        .from("assessment_session_answers")
        .select("question_key")
        .eq("session_id", sessionId);
      record(
        "DURABLE_RESPONSES",
        !ansErr && (answers || []).length >= 10,
        `count=${answers?.length ?? 0}`,
      );

      const { data: lead } = await admin
        .from("leads")
        .select(
          "id, organization_id, assessment_session_id, campaign_id, opportunity_score, score, operational_temperature, temperature_key, attribution, assessment_answers, consent_captured, email",
        )
        .eq("id", leadId)
        .single();
      record(
        "LEAD_LINKED_SESSION",
        lead?.assessment_session_id === sessionId &&
          lead?.organization_id === fx.orgA.id &&
          lead?.campaign_id === fx.campaignA.id,
        "",
      );
      record(
        "DURABLE_SCORE",
        typeof lead?.opportunity_score === "number" ||
          typeof lead?.score === "number",
        `opp=${lead?.opportunity_score} score=${lead?.score}`,
      );
      record(
        "DURABLE_TEMPERATURE",
        ["HOT", "MEDIUM", "COLD"].includes(lead?.operational_temperature) ||
          ["HOT", "MEDIUM", "COLD"].includes(lead?.temperature_key),
        `temp=${lead?.operational_temperature || lead?.temperature_key}`,
      );
      record(
        "LEAD_ATTRIBUTION",
        lead?.attribution?.utm_source === "meta",
        `utm=${lead?.attribution?.utm_source}`,
      );

      const { count: leadCount } = await admin
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("assessment_session_id", sessionId);
      record("EXACTLY_ONE_LEAD", leadCount === 1, `count=${leadCount}`);

      const { data: scores } = await admin
        .from("lead_scores")
        .select("id, total_score, classification")
        .eq("lead_id", leadId);
      record(
        "LEAD_SCORES_ROW",
        (scores || []).length >= 1,
        `count=${scores?.length ?? 0} total=${scores?.[0]?.total_score}`,
      );

      const { data: temps } = await admin
        .from("lead_temperature_snapshots")
        .select("id, temperature")
        .eq("lead_id", leadId);
      record(
        "TEMP_HISTORY_ROW",
        (temps || []).length >= 1,
        `count=${temps?.length ?? 0}`,
      );

      const { data: anonLead } = await anonClient
        .from("leads")
        .select("id")
        .eq("id", leadId);
      record(
        "PUBLIC_CANNOT_READ_LEAD",
        (anonLead || []).length === 0,
        `count=${anonLead?.length ?? 0}`,
      );

      // Authenticated Command Center + lead detail for this durable lead
      const reLogin = await clientA.auth.signInWithPassword({
        email: fx.userA.email,
        password: fx.userA.password,
      });
      if (reLogin.data.session) {
        const cookie = sessionCookieHeader(reLogin.data.session, url);
        const state = await jsonFetch("/api/campaigns/state", {
          headers: { cookie },
        });
        const found = (state.body?.leads || []).some((l) => l.id === leadId);
        record(
          "COMMAND_CENTER_SEES_LEAD",
          state.status === 200 && found,
          `found=${found}`,
        );

        const detail = await jsonFetch(`/api/leads/${leadId}`, {
          headers: { cookie },
        });
        record(
          "LEAD_DETAIL_DURABLE",
          detail.status === 200 &&
            detail.body?.dataMode === "supabase" &&
            detail.body?.lead?.id === leadId,
          `status=${detail.status} mode=${detail.body?.dataMode}`,
        );

        // Cross-org lead detail blocked
        if (insB.data?.id) {
          const foreign = await jsonFetch(`/api/leads/${insB.data.id}`, {
            headers: { cookie },
          });
          record(
            "LEAD_DETAIL_CROSS_ORG_BLOCKED",
            foreign.status === 404 || foreign.status === 403,
            `status=${foreign.status}`,
          );
        }
      }

      globalThis.__ALTUS_LEAD_ID = leadId;
      globalThis.__ALTUS_SESSION_ID = sessionId;
      globalThis.__ALTUS_SCORE = lead?.opportunity_score ?? lead?.score ?? null;
      globalThis.__ALTUS_TEMP =
        lead?.operational_temperature || lead?.temperature_key || null;
    }
  }

  const badLead = await jsonFetch("/api/public/leads", {
    method: "POST",
    body: JSON.stringify({ bogus: true }),
  });
  record(
    "VALIDATION_FAILURE_OBSERVED",
    badLead.status === 400,
    `status=${badLead.status}`,
  );

  const failed = results.filter((r) => !r.pass);
  console.log("\n=== SUMMARY ===");
  console.log(`PASS ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    console.log("FAILED:");
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  }
  console.log(
    `INTERNAL_SCORE_TEMP opp=${globalThis.__ALTUS_SCORE} temp=${globalThis.__ALTUS_TEMP}`,
  );

  const summary = {
    at: new Date().toISOString(),
    app: APP,
    pass: results.length - failed.length,
    total: results.length,
    results: results.map(({ name, pass, detail }) => ({ name, pass, detail })),
    leadId: globalThis.__ALTUS_LEAD_ID || null,
    sessionId: globalThis.__ALTUS_SESSION_ID || null,
    opportunityScore: globalThis.__ALTUS_SCORE ?? null,
    temperature: globalThis.__ALTUS_TEMP ?? null,
  };
  writeFileSync(
    resolve(ROOT, ".staging-validation-summary.local.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log("Wrote .staging-validation-summary.local.json");
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
