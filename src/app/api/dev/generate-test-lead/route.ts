import { NextResponse } from "next/server";
import { z } from "zod";
import { generateTestLead } from "@/application/growth/leadPipeline";
import { isGrowthDevToolsEnabled } from "@/application/growth/simulationStore";

export async function POST(request: Request) {
  if (!isGrowthDevToolsEnabled()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const body = z.object({ campaignId: z.string().uuid() }).parse(await request.json());
    const result = generateTestLead(body.campaignId);
    return NextResponse.json({
      ok: true,
      leadId: result.lead.id,
      score: result.lead.score,
      temperature: result.lead.temperature_key,
      assignedOrganizationId: result.lead.assigned_organization_id,
      distributionStatus: result.lead.distribution_status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
