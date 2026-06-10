import { Body, Controller, Delete, Get, Post, Request } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Public()
  @Get('configuration')
  configuration() {
    return this.notifications.getConfiguration();
  }

  @Post('subscriptions')
  @Roles('member', 'admin', 'super_admin')
  subscribe(@Request() req: any, @Body() subscription: any) {
    return this.notifications.subscribe(req.user.sub, subscription);
  }

  @Delete('subscriptions')
  @Roles('member', 'admin', 'super_admin')
  unsubscribe(@Request() req: any, @Body('endpoint') endpoint: string) {
    return this.notifications.unsubscribe(req.user.sub, endpoint);
  }
}
