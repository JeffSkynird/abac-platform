import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AttributeOrm, AuditLogOrm, PolicyOrm, PolicySetOrm, PrincipalOrm, ResourceOrm, TenantOrm } from './entities';

const DataSourceProvider = {
  provide: 'DATA_SOURCE',
  useFactory: async () => {
    const ds = new DataSource({
      type: 'postgres',
      url: process.env.DB_URL,
      entities: [
            TenantOrm,
            PolicySetOrm,
            PolicyOrm,
            PrincipalOrm,
            ResourceOrm,
            AttributeOrm,
            AuditLogOrm,
          ],
      synchronize: false,
    });
    await ds.initialize();
    return ds;
  },
};

@Module({
  providers: [
    DataSourceProvider,
    { provide: DataSource, useExisting: 'DATA_SOURCE' },
  ],
  exports: ['DATA_SOURCE', DataSource],
})
export class DbModule {}
