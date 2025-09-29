import { Controller, Post, Get, Param, Body, Query, UseGuards, UsePipes, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ZodValidationPipe } from '../common/zod-pipe';
import { CreateDraftDto, AddPolicyDto, TestDraftDto, TestActiveDto, PreValidatePoliciesDto, PreTestDraftDto } from './dtos/policy-set.dtos';
import { DataSource } from 'typeorm';
import { PolicySetService } from '../core/policies/policy-set.service';
import { PolicyRepo } from '../infra/repos/policy.repo';

@UseGuards(RolesGuard)
@Controller('api')
export class PolicySetsController {
  constructor(
    private ds: DataSource,
    private svc: PolicySetService,
    private repo: PolicyRepo
  ){}

  @Post('policy-sets')
  @Roles('admin')
  async createDraft(
    @Body(new ZodValidationPipe(CreateDraftDto)) dto: any,
    @Query('tenantId') qTenant?: string,
    @Req() req?: any   
  ) {
    const qr = req.qr;
    const tenantId = dto.tenantId ?? qTenant;
    return this.svc.createDraft(qr, tenantId, dto.baseVersion);
  }

  @Get('policy-sets')
  @Roles('admin','ops')
  async list(@Query('tenantId') tenantId: string, @Req() req: any) {
    const qr = req.qr;
    return this.repo.listPolicySetsByTenant(qr, tenantId);
  }

  @Post('policy-sets/:id/validate')
  @Roles('admin','ops')
  async validate(@Param('id') id: string, @Req() req: any) {
    const qr = req.qr;
    return this.svc.validatePostDraft(qr, id);
  }

  @Post('policy-sets/pre-validate')
  @Roles('admin','ops')
  @UsePipes(new ZodValidationPipe(PreValidatePoliciesDto))
  async preValidate(@Body() dto: any) {
    return this.svc.validatePreDraft(dto.policies);
  }

  @Post('policy-sets/:id/test')
  @Roles('admin','ops')
  async testDraft(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const qr = req.qr;
    return this.svc.testDraft(qr, id, {
      principal: body.principal,
      resource: body.resource,
      action: body.action,
      context: body.context
    });
  }

  @Post('policy-sets/:id/pre-test')
  @Roles('admin','ops')
  async preTestDraft(
    @Param('id') _id: string,
    @Body(new ZodValidationPipe(PreTestDraftDto)) dto: any
  ) {
    return this.svc.testPreDraft(dto.policies, {
      principal: dto.principal,
      resource: dto.resource,
      action: dto.action,
      context: dto.context
    });
  }

  @Post('policy-sets/test-active')
  @Roles('admin','ops')
  @UsePipes(new ZodValidationPipe(TestActiveDto))
  async testActive(@Body() dto: any, @Req() req: any) {
    const qr = req.qr;
    return this.svc.testActive(qr, dto.tenantId, dto);
  }

  @Post('policy-sets/:id/promote')
  @Roles('admin')
  async promote(@Param('id') id: string, @Req() req: any) {
    const qr = req.qr;
    return this.svc.promote(qr, id);
  }
}
