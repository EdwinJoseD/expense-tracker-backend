import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsHexColor,
  Length,
  Min,
} from 'class-validator';
import { PaymentMethodType } from '../entities';

export class CreatePaymentMethodDto {
  @ApiProperty({ example: 'Tarjeta Débito Bancolombia' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'debit_card',
    enum: PaymentMethodType,
  })
  @IsEnum(PaymentMethodType)
  type: PaymentMethodType;

  @ApiProperty({ example: '1234', required: false })
  @IsString()
  @IsOptional()
  @Length(4, 4)
  lastFourDigits?: string;

  @ApiProperty({ example: 'Bancolombia', required: false })
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiProperty({ example: 'credit_card', required: false })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ example: '#6C5CE7', required: false })
  @IsHexColor()
  @IsOptional()
  color?: string;

  @ApiProperty({ example: 1000.5, required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  balance?: number;

  @ApiProperty({ example: 5000.0, required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  creditLimit?: number;

  @ApiProperty({ example: '2025-12-31', required: false })
  @IsDateString()
  @IsOptional()
  expirationDate?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdatePaymentMethodDto extends PartialType(
  CreatePaymentMethodDto,
) {
  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class PaymentMethodResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  type: PaymentMethodType;

  @ApiProperty()
  lastFourDigits: string;

  @ApiProperty()
  bankName: string;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  color: string;

  @ApiProperty()
  balance: number;

  @ApiProperty()
  creditLimit: number;

  @ApiProperty()
  expirationDate: Date;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isDefault: boolean;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  createdAt: Date;
}

export class PaymentMethodWithStatsDto extends PaymentMethodResponseDto {
  @ApiProperty()
  totalExpenses: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  availableCredit: number; // Solo para tarjetas de crédito
}
