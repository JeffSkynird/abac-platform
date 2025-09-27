import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditRepo } from '../infra/audit/audit.repo';

@UseGuards(RolesGuard)
@Controller('api')
export class AuditController {
  constructor(private audit: AuditRepo) {}

  @Get('audit')
  @Roles('admin','ops')
  async list(@Query('tenantId') tenantId: string, @Query('page') page=1, @Query('limit') limit=50, @Req() req:any) {
    const qr = req.qr;
    const offset = (Number(page)-1)*Number(limit);
    const items = await this.audit.list(qr, tenantId, Number(limit), offset);
    return { items, page: Number(page), limit: Number(limit) };
  }
}
