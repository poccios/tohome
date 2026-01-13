import { SmsProvider } from './SmsProvider';

export class MockSmsProvider implements SmsProvider {
  async send(toE164: string, text: string): Promise<void> {
    console.log('=== MOCK SMS ===');
    console.log(`To: ${toE164}`);
    console.log(`Message: ${text}`);
    console.log('================');
  }
}
