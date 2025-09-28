import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DataSource } from 'typeorm';
import { EntityRepo } from '../infra/repos/entity.repo';

@UseGuards(RolesGuard)
@Controller('api')
export class EntitiesController {
  constructor(private ds: DataSource, private repo: EntityRepo) {}

  @Get('entities')
  @Roles('admin','ops')
  async list(@Query('tenantId') tenantId: string, @Query('type') type: 'principal'|'resource', @Query('page') page=1, @Query('limit') limit=20, @Req() req:any) {
    const qr = req.qr;
    const offset = (Number(page)-1)*Number(limit);
    const items = await this.repo.list(qr, tenantId, type, Number(limit), offset);
    return { items, page: Number(page), limit: Number(limit) };
  }

  @Post('entities')
  @Roles('admin')
  async upsert(@Body() body: any, @Req() req:any) {
    const qr = req.qr;
    const { tenantId, type, cedar_uid, attrs } = body;
    return this.repo.upsertEntity(qr, tenantId, type, cedar_uid, attrs);
  }

  @Put('entities/:type/:id')
  @Roles('admin')
  async update(
    @Param('type') type: 'principal'|'resource',
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Body() body: any,
    @Req() req: any
  ) {
    const qr = req.qr;
    const { cedar_uid, attrs } = body ?? {};
    const entity = await this.repo.updateEntity(qr, tenantId, type, id, { cedar_uid, attrs });
    if (!entity) {
      throw new NotFoundException('Entity not found');
    }
    return entity;
  }

  @Delete('entities/:type/:id')
  @Roles('admin')
  async remove(
    @Param('type') type: 'principal'|'resource',
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Req() req: any
  ) {
    const qr = req.qr;
    const deleted = await this.repo.deleteEntity(qr, tenantId, type, id);
    if (!deleted) {
      throw new NotFoundException('Entity not found');
    }
    return deleted;
  }

  
  @Get('entity-attributes')
  @Roles('admin','ops')
  async listAttrs(
    @Query('tenantId') tenantId: string,
    @Query('type') type: 'principal'|'resource',
    @Query('uid') uid: string | undefined,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Req() req: any
  ) {
    const qr = req.qr;
    const p = Math.max(1, Number(page));
    const l = Math.max(1, Math.min(200, Number(limit)));
    const items = await this.repo.listAttributes(qr, tenantId, type, uid, l, (p-1)*l);
    return { items, page: p, limit: l };
  }

  @Post('entity-attributes')
  @Roles('admin')
  async upsertAttr(@Body() body:any, @Req() req:any) {
    const qr = req.qr;
    const { tenantId, entity_type, entity_uid, key, value } = body;
    return this.repo.upsertAttribute(qr, tenantId, entity_type, entity_uid, key, value);
  }
}
