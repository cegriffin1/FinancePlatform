export type OutboundMessage = {
  to: string;
  subject?: string;
  body: string;
  channel: "email" | "sms";
};

export interface CommunicationProvider {
  send(message: OutboundMessage): Promise<{ id: string }>;
}
