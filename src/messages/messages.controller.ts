import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { MessagesService } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Public()
  @Get()
  findAll() {
    return this.service.findAll();
  }
}
