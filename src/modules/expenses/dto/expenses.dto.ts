import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ example: 125.5 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'Compras en supermercado' })
  @IsString()
  @MaxLength(200)
  description: string;

  @ApiProperty({ example: 'Compras mensuales de alimentos', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ example: '2024-11-08' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'uuid-category' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 'uuid-payment-method' })
  @IsUUID()
  paymentMethodId: string;
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}

export class ExpenseQueryDto {
  @ApiProperty({ required: false, example: '2024-01-01' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ required: false, example: '2024-12-31' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ required: false, example: 'uuid-category' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ required: false, example: 'uuid-payment-method' })
  @IsUUID()
  @IsOptional()
  paymentMethodId?: string;

  @ApiProperty({ required: false, example: 1, minimum: 1 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, example: 20, minimum: 1, maximum: 100 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    required: false,
    example: 'date',
    enum: ['date', 'amount', 'createdAt'],
  })
  @IsString()
  @IsOptional()
  sortBy?: 'date' | 'amount' | 'createdAt' = 'date';

  @ApiProperty({ required: false, example: 'DESC', enum: ['ASC', 'DESC'] })
  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class ExpenseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  description: string;

  @ApiProperty()
  notes: string;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  source: string;

  @ApiProperty()
  receiptUrl: string;

  @ApiProperty()
  voiceTranscription: string;

  @ApiProperty()
  category: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };

  @ApiProperty()
  paymentMethod: {
    id: string;
    name: string;
    type: string;
    icon: string;
    color: string;
  };

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ExpenseSummaryDto {
  @ApiProperty()
  totalExpenses: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  averageExpense: number;

  @ApiProperty()
  currentMonthTotal: number;

  @ApiProperty()
  lastMonthTotal: number;

  @ApiProperty()
  percentageChange: number;

  @ApiProperty()
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    categoryColor: string;
    count: number;
    total: number;
    percentage: number;
  }>;

  @ApiProperty()
  byPaymentMethod: Array<{
    paymentMethodId: string;
    paymentMethodName: string;
    count: number;
    total: number;
    percentage: number;
  }>;
}

export class CreateExpenseFromOcrDto {
  @ApiProperty({ example: 125.5 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'Compras en supermercado' })
  @IsString()
  description: string;

  @ApiProperty({ example: '2024-11-08' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'uuid-payment-method' })
  @IsUUID()
  paymentMethodId: string;

  @ApiProperty({ example: 'uuid-category' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ type: Object, required: false })
  @IsOptional()
  ocrData?: any;
}

export class CreateExpenseFromVoiceDto {
  @ApiProperty({ example: 125.5 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'Compras en supermercado' })
  @IsString()
  description: string;

  @ApiProperty({ example: '2024-11-08' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'uuid-payment-method' })
  @IsUUID()
  paymentMethodId: string;

  @ApiProperty({ example: 'uuid-category' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 'Gasté cincuenta mil pesos en el supermercado' })
  @IsString()
  transcription: string;
}
