import type { Metadata } from "next";
import { HIGHWATER_BRAND } from "@/domain/brand/highwater";

export const metadata: Metadata = {
  title: `${HIGHWATER_BRAND.name} — Retirement Assessment`,
  description: `${HIGHWATER_BRAND.positioning} ${HIGHWATER_BRAND.description}`,
};

export default function AssessmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
