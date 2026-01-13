import { EmailProvider } from './EmailProvider';
import nodemailer from 'nodemailer';

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export class SmtpEmailProvider implements EmailProvider {
  private config: SmtpConfig;
  private transporter: nodemailer.Transporter;

  constructor(config: SmtpConfig) {
    this.config = config;

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: false, // true for 465, false for other ports
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to: to,
        subject: subject,
        text: text,
      });

      console.log(`Email sent successfully to ${to}: ${info.messageId}`);
    } catch (error) {
      console.error('Email send error:', error);
      throw new Error('Failed to send email');
    }
  }
}
