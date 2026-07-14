import nodemailer from 'nodemailer';
import mg from 'nodemailer-mailgun-transport';
import { RenderedMailerData } from '../types/email';

if (!process.env.MAILGUN_KEY) {
  throw new Error('Mailgun key missing');
}

const auth = {
  api_key: process.env.MAILGUN_KEY,
  domain: process.env.MAILGUN_DOMAIN
};

/** Mail service class wrapping around mailgun */
class Mail {
  client: nodemailer.Transporter;

  sendOptions: Pick<nodemailer.SendMailOptions, 'from'>;

  constructor() {
    this.client = nodemailer.createTransport(mg({ auth }));
    this.sendOptions = {
      from: process.env.EMAIL_SENDER
    };
  }

  async sendMail(mailOptions: nodemailer.SendMailOptions) {
    // E2E CI only ever has fake Mailgun credentials, so a real send would
    // always fail. This is a workaround, not the final design.
    if (process.env.E2E_TESTING === 'true') {
      return { messageId: 'e2e-test-email-skipped' };
    }

    try {
      const response = await this.client.sendMail(mailOptions);
      return response;
    } catch (error) {
      console.error('Failed to send email: ', error);
      throw new Error('Email failed to send.');
    }
  }

  async send(data: RenderedMailerData) {
    const mailOptions: nodemailer.SendMailOptions = {
      from: this.sendOptions.from,
      to: data.to,
      subject: data.subject,
      html: data.html
    };

    try {
      const response = await this.sendMail(mailOptions);
      return response;
    } catch (error) {
      console.error('Error in prepping email.', error);
      throw new Error('Error in prepping email.');
    }
  }
}

/**
 * Mail service wrapping around mailgun
 */
export const mailerService = new Mail();
