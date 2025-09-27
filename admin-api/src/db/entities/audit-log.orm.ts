import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('audit_logs')
export class AuditLogOrm {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' }) id!: string;
  @Column('uuid') tenant_id!: string;
  @Column('text') principal!: string;
  @Column('text') resource!: string;
  @Column('text') action!: string;
  @Column('text') decision!: 'ALLOW'|'DENY';
  @Column('int', { nullable: true }) policy_set_version!: number | null;
  @Column('int') latency_ms!: number;
  @Column({ type: 'timestamptz' }) ts!: Date;
}
