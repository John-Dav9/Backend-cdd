import { Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactService {
  constructor(private readonly mail: MailService) {}

  async send(dto: CreateContactDto) {
    await this.mail.sendContact(dto.name, dto.email, dto.message);
    return { message: 'Message envoyé avec succès.' };
  }
}
