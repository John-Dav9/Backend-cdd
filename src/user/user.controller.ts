import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly service: UserService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('dashboard')
  getDashboard(@Query('email') email: string) {
    if (!email?.trim()) throw new BadRequestException('Email requis.');
    return this.service.getDashboard(email);
  }
}
