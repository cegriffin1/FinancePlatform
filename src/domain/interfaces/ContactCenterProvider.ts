export type ContactCenterEvent = {
  organizationId: string;
  externalConversationId: string;
  channel: "voice" | "chat" | "email";
  payload: Record<string, unknown>;
};

export interface ContactCenterProvider {
  ingestEvent(event: ContactCenterEvent): Promise<void>;
}
