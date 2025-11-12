import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Category } from '../../../categories/entities/category.entity';
import { PaymentMethod } from '../../payment-methods/entities/payment-method.entity';

export enum ExpenseSource {
  MANUAL = 'manual',
  VOICE = 'voice',
  OCR = 'ocr',
}

@Entity('expenses')
@Index(['userId', 'date'])
@Index(['userId', 'categoryId'])
@Index(['userId', 'paymentMethodId'])
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column()
  description: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({
    type: 'enum',
    enum: ExpenseSource,
    default: ExpenseSource.MANUAL,
  })
  source: ExpenseSource;

  @Column({ type: 'varchar', nullable: true })
  receiptUrl: string; // URL pública de la factura

  @Column({ type: 'varchar', nullable: true })
  receiptS3Key: string; // Key de S3 para eliminar después

  @Column({ type: 'jsonb', nullable: true })
  ocrData: any; // Datos completos extraídos del OCR

  @Column({ type: 'varchar', nullable: true })
  voiceTranscription: string; // Transcripción del audio

  @Column({ type: 'varchar', nullable: true })
  voiceAudioUrl: string; // URL del audio

  @Column({ type: 'varchar', nullable: true })
  voiceAudioS3Key: string; // Key de S3 del audio

  @ManyToOne(() => User, (user) => user.expenses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Category, (category) => category.expenses, { eager: true })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column()
  categoryId: string;

  @ManyToOne(() => PaymentMethod, (paymentMethod) => paymentMethod.expenses, {
    eager: true,
  })
  @JoinColumn({ name: 'paymentMethodId' })
  paymentMethod: PaymentMethod;

  @Column()
  paymentMethodId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
