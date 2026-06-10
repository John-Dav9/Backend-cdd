import { Controller, Get, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/roles.decorator';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly service: UserService) {}

  @Roles('member', 'admin', 'super_admin')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('dashboard')
  getDashboard(@Request() req: any) {
    return this.service.getDashboard(req.user.email);
  }
}
