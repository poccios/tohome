import dotenv from 'dotenv';
import { SmsProvider } from './SmsProvider';
import { MockSmsProvider } from './MockSmsProvider';
import { SkebbySmsProvider } from './SkebbySmsProvider';

dotenv.config();

export function createSmsProvider(): SmsProvider {
  const provider = process.env.SMS_PROVIDER || 'mock';

  if (provider === 'skebby') {
    const email = process.env.SKEBBY_EMAIL;
    const password = process.env.SKEBBY_PASSWORD;
    const baseUrl = process.env.SKEBBY_BASE_URL || 'https://api.skebby.it/API/v1.0/REST';
    const messageType = (process.env.SKEBBY_MESSAGE_TYPE || 'GP') as 'GP' | 'TI' | 'SI';
    const sender = process.env.SKEBBY_SENDER;

    if (!email || !password) {
      console.warn('Skebby credentials missing, falling back to mock SMS provider');
      return new MockSmsProvider();
    }

    console.log('Using Skebby SMS provider');
    return new SkebbySmsProvider({
      email,
      password,
      baseUrl,
      messageType,
      sender,
    });
  }

  console.log('Using mock SMS provider');
  return new MockSmsProvider();
}
