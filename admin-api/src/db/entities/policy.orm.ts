import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
@Entity('policies')
export class PolicyOrm {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') policy_set_id!: string;
  @Column('text') cedar!: string;
  @CreateDateColumn() created_at!: Date;
}
