import { EmailProvider } from './EmailProvider';

/**
 * Mock Email Provider for testing
 * Does not send actual emails, just logs to console and stores last message in memory
 */

interface MockEmailMessage {
  to: string;
  subject: string;
  text: string;
  created_at: Date;
}

export class MockEmailProvider implements EmailProvider {
  private lastMessage: MockEmailMessage | null = null;

  async send(to: string, subject: string, text: string): Promise<void> {
    // Store last message in memory for debugging
    this.lastMessage = {
      to,
      subject,
      text,
      created_at: new Date(),
    };

    // Log in simple format
    console.log(`MOCK_EMAIL_SENT to=${to}`);
  }

  /**
   * Get the last sent message (useful for debugging/testing)
   */
  getLastMessage(): MockEmailMessage | null {
    return this.lastMessage;
  }
}
