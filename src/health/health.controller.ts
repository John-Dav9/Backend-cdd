import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { FirebaseService } from '../firebase/firebase.service';
import { MailService } from '../mail/mail.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly mail: MailService,
  ) {}

  @Public()
  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        firebase: this.firebase.isReady ? 'ok' : 'not_configured',
        mail: this.mail.isConfigured ? 'ok' : 'not_configured',
        mailAdminInbox: this.mail.isAdminInboxConfigured ? 'ok' : 'not_configured',
      },
    };
  }
}
