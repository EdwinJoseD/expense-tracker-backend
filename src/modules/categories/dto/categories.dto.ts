import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsHexColor, IsInt, Min } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Comida' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Gastos de alimentación', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'restaurant', required: false })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ example: '#FF6B6B' })
  @IsHexColor()
  color: string;

  @ApiProperty({ example: 0, required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class CategoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  color: string;

  @ApiProperty()
  isSystem: boolean;

  @ApiProperty()
  orderIndex: number;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  createdAt: Date;
}

export class CategoryWithStatsDto extends CategoryResponseDto {
  @ApiProperty()
  totalExpenses: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  lastExpenseDate: Date;
}
