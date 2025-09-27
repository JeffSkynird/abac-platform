import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('tenants')
export class TenantOrm {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('text') name!: string;
  @Column('text') status!: 'active'|'disabled';
  @CreateDateColumn() created_at!: Date;
}
