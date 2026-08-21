import type { AcceleratorModuleDescriptor } from "@/domain/types";

/**
 * Advanced Markets accelerator registration surface.
 * Supplies packs/templates to core engines — does not replace Lead.
 */
export interface AdvancedMarketsModule {
  descriptor: AcceleratorModuleDescriptor;
  strategyCatalog(): string[];
  scoringRulePackKey(): string;
  defaultQualificationTemplateKey(): string;
}
