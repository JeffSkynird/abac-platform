import { Controller, Post, Get, Put, Delete, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PolicySetService } from '../core/policies/policy-set.service';

@UseGuards(RolesGuard)
@Controller('api')
export class PoliciesController {
  constructor(private svc: PolicySetService) {}

  @Get('policies')
  @Roles('admin')
  async list(@Query('policySetId') policySetId: string, @Req() req: any) {
    const qr = req.qr;
    return this.svc.listPolicies(qr, policySetId);
  }

  @Post('policies')
  @Roles('admin')
  async add(@Body() body: any, @Req() req: any) {  
    const qr = req.qr;
    const { policySetId, cedar } = body;
    return this.svc.addPolicy(qr, policySetId, cedar);
  }

  @Put('policies')
  @Roles('admin')
  async update(@Body() body: any, @Req() req: any) {
    const qr = req.qr;
    const { policyId, cedar, policySetId } = body;
    return this.svc.updatePolicy(qr, policyId, cedar, policySetId);
  }

  @Delete('policies/:id')
  @Roles('admin')
  async remove(
    @Param('id') policyId: string,
    @Query('policySetId') policySetId: string | undefined,
    @Req() req: any
  ) {
    const qr = req.qr;
    return this.svc.deletePolicy(qr, policyId, policySetId);
  }
  
}
