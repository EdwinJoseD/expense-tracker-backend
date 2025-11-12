import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as vision from '@google-cloud/vision';

export interface OcrResult {
  amount: number;
  description: string;
  merchantName?: string;
  date?: string;
  items?: Array<{ name: string; price: number; quantity?: number }>;
  tax?: number;
  tip?: number;
  confidence: number;
  rawText?: string;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private openai: OpenAI;
  private visionClient: vision.ImageAnnotatorClient;
  private hasOpenAI: boolean = false;
  private hasGoogleVision: boolean = false;

  constructor(private configService: ConfigService) {
    // Inicializar OpenAI
    const openaiKey = this.configService.get('OPENAI_API_KEY');
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
      this.hasOpenAI = true;
      this.logger.log('OpenAI inicializado para OCR');
    }

    // Inicializar Google Cloud Vision (opcional)
    const googleCredentials = this.configService.get(
      'GOOGLE_APPLICATION_CREDENTIALS',
    );
    if (googleCredentials) {
      try {
        this.visionClient = new vision.ImageAnnotatorClient();
        this.hasGoogleVision = true;
        this.logger.log('Google Cloud Vision inicializado para OCR');
      } catch (error) {
        this.logger.warn(
          'No se pudo inicializar Google Cloud Vision:',
          error.message,
        );
      }
    }
  }

  /**
   * Procesa una imagen de factura usando OpenAI GPT-4 Vision
   */
  async processReceiptWithOpenAI(imageBuffer: Buffer): Promise<OcrResult> {
    if (!this.hasOpenAI) {
      throw new BadRequestException('OpenAI no está configurado');
    }

    try {
      const base64Image = imageBuffer.toString('base64');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analiza esta factura/recibo y extrae la siguiente información en formato JSON:
{
  "amount": número total a pagar (requerido),
  "description": descripción breve del gasto (requerido),
  "merchantName": nombre del comercio/negocio,
  "date": fecha en formato YYYY-MM-DD,
  "items": [
    {
      "name": nombre del producto/servicio,
      "price": precio unitario,
      "quantity": cantidad (opcional)
    }
  ],
  "tax": impuestos si están especificados,
  "tip": propina si está especificada
}

IMPORTANTE: 
- Si no puedes leer claramente el total, intenta sumarlo de los items
- La descripción debe ser concisa (máximo 50 caracteres)
- Responde SOLO con JSON válido, sin texto adicional ni markdown`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.1, // Baja temperatura para mayor precisión
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No se recibió respuesta del OCR');
      }

      // Limpiar y parsear el JSON
      const cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const result = JSON.parse(cleanContent);

      // Validar campos requeridos
      if (!result.amount || !result.description) {
        throw new Error(
          'La respuesta del OCR no contiene los campos requeridos',
        );
      }

      return {
        ...result,
        confidence: 0.9,
      };
    } catch (error) {
      this.logger.error('Error procesando factura con OpenAI:', error);
      throw new BadRequestException(
        `Error al procesar la factura: ${error.message}`,
      );
    }
  }

  /**
   * Procesa una imagen de factura usando Google Cloud Vision
   */
  async processReceiptWithGoogleVision(
    imageBuffer: Buffer,
  ): Promise<OcrResult> {
    if (!this.hasGoogleVision) {
      throw new BadRequestException('Google Cloud Vision no está configurado');
    }

    try {
      const [result] = await this.visionClient.textDetection({
        image: { content: imageBuffer },
      });

      const detections = result.textAnnotations;
      const fullText = detections?.[0]?.description || '';

      if (!fullText) {
        throw new Error('No se pudo extraer texto de la imagen');
      }

      this.logger.log('Texto extraído:', fullText);

      // Usar OpenAI para extraer información estructurada del texto
      if (this.hasOpenAI) {
        const structuredData = await this.extractStructuredData(fullText);

        // Validar campos requeridos
        if (!structuredData.amount || !structuredData.description) {
          throw new Error(
            'La respuesta del OCR no contiene los campos requeridos',
          );
        }

        return {
          amount: structuredData.amount,
          description: structuredData.description,
          merchantName: structuredData.merchantName,
          date: structuredData.date,
          items: structuredData.items,
          tax: structuredData.tax,
          tip: structuredData.tip,
          rawText: fullText,
          confidence: 0.85,
        };
      } else {
        // Fallback: extracción simple sin IA
        return this.extractBasicInfo(fullText);
      }
    } catch (error) {
      this.logger.error('Error procesando factura con Google Vision:', error);
      throw new BadRequestException(
        `Error al procesar la factura: ${error.message}`,
      );
    }
  }

  /**
   * Extrae datos estructurados del texto usando GPT
   */
  private async extractStructuredData(
    text: string,
  ): Promise<Partial<OcrResult>> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Extrae información de facturas y responde solo con JSON válido sin markdown.',
        },
        {
          role: 'user',
          content: `Del siguiente texto de factura, extrae: amount (requerido), description (requerido), merchantName, date (YYYY-MM-DD), items (array), tax, tip.
          
Texto:
${text}

Responde SOLO con JSON:`,
        },
      ],
      max_tokens: 800,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const cleanContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return JSON.parse(cleanContent);
  }

  /**
   * Extracción básica sin IA (fallback)
   */
  private extractBasicInfo(text: string): OcrResult {
    // Buscar montos (patrón simple)
    const amountRegex = /\$?\s*(\d{1,3}(?:[,.]?\d{3})*(?:\.\d{2})?)/g;
    const amounts: number[] = [];
    let match;

    while ((match = amountRegex.exec(text)) !== null) {
      amounts.push(parseFloat(match[1].replace(/,/g, '')));
    }

    // El monto más grande probablemente es el total
    const amount = amounts.length > 0 ? Math.max(...amounts) : 0;

    // Buscar fechas
    const dateRegex = /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;
    const dateMatch = text.match(dateRegex);
    const date = dateMatch ? this.parseDate(dateMatch[1]) : undefined;

    return {
      amount,
      description: 'Gasto',
      date,
      confidence: 0.5,
      rawText: text,
    };
  }

  /**
   * Convierte fecha a formato ISO
   */
  private parseDate(dateStr: string): string | undefined {
    try {
      const parts = dateStr.split(/[-/]/);
      if (parts.length === 3) {
        const [day, month, year] = parts;
        const fullYear = year.length === 2 ? `20${year}` : year;
        return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    } catch (error) {
      this.logger.error('Error parseando fecha:', error);
    }
    return undefined;
  }

  /**
   * Método principal que elige el mejor servicio disponible
   */
  async processReceipt(imageBuffer: Buffer): Promise<OcrResult> {
    // Preferir OpenAI si está disponible (mejor precisión)
    if (this.hasOpenAI) {
      return this.processReceiptWithOpenAI(imageBuffer);
    }

    // Fallback a Google Vision
    if (this.hasGoogleVision) {
      return this.processReceiptWithGoogleVision(imageBuffer);
    }

    throw new BadRequestException(
      'No hay servicios de OCR configurados. Configura OPENAI_API_KEY o GOOGLE_APPLICATION_CREDENTIALS',
    );
  }

  /**
   * Verificar qué servicios están disponibles
   */
  getAvailableServices(): string[] {
    const services: string[] = [];
    if (this.hasOpenAI) services.push('OpenAI GPT-4 Vision');
    if (this.hasGoogleVision) services.push('Google Cloud Vision');
    return services;
  }
}
