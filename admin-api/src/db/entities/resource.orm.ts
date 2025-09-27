import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('resources')
export class ResourceOrm {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column('text') cedar_uid!: string; // e.g. Document::"abc"
  @Column('jsonb', { default: () => `'{}'::jsonb` }) attrs!: Record<string, any>;
  @CreateDateColumn() created_at!: Date;
}
