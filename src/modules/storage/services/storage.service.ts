import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as path from 'path';

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
  fileName: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    // Configurar cliente S3 (funciona con AWS S3 y MinIO)
    const accessKeyId =
      this.configService.get<string>('AWS_ACCESS_KEY_ID') ||
      this.configService.get<string>('MINIO_ROOT_USER') ||
      '';
    const secretAccessKey =
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ||
      this.configService.get<string>('MINIO_ROOT_PASSWORD') ||
      '';

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'AWS credentials (AWS_ACCESS_KEY_ID or MINIO_ROOT_USER) and (AWS_SECRET_ACCESS_KEY or MINIO_ROOT_PASSWORD) must be configured',
      );
    }

    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION') || 'us-east-1',
      endpoint: this.configService.get('MINIO_ENDPOINT'), // Para MinIO local
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Necesario para MinIO
    });

    this.bucketName =
      this.configService.get('S3_BUCKET_NAME') || 'expense-tracker';
  }

  /**
   * Subir archivo
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    userId: string,
  ): Promise<UploadResult> {
    try {
      // Generar nombre único para el archivo
      const fileExtension = path.extname(file.originalname);
      const fileName = `${crypto.randomBytes(16).toString('hex')}${fileExtension}`;
      const key = `${folder}/${userId}/${fileName}`;

      // Comando para subir
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalName: file.originalname,
          userId: userId,
        },
      });

      await this.s3Client.send(command);

      this.logger.log(`Archivo subido exitosamente: ${key}`);

      // Generar URL pública o firmada
      const url = await this.getSignedUrl(key);

      return {
        key,
        url,
        bucket: this.bucketName,
        fileName,
      };
    } catch (error) {
      this.logger.error('Error al subir archivo:', error);
      throw error;
    }
  }

  /**
   * Obtener URL firmada temporal (válida por 1 hora)
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      this.logger.error('Error al generar URL firmada:', error);
      throw error;
    }
  }

  /**
   * Descargar archivo
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const stream = response.Body as any;

      // Convertir stream a buffer
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error('Error al descargar archivo:', error);
      throw error;
    }
  }

  /**
   * Eliminar archivo
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`Archivo eliminado: ${key}`);
    } catch (error) {
      this.logger.error('Error al eliminar archivo:', error);
      throw error;
    }
  }

  /**
   * Verificar si un archivo existe
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Subir imagen de factura
   */
  async uploadReceipt(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadResult> {
    return this.uploadFile(file, 'receipts', userId);
  }

  /**
   * Subir audio de gasto por voz
   */
  async uploadVoiceRecording(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadResult> {
    return this.uploadFile(file, 'voice', userId);
  }

  /**
   * Subir avatar de usuario
   */
  async uploadAvatar(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadResult> {
    return this.uploadFile(file, 'avatars', userId);
  }

  /**
   * Validar tipo de archivo para imágenes
   */
  validateImageFile(file: Express.Multer.File): boolean {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    return allowedMimeTypes.includes(file.mimetype);
  }

  /**
   * Validar tipo de archivo para audio
   */
  validateAudioFile(file: Express.Multer.File): boolean {
    const allowedMimeTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'audio/m4a',
    ];
    return allowedMimeTypes.includes(file.mimetype);
  }

  /**
   * Validar tamaño de archivo (en bytes)
   */
  validateFileSize(file: Express.Multer.File, maxSizeInMB: number): boolean {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return file.size <= maxSizeInBytes;
  }
}
