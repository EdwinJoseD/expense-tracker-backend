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
import { PaymentMethodsService } from '../services/payment-methods.service';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('payment-methods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo método de pago' })
  create(
    @CurrentUser() userId: string,
    @Body() createPaymentMethodDto: CreatePaymentMethodDto,
  ) {
    return this.paymentMethodsService.create(userId, createPaymentMethodDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los métodos de pago' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiQuery({ name: 'withStats', required: false, type: Boolean })
  findAll(
    @CurrentUser() userId: string,
    @Query('includeInactive') includeInactive?: boolean,
    @Query('withStats') withStats?: boolean,
  ) {
    if (withStats) {
      return this.paymentMethodsService.findAllWithStats(userId);
    }
    return this.paymentMethodsService.findAll(userId, includeInactive);
  }

  @Get('default')
  @ApiOperation({ summary: 'Obtener método de pago por defecto' })
  getDefault(@CurrentUser() userId: string) {
    return this.paymentMethodsService.getDefault(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener método de pago por ID' })
  findOne(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.paymentMethodsService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar método de pago' })
  update(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() updatePaymentMethodDto: UpdatePaymentMethodDto,
  ) {
    return this.paymentMethodsService.update(
      userId,
      id,
      updatePaymentMethodDto,
    );
  }

  @Patch(':id/set-default')
  @ApiOperation({ summary: 'Establecer como método de pago por defecto' })
  setDefault(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.paymentMethodsService.setDefault(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar método de pago' })
  remove(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.paymentMethodsService.remove(userId, id);
  }
}
