import { Controller, Get } from '@nestjs/common';
import { StatsService } from './stats.service';
import { AdminOnly } from '../auth/roles.decorator';

@AdminOnly()
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  getOverview() {
    return this.statsService.getOverview();
  }
}
