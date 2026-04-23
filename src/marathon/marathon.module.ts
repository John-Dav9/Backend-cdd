import { Module } from '@nestjs/common';
import { MarathonController } from './marathon.controller';
import { MarathonService } from './marathon.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [FirebaseModule, MailModule],
  controllers: [MarathonController],
  providers: [MarathonService],
  exports: [MarathonService],
})
export class MarathonModule {}
