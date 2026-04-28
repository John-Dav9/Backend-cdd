import { Body, Controller, Post, HttpException, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatService, ChatMessage } from './chat.service';
import { Public } from '../auth/public.decorator';

class ChatDto {
  history: ChatMessage[];
  message: string;
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  async chat(@Body() dto: ChatDto) {
    if (!dto.message?.trim()) {
      throw new HttpException('Message requis.', HttpStatus.BAD_REQUEST);
    }

    const history: ChatMessage[] = (dto.history ?? []).slice(-10); // max 10 messages d'historique

    const reply = await this.chatService.chat(history, dto.message.trim());
    return { reply };
  }
}
