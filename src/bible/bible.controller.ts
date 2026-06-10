import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { BibleService } from './bible.service';

@Controller('bible')
export class BibleController {
  constructor(private bibleService: BibleService) {}

  @Public()
  @Get('books')
  getBooks() {
    return this.bibleService.getBooks();
  }

  @Public()
  @Get('metadata')
  getMetadata() {
    return this.bibleService.getMetadata();
  }

  @Public()
  @Get('books/:book/chapters')
  getChapters(@Param('book') book: string) {
    return this.bibleService.getChapters(book);
  }

  @Public()
  @Get('search')
  search(@Query('q') q: string) {
    if (!q || q.trim().length < 2) return [];
    return this.bibleService.search(q);
  }

  @Public()
  @Get('classics')
  getClassics() {
    return this.bibleService.getClassicVerses();
  }

  @Public()
  @Get('quiz')
  getQuiz(@Query('count') count?: string) {
    return this.bibleService.getQuiz(Math.min(Math.max(Number(count) || 5, 3), 10));
  }
}
