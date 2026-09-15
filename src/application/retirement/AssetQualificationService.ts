import {
  DEFAULT_ASSET_BANDS,
  TARGET_REPOSITIONABLE_MIN_CENTS,
  type AssetCommercialTier,
  type AssetQualification,
  type AssetVerificationStatus,
} from "@/domain/types/retirement-qualification";

export class AssetQualificationService {
  qualify(
    answers: Record<string, string>,
    verification: AssetVerificationStatus = "SELF_REPORTED",
  ): AssetQualification {
    const band = answers.repositionable_assets ?? null;
    const match = DEFAULT_ASSET_BANDS.find((b) => b.key === band) ?? null;

    // Prefer explicit $3M+ when total assets imply BLACK and repositionable is $1M+
    let tier: AssetCommercialTier = match?.tier ?? "BELOW_TARGET";
    let min = match?.min_cents ?? null;
    let max = match?.max_cents ?? null;

    if (band === "$1M+" && answers.total_retirement_assets === "$3M+") {
      tier = "BLACK";
      min = 300_000_000;
      max = null;
    }
    if (band === "$1M+" || band === "$2M+") {
      // keep DIAMOND unless upgraded above
      if (tier !== "BLACK") tier = "DIAMOND";
    }

    const meets =
      min != null ? min >= TARGET_REPOSITIONABLE_MIN_CENTS : false;

    return {
      repositionable_asset_band: band,
      repositionable_min_cents: min,
      repositionable_max_cents: max,
      meets_target_asset_threshold: meets,
      commercial_tier: tier,
      verification_status: verification,
      total_retirement_asset_band: answers.total_retirement_assets ?? null,
    };
  }

  opportunityPoints(band: string | null): number {
    const match = DEFAULT_ASSET_BANDS.find((b) => b.key === band);
    return match?.opportunity_points ?? 0;
  }
}
