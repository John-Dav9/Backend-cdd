import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: any;

  constructor(private config: ConfigService) {
    const sid = config.get('TWILIO_ACCOUNT_SID');
    const token = config.get('TWILIO_AUTH_TOKEN');
    if (sid && token) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const twilio = require('twilio');
      this.twilioClient = twilio(sid, token);
    }
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    const message = `CMCIEA France - Votre code de connexion : ${code} (valable 15 min)`;

    if (!this.twilioClient) {
      this.logger.warn(`[DEV] SMS vers ${phone}: ${message}`);
      return;
    }

    await this.twilioClient.messages.create({
      body: message,
      from: this.config.get('TWILIO_PHONE_NUMBER'),
      to: phone,
    });
  }
}
