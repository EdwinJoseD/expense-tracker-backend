import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Get,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiOperation,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OcrService } from '../services/ocr.service';

@ApiTags('ocr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('process-receipt')
  @ApiOperation({
    summary: 'Procesar imagen de factura con OCR',
    description:
      'Extrae información de una factura: monto, descripción, comercio, fecha, items, etc.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Imagen de la factura (JPG, PNG, WEBP)',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async processReceipt(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    // Validar que sea una imagen
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'El archivo debe ser una imagen (JPG, PNG, WEBP)',
      );
    }

    // Validar tamaño (máximo 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('El archivo no debe superar los 10MB');
    }

    const result = await this.ocrService.processReceipt(file.buffer);

    return {
      success: true,
      data: result,
      message: 'Factura procesada exitosamente',
    };
  }

  @Get('available-services')
  @ApiOperation({ summary: 'Obtener servicios de OCR disponibles' })
  getAvailableServices() {
    return {
      services: this.ocrService.getAvailableServices(),
    };
  }
}
