import { DataSource } from 'typeorm';
import { TenantOrm, PolicySetOrm, PolicyOrm, PrincipalOrm, ResourceOrm, AttributeOrm, AuditLogOrm } from './entities';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DB_URL,
  synchronize: false,
  entities: [TenantOrm, PolicySetOrm, PolicyOrm, PrincipalOrm, ResourceOrm, AttributeOrm, AuditLogOrm]
});
