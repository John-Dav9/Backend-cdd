import { Body, Controller, Delete, Get, Param, Post, Put, Request } from '@nestjs/common';
import { UpdateMembreDto, UpdateRoleDto, UpdateSettingsDto } from './dto/membres.dto';
import { MembresService } from './membres.service';

@Controller('membres')
export class MembresController {
  constructor(private membresService: MembresService) {}

  @Get()
  findAll() {
    return this.membresService.findAll();
  }

  @Get('settings')
  getSettings() {
    return this.membresService.getSettings();
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdateSettingsDto, @Request() req: any) {
    return this.membresService.updateSettings(dto, req.user.sub);
  }

  @Post('merge')
  mergeExistingBases() {
    return this.membresService.mergeExistingBases();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.membresService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMembreDto) {
    return this.membresService.update(id, dto);
  }

  @Put(':id/role')
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.membresService.updateRole(id, dto);
  }

  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.membresService.deactivate(id);
  }
}
