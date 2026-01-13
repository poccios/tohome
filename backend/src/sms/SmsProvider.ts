export interface SmsProvider {
  send(toE164: string, text: string): Promise<void>;
}
