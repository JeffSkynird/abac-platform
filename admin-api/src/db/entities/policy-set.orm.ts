import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
@Entity('policy_sets')
export class PolicySetOrm {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column('int') version!: number;
  @Column('text') status!: 'active'|'draft';
  @CreateDateColumn() created_at!: Date;
}
