import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('principals')
export class PrincipalOrm {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column('text') cedar_uid!: string; // e.g. User::"123"
  @Column('jsonb', { default: () => `'{}'::jsonb` }) attrs!: Record<string, any>;
  @CreateDateColumn() created_at!: Date;
}
