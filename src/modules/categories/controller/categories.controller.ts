import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { CategoriesService } from '../services/categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva categoría personalizada' })
  create(
    @CurrentUser() userId: string,
    @Body() createCategoryDto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(userId, createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las categorías del usuario' })
  @ApiQuery({ name: 'withStats', required: false, type: Boolean })
  findAll(
    @CurrentUser() userId: string,
    @Query('withStats') withStats?: boolean,
  ) {
    if (withStats) {
      return this.categoriesService.findAllWithStats(userId);
    }
    return this.categoriesService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener categoría por ID' })
  findOne(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.categoriesService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar categoría' })
  update(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(userId, id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar categoría' })
  remove(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.categoriesService.remove(userId, id);
  }

  @Post('reorder')
  @ApiOperation({ summary: 'Reordenar categorías' })
  reorder(
    @CurrentUser() userId: string,
    @Body('categoryIds') categoryIds: string[],
  ) {
    return this.categoriesService.reorder(userId, categoryIds);
  }

  @Post('seed-defaults')
  @ApiOperation({
    summary: 'Crear categorías por defecto del sistema (solo admin)',
  })
  async seedDefaults() {
    await this.categoriesService.createDefaultCategories();
    return { message: 'Categorías por defecto creadas exitosamente' };
  }
}
