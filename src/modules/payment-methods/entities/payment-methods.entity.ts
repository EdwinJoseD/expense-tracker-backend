import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Expense } from '../../expenses/entities';

export enum PaymentMethodType {
  CASH = 'cash',
  DEBIT_CARD = 'debit_card',
  CREDIT_CARD = 'credit_card',
  TRANSFER = 'transfer',
  DIGITAL_WALLET = 'digital_wallet',
}

@Entity('payment_methods')
@Index(['userId', 'name'], { unique: true })
export class PaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: PaymentMethodType,
  })
  type: PaymentMethodType;

  @Column({ nullable: true })
  lastFourDigits: string; // Últimos 4 dígitos de tarjeta

  @Column({ nullable: true })
  bankName: string;

  @Column({ nullable: true })
  icon: string; // Icono personalizado

  @Column({ type: 'varchar', nullable: true })
  color: string; // Color hex

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance: number; // Balance actual (para efectivo o cuentas)

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  creditLimit: number; // Límite de crédito (solo para tarjetas de crédito)

  @Column({ type: 'date', nullable: true })
  expirationDate: Date; // Fecha de expiración (para tarjetas)

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean; // Método de pago por defecto

  @ManyToOne(() => User, (user) => user.paymentMethods, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @OneToMany(() => Expense, (expense) => expense.paymentMethod)
  expenses: Expense[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
