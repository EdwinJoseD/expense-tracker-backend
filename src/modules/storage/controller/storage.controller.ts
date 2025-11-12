import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Get,
  Param,
  Delete,
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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { StorageService } from '../services/storage.service';

@ApiTags('storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload/receipt')
  @ApiOperation({ summary: 'Subir imagen de factura' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadReceipt(
    @CurrentUser() userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    // Validar que sea una imagen
    if (!this.storageService.validateImageFile(file)) {
      throw new BadRequestException(
        'El archivo debe ser una imagen (JPG, PNG, WEBP)',
      );
    }

    // Validar tamaño (máximo 10MB)
    if (!this.storageService.validateFileSize(file, 10)) {
      throw new BadRequestException('El archivo no debe superar los 10MB');
    }

    return this.storageService.uploadReceipt(file, userId);
  }

  @Post('upload/voice')
  @ApiOperation({ summary: 'Subir grabación de voz' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadVoice(
    @CurrentUser() userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    // Validar que sea audio
    if (!this.storageService.validateAudioFile(file)) {
      throw new BadRequestException(
        'El archivo debe ser audio (MP3, WAV, WEBM, OGG, M4A)',
      );
    }

    // Validar tamaño (máximo 25MB)
    if (!this.storageService.validateFileSize(file, 25)) {
      throw new BadRequestException('El archivo no debe superar los 25MB');
    }

    return this.storageService.uploadVoiceRecording(file, userId);
  }

  @Post('upload/avatar')
  @ApiOperation({ summary: 'Subir avatar de usuario' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    // Validar que sea una imagen
    if (!this.storageService.validateImageFile(file)) {
      throw new BadRequestException(
        'El archivo debe ser una imagen (JPG, PNG, WEBP)',
      );
    }

    // Validar tamaño (máximo 5MB)
    if (!this.storageService.validateFileSize(file, 5)) {
      throw new BadRequestException('El archivo no debe superar los 5MB');
    }

    return this.storageService.uploadAvatar(file, userId);
  }

  @Get('signed-url/:key')
  @ApiOperation({ summary: 'Obtener URL firmada temporal para un archivo' })
  async getSignedUrl(@Param('key') key: string) {
    const url = await this.storageService.getSignedUrl(key);
    return { url };
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Eliminar archivo' })
  async deleteFile(@Param('key') key: string) {
    await this.storageService.deleteFile(key);
    return { message: 'Archivo eliminado exitosamente' };
  }
}
