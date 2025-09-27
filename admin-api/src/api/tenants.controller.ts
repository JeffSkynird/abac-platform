import { Controller, Post, Get, Body, Query, UseGuards, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantRepo } from '../infra/repos/tenant.repo';

@UseGuards(RolesGuard)
@Controller('api')
export class TenantsController {
  constructor(private tenants: TenantRepo) {}

  @Post('tenants')
  @Roles('admin')
  async create(@Body() body: any, @Req() req: any) {
    const qr = req.qr;
    const { name, status='active' } = body;
    return this.tenants.create(qr, name, status);
  }

  @Get('tenants')
  @Roles('admin','ops')
  async list(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Req() req: any
  ) {
    const qr = req.qr;
    const p = Number(page);
    const l = Number(limit);
    const items = await this.tenants.list(qr, l, (p - 1) * l);
    return { items, page: p, limit: l };
  }
}
