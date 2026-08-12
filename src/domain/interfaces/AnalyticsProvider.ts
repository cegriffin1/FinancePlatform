import type { UUID } from "@/domain/types";

export type AnalyticsQuery = {
  organizationId: UUID;
  metric: string;
  from: string;
  to: string;
  dimensions?: string[];
};

export type AnalyticsResult = {
  metric: string;
  points: Array<{ key: string; value: number }>;
};

export interface AnalyticsProvider {
  query(input: AnalyticsQuery): Promise<AnalyticsResult>;
}
