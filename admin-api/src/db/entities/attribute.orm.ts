import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('attributes')
export class AttributeOrm {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column('text') entity_type!: 'principal'|'resource';
  @Column('text') entity_uid!: string; // Cedar UID
  @Column('text') key!: string;
  @Column('jsonb') value!: any;
  @UpdateDateColumn() updated_at!: Date;
}
