import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PolicySetService } from '../core/policies/policy-set.service';

@UseGuards(RolesGuard)
@Controller('api')
export class PoliciesController {
  constructor(private svc: PolicySetService) {}

  @Post('policies')
  @Roles('admin')
  async add(@Body() body: any, @Req() req: any) {  
    const qr = req.qr;
    const { policySetId, cedar } = body;
    return this.svc.addPolicy(qr, policySetId, cedar);
  }
  
}
