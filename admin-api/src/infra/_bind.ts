import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { PolicyRepo } from './repos/policy.repo';
import { TenantRepo } from './repos/tenant.repo';
import { EntityRepo } from './repos/entity.repo';
import { AuditRepo } from './audit/audit.repo';
import { DbModule } from '../db/db.module';  

import { PdpHttp } from './pdp/pdp.http';
import { RedisPubSub } from './redis/redis.pubsub';

import { PolicySetService } from '../core/policies/policy-set.service';

@Module({
  imports: [DbModule],  
  providers: [
    { provide: PolicyRepo, useFactory: (ds: DataSource) => new PolicyRepo(ds), inject: ['DATA_SOURCE'] },
    { provide: TenantRepo, useFactory: (ds: DataSource) => new TenantRepo(ds), inject: ['DATA_SOURCE'] },
    { provide: EntityRepo, useFactory: (ds: DataSource) => new EntityRepo(ds), inject: ['DATA_SOURCE'] },
    { provide: AuditRepo,  useFactory: (ds: DataSource) => new AuditRepo(ds),  inject: ['DATA_SOURCE'] },

    { provide: PdpHttp, useFactory: () => new PdpHttp() },
    { provide: RedisPubSub, useFactory: () => new RedisPubSub() },

    {
      provide: PolicySetService,
      useFactory: (ds: DataSource, repo: PolicyRepo, pdp: PdpHttp, pub: RedisPubSub) =>
        new PolicySetService(ds, repo, pdp, pub),
      inject: ['DATA_SOURCE', PolicyRepo, PdpHttp, RedisPubSub],
    },
  ],
  exports: [
    PolicyRepo,
    TenantRepo,
    EntityRepo,
    AuditRepo,
    PdpHttp,
    RedisPubSub,
    PolicySetService,
  ],
})
export class InfraModule {}
