import { Body, Controller, Post, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsArray, IsOptional } from 'class-validator';
import { ChatService, ChatMessage } from './chat.service';
import { Public } from '../auth/public.decorator';

class ChatDto {
  @IsArray()
  @IsOptional()
  history: ChatMessage[];

  @IsString()
  message: string;
}

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  async chat(@Body() dto: ChatDto) {
    if (!dto.message?.trim()) {
      throw new HttpException('Message requis.', HttpStatus.BAD_REQUEST);
    }

    const history: ChatMessage[] = (dto.history ?? []).slice(-10);

    try {
      const reply = await this.chatService.chat(history, dto.message.trim());
      return { reply };
    } catch (err) {
      this.logger.error('Chat error:', (err as Error)?.message ?? err);
      throw new HttpException('Erreur lors de la génération de la réponse.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
