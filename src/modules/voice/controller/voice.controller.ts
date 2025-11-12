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
import { VoiceService } from '../services/voice.service';

@ApiTags('voice')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('process-audio')
  @ApiOperation({
    summary: 'Procesar audio para extraer información de gasto',
    description:
      'Transcribe el audio y extrae: monto, descripción y categoría sugerida',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo de audio (MP3, WAV, WEBM, OGG, M4A)',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async processAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    // Validar que sea audio
    const allowedMimeTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'audio/m4a',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'El archivo debe ser audio (MP3, WAV, WEBM, OGG, M4A)',
      );
    }

    // Validar tamaño (máximo 25MB)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('El archivo no debe superar los 25MB');
    }

    const result = await this.voiceService.processVoice(
      file.buffer,
      file.originalname,
    );

    return {
      success: true,
      data: result,
      message: 'Audio procesado exitosamente',
    };
  }

  @Get('available-services')
  @ApiOperation({ summary: 'Obtener servicios de voz disponibles' })
  getAvailableServices() {
    return {
      services: this.voiceService.getAvailableServices(),
    };
  }
}
