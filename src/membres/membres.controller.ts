import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request } from '@nestjs/common';
import { AdminOnly, Roles } from '../auth/roles.decorator';
import { UpdateMembreDto, UpdateRoleDto, UpdateSettingsDto } from './dto/membres.dto';
import { MembresService } from './membres.service';

@Controller('membres')
export class MembresController {
  constructor(private membresService: MembresService) {}

  @Get()
  @AdminOnly()
  findAll(@Query('search') search?: string) {
    return this.membresService.findAll(search);
  }

  @Get('annuaire')
  @Roles('member', 'admin', 'super_admin')
  annuaire() {
    return this.membresService.findAnnuaire();
  }

  @Get('settings')
  @AdminOnly()
  getSettings() {
    return this.membresService.getSettings();
  }

  @Put('settings')
  @AdminOnly()
  updateSettings(@Body() dto: UpdateSettingsDto, @Request() req: any) {
    return this.membresService.updateSettings(dto, req.user.sub);
  }

  @Post('merge')
  @AdminOnly()
  mergeExistingBases() {
    return this.membresService.mergeExistingBases();
  }

  @Get(':id')
  @AdminOnly()
  findOne(@Param('id') id: string) {
    return this.membresService.findOne(id);
  }

  @Put(':id')
  @AdminOnly()
  update(@Param('id') id: string, @Body() dto: UpdateMembreDto) {
    return this.membresService.update(id, dto);
  }

  @Put(':id/role')
  @Roles('super_admin')
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.membresService.updateRole(id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  deactivate(@Param('id') id: string) {
    return this.membresService.deactivate(id);
  }
}
