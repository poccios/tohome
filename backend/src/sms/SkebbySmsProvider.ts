import { SmsProvider } from './SmsProvider';

interface SkebbyConfig {
  email: string;
  password: string;
  baseUrl: string;
  messageType: 'GP' | 'TI' | 'SI';
  sender?: string;
}

interface SkebbyToken {
  userKey: string;
  accessToken: string;
}

export class SkebbySmsProvider implements SmsProvider {
  private config: SkebbyConfig;
  private cachedToken: SkebbyToken | null = null;

  constructor(config: SkebbyConfig) {
    this.config = config;
  }

  private async getToken(): Promise<SkebbyToken> {
    if (this.cachedToken) {
      return this.cachedToken;
    }

    const url = `${this.config.baseUrl}/token`;
    const authHeader = Buffer.from(
      `${this.config.email}:${this.config.password}`
    ).toString('base64');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${authHeader}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      console.log('SKEBBY_TOKEN_STATUS', response.status);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Skebby token request failed: ${response.status}`, errorBody.substring(0, 200));
        throw new Error(`Failed to get Skebby token: ${response.status}`);
      }

      const responseText = await response.text();

      if (!responseText.includes(';')) {
        const bodyPreview = responseText.substring(0, 200);
        console.error('Invalid Skebby token format - no semicolon:', bodyPreview);
        throw new Error(`Invalid Skebby token response: ${bodyPreview}`);
      }

      const [userKey, accessToken] = responseText.split(';');

      if (!userKey || !accessToken) {
        console.error('Invalid Skebby token format - missing parts');
        throw new Error('Invalid Skebby token response');
      }

      this.cachedToken = { userKey, accessToken };
      console.log('Skebby token acquired successfully');

      return this.cachedToken;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Skebby token request timeout');
        throw new Error('Skebby token request timeout');
      }
      throw error;
    }
  }

  private invalidateToken(): void {
    this.cachedToken = null;
    console.log('Skebby token invalidated');
  }

  private async sendSms(
    toE164: string,
    text: string,
    token: SkebbyToken
  ): Promise<void> {
    const url = `${this.config.baseUrl}/sms`;

    const body = {
      message_type: this.config.messageType,
      message: text,
      recipient: [toE164],
      returnCredits: false,
      ...(this.config.sender && { sender: this.config.sender }),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          user_key: token.userKey,
          Access_token: token.accessToken,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      console.log('SKEBBY_SMS_STATUS', response.status);

      if (response.status === 401 || response.status === 403) {
        throw new Error('UNAUTHORIZED');
      }

      if (response.status !== 201) {
        const errorBody = await response.text();
        const bodyPreview = errorBody.substring(0, 800);
        console.log('SKEBBY_SMS_BODY', bodyPreview);
        console.error(`Skebby SMS send failed: ${response.status}`, bodyPreview);
        throw new Error(`Failed to send SMS: ${response.status} - ${bodyPreview}`);
      }

      const responseBody = await response.text();
      console.log('SKEBBY_SMS_BODY', responseBody.substring(0, 800));

      let result;
      try {
        result = JSON.parse(responseBody);
      } catch (e) {
        console.error('Failed to parse SMS response as JSON:', responseBody.substring(0, 200));
        throw new Error('Invalid SMS response format');
      }

      if (result.result !== 'OK') {
        console.error('Skebby SMS send result not OK:', result);
        throw new Error('SMS send result not OK');
      }

      console.log(`SMS sent successfully to ${toE164}`);
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Skebby SMS send timeout');
        throw new Error('SMS send timeout');
      }

      throw error;
    }
  }

  async send(toE164: string, text: string): Promise<void> {
    try {
      // First attempt
      const token = await this.getToken();
      await this.sendSms(toE164, text, token);
    } catch (error) {
      // Retry once if unauthorized
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        console.log('Skebby unauthorized, retrying with new token');
        this.invalidateToken();

        try {
          const newToken = await this.getToken();
          await this.sendSms(toE164, text, newToken);
        } catch (retryError) {
          console.error('Skebby SMS send failed on retry');
          throw new Error('Failed to send SMS after retry');
        }
      } else {
        throw error;
      }
    }
  }
}
