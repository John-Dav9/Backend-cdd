import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { MailModule } from '../mail/mail.module';
import { HealthController } from './health.controller';

@Module({
  imports: [FirebaseModule, MailModule],
  controllers: [HealthController],
})
export class HealthModule {}
