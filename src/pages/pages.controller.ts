import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { PagesService } from './pages.service';

@Controller('pages')
export class PagesController {
  constructor(private readonly service: PagesService) {}

  @Public()
  @Get('home')
  getHome() {
    return this.service.getHome();
  }

  @Public()
  @Get('about')
  getAbout() {
    return this.service.getAbout();
  }

  @Public()
  @Get('church-life')
  getChurchLife() {
    return this.service.getChurchLife();
  }
}
