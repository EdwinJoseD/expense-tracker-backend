import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ExpensesService } from '../services/expenses.service';
import { OcrService } from '../../ocr/services/ocr.service';
import { VoiceService } from '../../voice/services/voice.service';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseQueryDto } from '../dto';

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly ocrService: OcrService,
    private readonly voiceService: VoiceService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear gasto manualmente' })
  async create(@CurrentUser() userId: string, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(userId, dto);
  }

  @Post('ocr')
  @ApiOperation({ summary: 'Crear gasto escaneando factura (OCR)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Imagen de la factura',
        },
        paymentMethodId: {
          type: 'string',
          description: 'ID del método de pago',
        },
        categoryId: {
          type: 'string',
          nullable: true,
          description: 'ID de categoría (opcional, se auto-detecta)',
        },
      },
      required: ['file', 'paymentMethodId'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async createFromReceipt(
    @CurrentUser() userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('paymentMethodId') paymentMethodId: string,
    @Body('categoryId') categoryId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Debe proporcionar una imagen');
    }

    if (!paymentMethodId) {
      throw new BadRequestException('Debe proporcionar un método de pago');
    }

    // Procesar imagen con OCR
    const ocrResult = await this.ocrService.processReceipt(file.buffer);

    // Si no se proporciona categoría, intentar inferirla
    const finalCategoryId =
      categoryId ||
      (await this.expensesService.suggestCategory(
        userId,
        ocrResult.description,
      ));

    // Crear el gasto
    return this.expensesService.createFromOcr(userId, {
      amount: ocrResult.amount,
      description: ocrResult.description,
      date: ocrResult.date ? new Date(ocrResult.date) : new Date(),
      paymentMethodId,
      categoryId: finalCategoryId,
      ocrData: ocrResult,
      receiptImage: file,
    });
  }

  @Post('voice')
  @ApiOperation({ summary: 'Crear gasto por voz' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo de audio con el gasto',
        },
        paymentMethodId: {
          type: 'string',
          description: 'ID del método de pago',
        },
        categoryId: {
          type: 'string',
          nullable: true,
          description: 'ID de categoría (opcional, se auto-detecta)',
        },
      },
      required: ['file', 'paymentMethodId'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async createFromVoice(
    @CurrentUser() userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('paymentMethodId') paymentMethodId: string,
    @Body('categoryId') categoryId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Debe proporcionar un archivo de audio');
    }

    if (!paymentMethodId) {
      throw new BadRequestException('Debe proporcionar un método de pago');
    }

    // Procesar audio
    const voiceResult = await this.voiceService.processVoice(
      file.buffer,
      file.originalname,
    );

    // Si no se proporciona categoría, intentar inferirla del hint
    const finalCategoryId =
      categoryId ||
      (await this.expensesService.suggestCategoryFromHint(
        userId,
        voiceResult.categoryHint,
      ));

    // Crear el gasto
    return this.expensesService.createFromVoice(userId, {
      amount: voiceResult.amount,
      description: voiceResult.description,
      date: new Date(),
      paymentMethodId,
      categoryId: finalCategoryId,
      transcription: voiceResult.transcription,
      audioFile: file,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener todos los gastos con filtros y paginación',
  })
  async findAll(
    @CurrentUser() userId: string,
    @Query() query: ExpenseQueryDto,
  ) {
    return this.expensesService.findAll(userId, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Obtener resumen de gastos' })
  async getSummary(@CurrentUser() userId: string) {
    return this.expensesService.getSummary(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener gasto por ID' })
  async findOne(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.expensesService.findOne(userId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar gasto' })
  async update(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar gasto' })
  async remove(@CurrentUser() userId: string, @Param('id') id: string) {
    await this.expensesService.remove(userId, id);
    return { message: 'Gasto eliminado exitosamente' };
  }
}
