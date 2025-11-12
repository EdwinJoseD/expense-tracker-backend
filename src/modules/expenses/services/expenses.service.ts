import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Expense, ExpenseSource } from '../entities';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  ExpenseQueryDto,
  ExpenseSummaryDto,
} from '../dto';
import { CategoriesService } from '../../categories/services/categories.service';
import { PaymentMethodsService } from '../../payment-methods/services/payment-methods.service';
import { StorageService } from '../../storage/services/storage.service';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly categoriesService: CategoriesService,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly storageService: StorageService,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  /**
   * Crear gasto manual
   */
  async create(
    userId: string,
    createExpenseDto: CreateExpenseDto,
  ): Promise<Expense> {
    // Validar que la categoría existe y pertenece al usuario
    await this.categoriesService.findOne(userId, createExpenseDto.categoryId);

    // Validar que el método de pago existe y pertenece al usuario
    await this.paymentMethodsService.findOne(
      userId,
      createExpenseDto.paymentMethodId,
    );

    const expense = this.expenseRepository.create({
      ...createExpenseDto,
      userId,
      source: ExpenseSource.MANUAL,
    });

    const saved = await this.expenseRepository.save(expense);

    // Actualizar balance del método de pago
    await this.paymentMethodsService.updateBalance(
      userId,
      createExpenseDto.paymentMethodId,
      Number(createExpenseDto.amount),
      'subtract',
    );

    // Invalidar cache
    await this.invalidateCache(userId);

    return saved;
  }

  /**
   * Crear gasto desde OCR (factura escaneada)
   */
  async createFromOcr(
    userId: string,
    data: {
      amount: number;
      description: string;
      date: Date;
      paymentMethodId: string;
      categoryId: string;
      ocrData: any;
      receiptImage: Express.Multer.File;
    },
  ): Promise<Expense> {
    // Validar categoría y método de pago
    await this.categoriesService.findOne(userId, data.categoryId);
    await this.paymentMethodsService.findOne(userId, data.paymentMethodId);

    // Subir imagen de factura a S3
    const uploadResult = await this.storageService.uploadReceipt(
      data.receiptImage,
      userId,
    );

    // Crear gasto
    const expense = this.expenseRepository.create({
      userId,
      amount: data.amount,
      description: data.description,
      date: data.date,
      categoryId: data.categoryId,
      paymentMethodId: data.paymentMethodId,
      source: ExpenseSource.OCR,
      receiptUrl: uploadResult.url,
      receiptS3Key: uploadResult.key,
      ocrData: data.ocrData,
    });

    const saved = await this.expenseRepository.save(expense);

    // Actualizar balance
    await this.paymentMethodsService.updateBalance(
      userId,
      data.paymentMethodId,
      Number(data.amount),
      'subtract',
    );

    await this.invalidateCache(userId);

    return saved;
  }

  /**
   * Crear gasto desde voz
   */
  async createFromVoice(
    userId: string,
    data: {
      amount: number;
      description: string;
      date: Date;
      paymentMethodId: string;
      categoryId: string;
      transcription: string;
      audioFile?: Express.Multer.File;
    },
  ): Promise<Expense> {
    // Validar categoría y método de pago
    await this.categoriesService.findOne(userId, data.categoryId);
    await this.paymentMethodsService.findOne(userId, data.paymentMethodId);

    let audioUrl: string;
    let audioS3Key: string;

    // Subir audio si se proporciona
    if (data.audioFile) {
      const uploadResult = await this.storageService.uploadVoiceRecording(
        data.audioFile,
        userId,
      );
      audioUrl = uploadResult.url;
      audioS3Key = uploadResult.key;
    }

    // Crear gasto
    const expense = this.expenseRepository.create({
      userId,
      amount: data.amount,
      description: data.description,
      date: data.date,
      categoryId: data.categoryId,
      paymentMethodId: data.paymentMethodId,
      source: ExpenseSource.VOICE,
      voiceTranscription: data.transcription,
      voiceAudioUrl: audioUrl!,
      voiceAudioS3Key: audioS3Key!,
    });

    const saved = await this.expenseRepository.save(expense);

    // Actualizar balance
    await this.paymentMethodsService.updateBalance(
      userId,
      data.paymentMethodId,
      Number(data.amount),
      'subtract',
    );

    await this.invalidateCache(userId);

    return saved;
  }

  /**
   * Obtener gastos con filtros y paginación
   */
  async findAll(userId: string, query: ExpenseQueryDto) {
    const {
      startDate,
      endDate,
      categoryId,
      paymentMethodId,
      page = 1,
      limit = 20,
      sortBy = 'date',
      sortOrder = 'DESC',
    } = query;

    const skip = (page - 1) * limit;

    // Construir where conditions
    const where: FindOptionsWhere<Expense> = { userId };

    if (startDate && endDate) {
      where.date = Between(new Date(startDate), new Date(endDate));
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (paymentMethodId) {
      where.paymentMethodId = paymentMethodId;
    }

    // Ejecutar query
    const [expenses, total] = await this.expenseRepository.findAndCount({
      where,
      relations: ['category', 'paymentMethod'],
      order: { [sortBy]: sortOrder },
      skip,
      take: limit,
    });

    return {
      data: expenses,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener un gasto por ID
   */
  async findOne(userId: string, id: string): Promise<Expense> {
    const expense = await this.expenseRepository.findOne({
      where: { id, userId },
      relations: ['category', 'paymentMethod'],
    });

    if (!expense) {
      throw new NotFoundException('Gasto no encontrado');
    }

    return expense;
  }

  /**
   * Actualizar gasto
   */
  async update(
    userId: string,
    id: string,
    updateExpenseDto: UpdateExpenseDto,
  ): Promise<Expense> {
    const expense = await this.findOne(userId, id);
    const oldAmount = Number(expense.amount);
    const oldPaymentMethodId = expense.paymentMethodId;

    // Si cambia la categoría, validarla
    if (updateExpenseDto.categoryId) {
      await this.categoriesService.findOne(userId, updateExpenseDto.categoryId);
    }

    // Si cambia el método de pago, validarlo
    if (updateExpenseDto.paymentMethodId) {
      await this.paymentMethodsService.findOne(
        userId,
        updateExpenseDto.paymentMethodId,
      );
    }

    Object.assign(expense, updateExpenseDto);
    const updated = await this.expenseRepository.save(expense);

    // Ajustar balances si cambiaron el monto o método de pago
    const newAmount = Number(updated.amount);
    const newPaymentMethodId = updated.paymentMethodId;

    if (oldAmount !== newAmount || oldPaymentMethodId !== newPaymentMethodId) {
      // Devolver el monto anterior al método de pago anterior
      await this.paymentMethodsService.updateBalance(
        userId,
        oldPaymentMethodId,
        oldAmount,
        'add',
      );

      // Restar el nuevo monto del nuevo método de pago
      await this.paymentMethodsService.updateBalance(
        userId,
        newPaymentMethodId,
        newAmount,
        'subtract',
      );
    }

    await this.invalidateCache(userId);

    return updated;
  }

  /**
   * Eliminar gasto
   */
  async remove(userId: string, id: string): Promise<void> {
    const expense = await this.findOne(userId, id);

    // Devolver el monto al balance
    await this.paymentMethodsService.updateBalance(
      userId,
      expense.paymentMethodId,
      Number(expense.amount),
      'add',
    );

    // Eliminar archivos asociados de S3
    if (expense.receiptS3Key) {
      await this.storageService.deleteFile(expense.receiptS3Key);
    }

    if (expense.voiceAudioS3Key) {
      await this.storageService.deleteFile(expense.voiceAudioS3Key);
    }

    await this.expenseRepository.remove(expense);
    await this.invalidateCache(userId);
  }

  /**
   * Obtener resumen de gastos
   */
  async getSummary(userId: string): Promise<ExpenseSummaryDto> {
    const cacheKey = `expenses:summary:${userId}`;
    const cached = await this.cacheManager.get<ExpenseSummaryDto>(cacheKey);

    if (cached) {
      return cached;
    }

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // Total general
    const totalQuery = await this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.userId = :userId', { userId })
      .select('COUNT(*)', 'count')
      .addSelect('SUM(expense.amount)', 'total')
      .addSelect('AVG(expense.amount)', 'average')
      .getRawOne();

    // Mes actual
    const currentMonthTotal = await this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.userId = :userId', { userId })
      .andWhere('expense.date BETWEEN :start AND :end', {
        start: currentMonthStart,
        end: currentMonthEnd,
      })
      .select('SUM(expense.amount)', 'total')
      .getRawOne();

    // Mes pasado
    const lastMonthTotal = await this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.userId = :userId', { userId })
      .andWhere('expense.date BETWEEN :start AND :end', {
        start: lastMonthStart,
        end: lastMonthEnd,
      })
      .select('SUM(expense.amount)', 'total')
      .getRawOne();

    // Por categoría
    const byCategory = await this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.category', 'category')
      .where('expense.userId = :userId', { userId })
      .select([
        'category.id as categoryId',
        'category.name as categoryName',
        'category.color as categoryColor',
        'COUNT(expense.id) as count',
        'SUM(expense.amount) as total',
      ])
      .groupBy('category.id')
      .orderBy('total', 'DESC')
      .getRawMany();

    // Por método de pago
    const byPaymentMethod = await this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.paymentMethod', 'pm')
      .where('expense.userId = :userId', { userId })
      .select([
        'pm.id as paymentMethodId',
        'pm.name as paymentMethodName',
        'COUNT(expense.id) as count',
        'SUM(expense.amount) as total',
      ])
      .groupBy('pm.id')
      .orderBy('total', 'DESC')
      .getRawMany();

    const totalAmount = parseFloat(totalQuery.total) || 0;
    const currentMonth = parseFloat(currentMonthTotal.total) || 0;
    const lastMonth = parseFloat(lastMonthTotal.total) || 0;

    const percentageChange =
      lastMonth > 0 ? ((currentMonth - lastMonth) / lastMonth) * 100 : 0;

    const summary: ExpenseSummaryDto = {
      totalExpenses: parseInt(totalQuery.count) || 0,
      totalAmount,
      averageExpense: parseFloat(totalQuery.average) || 0,
      currentMonthTotal: currentMonth,
      lastMonthTotal: lastMonth,
      percentageChange,
      byCategory: byCategory.map((cat) => ({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        categoryColor: cat.categoryColor,
        count: parseInt(cat.count),
        total: parseFloat(cat.total),
        percentage: (parseFloat(cat.total) / totalAmount) * 100,
      })),
      byPaymentMethod: byPaymentMethod.map((pm) => ({
        paymentMethodId: pm.paymentMethodId,
        paymentMethodName: pm.paymentMethodName,
        count: parseInt(pm.count),
        total: parseFloat(pm.total),
        percentage: (parseFloat(pm.total) / totalAmount) * 100,
      })),
    };

    // Cachear por 5 minutos
    await this.cacheManager.set(cacheKey, summary, 300000);

    return summary;
  }

  /**
   * Sugerir categoría basada en descripción usando IA
   */
  async suggestCategory(userId: string, description: string): Promise<string> {
    // Obtener todas las categorías del usuario
    const categories = await this.categoriesService.findAll(userId);

    // Por ahora, retornar la categoría "Otros" por defecto
    // TODO: Implementar ML para sugerencias inteligentes
    const othersCategory = categories.find((cat) => cat.name === 'Otros');
    return othersCategory?.id || categories[0]?.id;
  }

  /**
   * Sugerir categoría desde hint de voz
   */
  async suggestCategoryFromHint(
    userId: string,
    hint?: string,
  ): Promise<string> {
    if (!hint) {
      return this.suggestCategory(userId, '');
    }

    const categories = await this.categoriesService.findAll(userId);

    // Mapeo simple de hints a categorías
    const categoryMap: Record<string, string> = {
      comida: 'Comida',
      transporte: 'Transporte',
      entretenimiento: 'Entretenimiento',
      salud: 'Salud',
      educacion: 'Educación',
      compras: 'Compras',
      servicios: 'Servicios',
    };

    const categoryName = categoryMap[hint.toLowerCase()];
    if (categoryName) {
      const category = categories.find((cat) => cat.name === categoryName);
      if (category) {
        return category.id;
      }
    }

    return this.suggestCategory(userId, '');
  }

  /**
   * Invalidar cache del usuario
   */
  private async invalidateCache(userId: string): Promise<void> {
    await this.cacheManager.del(`expenses:summary:${userId}`);
  }
}
