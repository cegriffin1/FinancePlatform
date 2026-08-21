import { AltusNav } from "@/components/altus/AltusNav";
import { AltusHero } from "@/components/altus/AltusHero";
import { AltusMetricStrip } from "@/components/altus/AltusMetricStrip";
import { AltusJourneyNav } from "@/components/altus/AltusJourneyNav";
import { AltusStartHere } from "@/components/altus/AltusStartHere";
import { AltusInsights } from "@/components/altus/AltusInsights";
import { AltusRecommendations } from "@/components/altus/AltusRecommendations";
import { AltusReviews } from "@/components/altus/AltusReviews";
import { AltusIntelligencePanel } from "@/components/altus/AltusIntelligencePanel";
import { AltusFinalCta } from "@/components/altus/AltusFinalCta";
import { AltusFooter } from "@/components/altus/AltusFooter";
import { AltusAssistant } from "@/components/altus/AltusAssistant";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <AltusNav />
      <main>
        <AltusHero />
        <AltusMetricStrip />
        <AltusJourneyNav />
        <AltusStartHere />
        <AltusInsights />
        <AltusRecommendations />
        <AltusReviews />
        <AltusIntelligencePanel />
        <AltusFinalCta />
      </main>
      <AltusFooter />
      <AltusAssistant />
    </div>
  );
}
