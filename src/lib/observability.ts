export const ALTUS_ERROR_CODES = [
  "ASSESSMENT_SESSION_ERROR",
  "ASSESSMENT_RESPONSE_ERROR",
  "LEAD_CREATION_ERROR",
  "SCORING_ERROR",
  "TEMPERATURE_ERROR",
  "ASSIGNMENT_ERROR",
  "AUTH_ERROR",
  "AUTHORIZATION_ERROR",
  "DATABASE_ERROR",
  "ATTRIBUTION_ERROR",
] as const;

export type AltusErrorCode = (typeof ALTUS_ERROR_CODES)[number];

/** Server-side structured log — never log secrets or full assessment PII. */
export function logAltusError(
  code: AltusErrorCode,
  message: string,
  meta?: Record<string, unknown>,
) {
  const safe = meta
    ? Object.fromEntries(
        Object.entries(meta).filter(
          ([k]) =>
            !/password|token|secret|key|authorization|cookie/i.test(k),
        ),
      )
    : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      code,
      message,
      meta: safe,
      at: new Date().toISOString(),
    }),
  );
}

export function publicError(
  code: AltusErrorCode,
  userMessage: string,
  status = 500,
) {
  return { error: userMessage, code, status };
}
