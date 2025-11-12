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
import { Category } from '../entities';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  /**
   * Crear categoría personalizada para el usuario
   */
  async create(
    userId: string,
    createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    // Verificar si ya existe una categoría con ese nombre para el usuario
    const existingCategory = await this.categoryRepository.findOne({
      where: {
        name: createCategoryDto.name,
        userId,
      },
    });

    if (existingCategory) {
      throw new ConflictException('Ya existe una categoría con ese nombre');
    }

    const category = this.categoryRepository.create({
      ...createCategoryDto,
      userId,
      isSystem: false,
    });

    const savedCategory = await this.categoryRepository.save(category);

    // Invalidar cache
    await this.cacheManager.del(`categories:${userId}`);

    return savedCategory;
  }

  /**
   * Obtener todas las categorías del usuario (incluyendo las del sistema)
   */
  async findAll(userId: string): Promise<Category[]> {
    // Intentar obtener del cache
    const cacheKey = `categories:${userId}`;
    const cached = await this.cacheManager.get<Category[]>(cacheKey);

    if (cached) {
      return cached;
    }

    // Si no está en cache, obtener de la BD
    const categories = await this.categoryRepository.find({
      where: [{ userId }, { isSystem: true }],
      order: { orderIndex: 'ASC', name: 'ASC' },
    });

    // Guardar en cache por 1 hora
    await this.cacheManager.set(cacheKey, categories, 3600000);

    return categories;
  }

  /**
   * Obtener una categoría por ID
   */
  async findOne(userId: string, id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: [
        { id, userId },
        { id, isSystem: true },
      ],
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return category;
  }

  /**
   * Actualizar categoría
   */
  async update(
    userId: string,
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOne(userId, id);

    // No permitir editar categorías del sistema
    if (category.isSystem) {
      throw new BadRequestException(
        'No se pueden editar las categorías del sistema',
      );
    }

    // Verificar que el usuario sea el propietario
    if (category.userId !== userId) {
      throw new BadRequestException(
        'No tienes permiso para editar esta categoría',
      );
    }

    // Si se actualiza el nombre, verificar que no exista otra con ese nombre
    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      const existingCategory = await this.categoryRepository.findOne({
        where: {
          name: updateCategoryDto.name,
          userId,
        },
      });

      if (existingCategory) {
        throw new ConflictException('Ya existe una categoría con ese nombre');
      }
    }

    Object.assign(category, updateCategoryDto);
    const updated = await this.categoryRepository.save(category);

    // Invalidar cache
    await this.cacheManager.del(`categories:${userId}`);

    return updated;
  }

  /**
   * Eliminar categoría
   */
  async remove(userId: string, id: string): Promise<void> {
    const category = await this.findOne(userId, id);

    // No permitir eliminar categorías del sistema
    if (category.isSystem) {
      throw new BadRequestException(
        'No se pueden eliminar las categorías del sistema',
      );
    }

    // Verificar que el usuario sea el propietario
    if (category.userId !== userId) {
      throw new BadRequestException(
        'No tienes permiso para eliminar esta categoría',
      );
    }

    // Verificar si tiene gastos asociados
    const hasExpenses = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoin('category.expenses', 'expense')
      .where('category.id = :id', { id })
      .getCount();

    if (hasExpenses > 0) {
      throw new BadRequestException(
        'No se puede eliminar una categoría que tiene gastos asociados',
      );
    }

    await this.categoryRepository.remove(category);

    // Invalidar cache
    await this.cacheManager.del(`categories:${userId}`);
  }

  /**
   * Obtener categorías con estadísticas de uso
   */
  async findAllWithStats(userId: string): Promise<any[]> {
    const categories = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect(
        'category.expenses',
        'expense',
        'expense.userId = :userId',
      )
      .where('category.userId = :userId OR category.isSystem = true', {
        userId,
      })
      .select([
        'category.id',
        'category.name',
        'category.description',
        'category.icon',
        'category.color',
        'category.isSystem',
        'category.orderIndex',
      ])
      .addSelect('COUNT(expense.id)', 'totalExpenses')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'totalAmount')
      .addSelect('MAX(expense.date)', 'lastExpenseDate')
      .groupBy('category.id')
      .orderBy('category.orderIndex', 'ASC')
      .addOrderBy('category.name', 'ASC')
      .getRawAndEntities();

    return categories.entities.map((entity, index) => ({
      ...entity,
      totalExpenses: parseInt(categories.raw[index].totalExpenses) || 0,
      totalAmount: parseFloat(categories.raw[index].totalAmount) || 0,
      lastExpenseDate: categories.raw[index].lastExpenseDate,
    }));
  }

  /**
   * Crear categorías por defecto del sistema
   */
  async createDefaultCategories(): Promise<void> {
    const defaultCategories = [
      { name: 'Comida', icon: 'restaurant', color: '#FF6B6B', orderIndex: 0 },
      {
        name: 'Transporte',
        icon: 'directions_car',
        color: '#4ECDC4',
        orderIndex: 1,
      },
      {
        name: 'Entretenimiento',
        icon: 'movie',
        color: '#FFA07A',
        orderIndex: 2,
      },
      {
        name: 'Compras',
        icon: 'shopping_cart',
        color: '#9B59B6',
        orderIndex: 3,
      },
      {
        name: 'Salud',
        icon: 'local_hospital',
        color: '#2ECC71',
        orderIndex: 4,
      },
      { name: 'Educación', icon: 'school', color: '#3498DB', orderIndex: 5 },
      { name: 'Servicios', icon: 'build', color: '#F39C12', orderIndex: 6 },
      { name: 'Otros', icon: 'more_horiz', color: '#95A5A6', orderIndex: 7 },
    ];

    for (const categoryData of defaultCategories) {
      const exists = await this.categoryRepository.findOne({
        where: { name: categoryData.name, isSystem: true },
      });

      if (!exists) {
        const category = this.categoryRepository.create({
          ...categoryData,
          isSystem: true,
          userId: undefined,
        });
        await this.categoryRepository.save(category);
      }
    }
  }

  /**
   * Reordenar categorías
   */
  async reorder(userId: string, categoryIds: string[]): Promise<void> {
    for (let i = 0; i < categoryIds.length; i++) {
      const category = await this.findOne(userId, categoryIds[i]);

      if (category.userId === userId) {
        category.orderIndex = i;
        await this.categoryRepository.save(category);
      }
    }

    // Invalidar cache
    await this.cacheManager.del(`categories:${userId}`);
  }
}
