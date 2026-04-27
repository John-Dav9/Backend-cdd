import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { NewsletterService } from './newsletter.service';

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly service: NewsletterService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('subscribe')
  subscribe(@Body() body: { email: string; prenom?: string }) {
    return this.service.subscribe(body.email, body.prenom);
  }

  @Get('subscribers')
  findAll() {
    return this.service.findAll();
  }

  @Delete('subscribers/:id')
  desabonner(@Param('id') id: string) {
    return this.service.desabonner(id);
  }
}
