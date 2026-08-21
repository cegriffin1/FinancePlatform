import type {
  FraudRiskLevel,
  QualityGateOutcome,
  ValidationStatus,
} from "@/domain/types/lead-intelligence";

export type ContactValidationResult = {
  status: ValidationStatus;
  provider: string;
  reason_code: string;
  validated_at: string | null;
};

export interface ContactValidationProvider {
  validateEmail(email: string): Promise<ContactValidationResult>;
  validatePhone(phone: string): Promise<ContactValidationResult>;
  normalizePhone(phone: string): Promise<string>;
  validateDomain(domain: string): Promise<ContactValidationResult>;
}

/** Returns NOT_VERIFIED when no commercial provider is configured. */
export class StubContactValidationProvider implements ContactValidationProvider {
  async validateEmail(email: string): Promise<ContactValidationResult> {
    const basic = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!basic) {
      return {
        status: "INVALID",
        provider: "format_only",
        reason_code: "INVALID_FORMAT",
        validated_at: new Date().toISOString(),
      };
    }
    const disposable = /(mailinator|tempmail|guerrillamail|10minutemail)/i.test(
      email,
    );
    if (disposable) {
      return {
        status: "RISKY",
        provider: "format_only",
        reason_code: "DISPOSABLE_DOMAIN",
        validated_at: new Date().toISOString(),
      };
    }
    return {
      status: "NOT_VERIFIED",
      provider: "none",
      reason_code: "PROVIDER_NOT_CONFIGURED",
      validated_at: null,
    };
  }

  async validatePhone(phone: string): Promise<ContactValidationResult> {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      return {
        status: "INVALID",
        provider: "format_only",
        reason_code: "INVALID_FORMAT",
        validated_at: new Date().toISOString(),
      };
    }
    return {
      status: "NOT_VERIFIED",
      provider: "none",
      reason_code: "PROVIDER_NOT_CONFIGURED",
      validated_at: null,
    };
  }

  async normalizePhone(phone: string): Promise<string> {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return digits ? `+${digits}` : phone;
  }

  async validateDomain(domain: string): Promise<ContactValidationResult> {
    if (!domain.includes(".")) {
      return {
        status: "INVALID",
        provider: "format_only",
        reason_code: "INVALID_FORMAT",
        validated_at: new Date().toISOString(),
      };
    }
    return {
      status: "NOT_VERIFIED",
      provider: "none",
      reason_code: "PROVIDER_NOT_CONFIGURED",
      validated_at: null,
    };
  }
}

export type QualityGateInput = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  businessName: string;
  state: string;
  consent: boolean;
  answers: Record<string, string>;
  submissionStartedAt?: string | null;
  honeypot?: string | null;
  recentSubmissionCount?: number;
};

export type QualityGateResult = {
  outcome: QualityGateOutcome;
  reasons: string[];
  fraud_risk: FraudRiskLevel;
  fraud_reasons: string[];
};

const INVALID_NAMES = ["test", "asdf", "xxx", "n/a", "none", "foo", "bar"];

export class LeadQualityGateService {
  constructor(private readonly validation = new StubContactValidationProvider()) {}

  async evaluate(input: QualityGateInput): Promise<QualityGateResult> {
    const reasons: string[] = [];
    const fraud_reasons: string[] = [];
    let fraud_risk: FraudRiskLevel = "LOW";

    if (!input.consent) reasons.push("Missing communication consent");
    if (!input.firstName.trim() || !input.lastName.trim()) {
      reasons.push("Incomplete name");
    }
    if (!input.businessName.trim()) reasons.push("Missing business name");
    if (!input.state || input.state.length !== 2) reasons.push("Invalid geography");

    const email = await this.validation.validateEmail(input.email);
    if (email.status === "INVALID") reasons.push("Invalid email format");
    if (email.status === "RISKY") {
      fraud_reasons.push(email.reason_code);
      fraud_risk = "MEDIUM";
    }

    const phone = await this.validation.validatePhone(input.phone);
    if (phone.status === "INVALID") reasons.push("Invalid phone format");

    const nameBlob = `${input.firstName} ${input.lastName}`.toLowerCase();
    if (INVALID_NAMES.some((n) => nameBlob.includes(n))) {
      fraud_reasons.push("SUSPICIOUS_NAME");
      fraud_risk = fraud_risk === "LOW" ? "MEDIUM" : fraud_risk;
    }

    if (input.honeypot && input.honeypot.trim()) {
      fraud_reasons.push("HONEYPOT_TRIGGERED");
      fraud_risk = "HIGH";
    }

    if (input.submissionStartedAt) {
      const elapsed =
        Date.now() - new Date(input.submissionStartedAt).getTime();
      if (elapsed < 3_000) {
        fraud_reasons.push("SUBMISSION_TOO_FAST");
        fraud_risk = fraud_risk === "HIGH" ? "HIGH" : "MEDIUM";
      }
    }

    if ((input.recentSubmissionCount ?? 0) >= 5) {
      fraud_reasons.push("HIGH_VELOCITY");
      fraud_risk = "HIGH";
    }

    if (fraud_risk === "HIGH") {
      return {
        outcome: "SUSPECTED_FRAUD",
        reasons: [...reasons, ...fraud_reasons],
        fraud_risk,
        fraud_reasons,
      };
    }

    if (reasons.includes("Invalid email format") || reasons.includes("Invalid phone format")) {
      return {
        outcome: "REJECT",
        reasons,
        fraud_risk,
        fraud_reasons,
      };
    }

    if (reasons.length > 0) {
      return {
        outcome: "REVIEW",
        reasons,
        fraud_risk,
        fraud_reasons,
      };
    }

    if (fraud_risk === "MEDIUM") {
      return {
        outcome: "REVIEW",
        reasons: fraud_reasons,
        fraud_risk,
        fraud_reasons,
      };
    }

    return { outcome: "ACCEPT", reasons: [], fraud_risk, fraud_reasons };
  }
}

export class LeadFraudRiskService {
  assess(gate: QualityGateResult): { level: FraudRiskLevel; reasons: string[] } {
    return { level: gate.fraud_risk, reasons: gate.fraud_reasons };
  }
}
