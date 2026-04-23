import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly service: UserService) {}

  @Public()
  @Get('dashboard')
  getDashboard(@Query('email') email: string) {
    if (!email?.trim()) throw new BadRequestException('Email requis.');
    return this.service.getDashboard(email);
  }
}
