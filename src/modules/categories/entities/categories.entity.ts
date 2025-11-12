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
// import { Expense } from '../../expenses/entities/expense.entity';

@Entity('categories')
@Index(['userId', 'name'], { unique: true })
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  icon: string; // Nombre del icono (ej: 'shopping_cart', 'restaurant', etc.)

  @Column({ type: 'varchar' })
  color: string; // Color hex (ej: '#FF6B6B')

  @Column({ type: 'boolean', default: false })
  isSystem: boolean; // Categorías predeterminadas del sistema

  @Column({ type: 'int', default: 0 })
  orderIndex: number; // Para ordenar categorías

  @ManyToOne(() => User, (user) => user.categories, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  userId: string;

  //   @OneToMany(() => Expense, (expense) => expense.category)
  //   expenses: Expense[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
