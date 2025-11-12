import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PaymentMethod } from '../entities';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from '../dto';

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  /**
   * Crear nuevo método de pago
   */
  async create(
    userId: string,
    createPaymentMethodDto: CreatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    // Verificar si ya existe uno con ese nombre
    const existing = await this.paymentMethodRepository.findOne({
      where: {
        name: createPaymentMethodDto.name,
        userId,
      },
    });

    if (existing) {
      throw new ConflictException('Ya existe un método de pago con ese nombre');
    }

    // Si se marca como default, quitar el default de otros
    if (createPaymentMethodDto.isDefault) {
      await this.paymentMethodRepository.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    }

    const paymentMethod = this.paymentMethodRepository.create({
      ...createPaymentMethodDto,
      userId,
    });

    const saved = await this.paymentMethodRepository.save(paymentMethod);

    // Invalidar cache
    await this.cacheManager.del(`payment-methods:${userId}`);

    return saved;
  }

  /**
   * Obtener todos los métodos de pago del usuario
   */
  async findAll(
    userId: string,
    includeInactive = false,
  ): Promise<PaymentMethod[]> {
    const cacheKey = `payment-methods:${userId}:${includeInactive}`;
    const cached = await this.cacheManager.get<PaymentMethod[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const whereConditions: any = { userId };
    if (!includeInactive) {
      whereConditions.isActive = true;
    }

    const paymentMethods = await this.paymentMethodRepository.find({
      where: whereConditions,
      order: { isDefault: 'DESC', name: 'ASC' },
    });

    // Cachear por 30 minutos
    await this.cacheManager.set(cacheKey, paymentMethods, 1800000);

    return paymentMethods;
  }

  /**
   * Obtener un método de pago por ID
   */
  async findOne(userId: string, id: string): Promise<PaymentMethod> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id, userId },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Método de pago no encontrado');
    }

    return paymentMethod;
  }

  /**
   * Actualizar método de pago
   */
  async update(
    userId: string,
    id: string,
    updatePaymentMethodDto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    const paymentMethod = await this.findOne(userId, id);

    // Verificar nombre duplicado
    if (
      updatePaymentMethodDto.name &&
      updatePaymentMethodDto.name !== paymentMethod.name
    ) {
      const existing = await this.paymentMethodRepository.findOne({
        where: {
          name: updatePaymentMethodDto.name,
          userId,
        },
      });

      if (existing) {
        throw new ConflictException(
          'Ya existe un método de pago con ese nombre',
        );
      }
    }

    // Si se marca como default, quitar el default de otros
    if (updatePaymentMethodDto.isDefault) {
      await this.paymentMethodRepository.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    }

    Object.assign(paymentMethod, updatePaymentMethodDto);
    const updated = await this.paymentMethodRepository.save(paymentMethod);

    // Invalidar cache
    await this.cacheManager.del(`payment-methods:${userId}:true`);
    await this.cacheManager.del(`payment-methods:${userId}:false`);

    return updated;
  }

  /**
   * Eliminar método de pago
   */
  async remove(userId: string, id: string): Promise<void> {
    const paymentMethod = await this.findOne(userId, id);

    // Verificar si tiene gastos asociados
    const hasExpenses = await this.paymentMethodRepository
      .createQueryBuilder('pm')
      .leftJoin('pm.expenses', 'expense')
      .where('pm.id = :id', { id })
      .getCount();

    if (hasExpenses > 0) {
      throw new BadRequestException(
        'No se puede eliminar un método de pago que tiene gastos asociados',
      );
    }

    await this.paymentMethodRepository.remove(paymentMethod);

    // Invalidar cache
    await this.cacheManager.del(`payment-methods:${userId}:true`);
    await this.cacheManager.del(`payment-methods:${userId}:false`);
  }

  /**
   * Obtener método de pago por defecto
   */
  async getDefault(userId: string): Promise<PaymentMethod | null> {
    return await this.paymentMethodRepository.findOne({
      where: { userId, isDefault: true, isActive: true },
    });
  }

  /**
   * Establecer método de pago por defecto
   */
  async setDefault(userId: string, id: string): Promise<PaymentMethod> {
    const paymentMethod = await this.findOne(userId, id);

    // Quitar default de todos
    await this.paymentMethodRepository.update(
      { userId, isDefault: true },
      { isDefault: false },
    );

    // Establecer el nuevo default
    paymentMethod.isDefault = true;
    const updated = await this.paymentMethodRepository.save(paymentMethod);

    // Invalidar cache
    await this.cacheManager.del(`payment-methods:${userId}:true`);
    await this.cacheManager.del(`payment-methods:${userId}:false`);

    return updated;
  }

  /**
   * Obtener métodos de pago con estadísticas
   */
  async findAllWithStats(userId: string): Promise<any[]> {
    const paymentMethods = await this.paymentMethodRepository
      .createQueryBuilder('pm')
      .leftJoinAndSelect('pm.expenses', 'expense')
      .where('pm.userId = :userId', { userId })
      .select([
        'pm.id',
        'pm.name',
        'pm.type',
        'pm.lastFourDigits',
        'pm.bankName',
        'pm.icon',
        'pm.color',
        'pm.balance',
        'pm.creditLimit',
        'pm.isActive',
        'pm.isDefault',
      ])
      .addSelect('COUNT(expense.id)', 'totalExpenses')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'totalAmount')
      .groupBy('pm.id')
      .orderBy('pm.isDefault', 'DESC')
      .addOrderBy('pm.name', 'ASC')
      .getRawAndEntities();

    return paymentMethods.entities.map((entity, index) => {
      const totalAmount =
        parseFloat(paymentMethods.raw[index].totalAmount) || 0;
      const availableCredit =
        entity.type === 'credit_card' && entity.creditLimit
          ? entity.creditLimit - totalAmount
          : null;

      return {
        ...entity,
        totalExpenses: parseInt(paymentMethods.raw[index].totalExpenses) || 0,
        totalAmount,
        availableCredit,
      };
    });
  }

  /**
   * Actualizar balance de un método de pago
   */
  async updateBalance(
    userId: string,
    id: string,
    amount: number,
    operation: 'add' | 'subtract',
  ): Promise<PaymentMethod> {
    const paymentMethod = await this.findOne(userId, id);

    if (operation === 'add') {
      paymentMethod.balance = Number(paymentMethod.balance) + amount;
    } else {
      paymentMethod.balance = Number(paymentMethod.balance) - amount;
    }

    return await this.paymentMethodRepository.save(paymentMethod);
  }
}
