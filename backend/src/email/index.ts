import { EmailProvider } from './EmailProvider';
import { SmtpEmailProvider } from './SmtpEmailProvider';
import { MockEmailProvider } from './MockEmailProvider';

export function createEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER || 'smtp';

  if (provider === 'smtp') {
    const config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.EMAIL_FROM || 'ToHome <no-reply@tohome.local>',
    };

    if (!config.user || !config.pass) {
      throw new Error('SMTP_USER and SMTP_PASS environment variables are required');
    }

    console.log('Using SMTP email provider');
    return new SmtpEmailProvider(config);
  }

  if (provider === 'mock') {
    console.log('Using Mock email provider (testing only)');
    return new MockEmailProvider();
  }

  throw new Error(`Unknown email provider: ${provider}`);
}
