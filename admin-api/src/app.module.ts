import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { HealthController } from './health.controller';
import { TenantsController } from './api/tenants.controller';
import { PolicySetsController } from './api/policy-sets.controller';
import { PoliciesController } from './api/policies.controller';
import { EntitiesController } from './api/entities.controller';
import { AuditController } from './api/audit.controller';
import { InfraModule } from './infra/_bind';            
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantInterceptor } from './common/tenant.interceptor';
import { DataSource } from 'typeorm';

@Module({
  imports: [ConfigModule, AuthModule, DbModule, InfraModule, ],
  controllers: [
    HealthController,
    TenantsController,
    PolicySetsController,
    PoliciesController,
    EntitiesController,
    AuditController
  ],
  providers: [
    {
    provide: APP_INTERCEPTOR,
    useFactory: (ds: DataSource) => new TenantInterceptor(ds),
    inject: ['DATA_SOURCE']
  }
  ]
})
export class AppModule {}
