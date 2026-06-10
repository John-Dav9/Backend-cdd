import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { AdminOnly } from '../auth/roles.decorator';
import { CreateMessageDto, MessagesService } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Public()
  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Admin — avant :id pour éviter le conflit de route
  @Get('admin/all')
  @AdminOnly()
  findAllAdmin() {
    return this.service.findAllAdmin();
  }

  @Post()
  @AdminOnly()
  create(@Body() dto: CreateMessageDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @AdminOnly()
  update(@Param('id') id: string, @Body() dto: Partial<CreateMessageDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
