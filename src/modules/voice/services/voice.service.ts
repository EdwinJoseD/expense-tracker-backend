import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SpeechClient } from '@google-cloud/speech';

export interface VoiceExpenseResult {
  amount: number;
  description: string;
  categoryHint?: string;
  transcription: string;
  confidence: number;
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private openai: OpenAI;
  private speechClient: SpeechClient;
  private hasOpenAI: boolean = false;
  private hasGoogleSpeech: boolean = false;

  constructor(private configService: ConfigService) {
    // Inicializar OpenAI Whisper
    const openaiKey = this.configService.get('OPENAI_API_KEY');
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
      this.hasOpenAI = true;
      this.logger.log('OpenAI Whisper inicializado');
    }

    // Inicializar Google Speech-to-Text (opcional)
    const googleCredentials = this.configService.get(
      'GOOGLE_APPLICATION_CREDENTIALS',
    );
    if (googleCredentials) {
      try {
        this.speechClient = new SpeechClient();
        this.hasGoogleSpeech = true;
        this.logger.log('Google Speech-to-Text inicializado');
      } catch (error) {
        this.logger.warn(
          'No se pudo inicializar Google Speech:',
          error.message,
        );
      }
    }
  }

  /**
   * Procesa audio usando OpenAI Whisper
   */
  async processVoiceWithWhisper(
    audioBuffer: Buffer,
    filename: string,
  ): Promise<VoiceExpenseResult> {
    if (!this.hasOpenAI) {
      throw new BadRequestException('OpenAI no está configurado');
    }

    try {
      // Transcribir audio a texto
      const file = new File([new Uint8Array(audioBuffer)], filename, {
        type: this.getMimeType(filename),
      });

      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'es', // Español
        response_format: 'verbose_json',
      });

      const text = transcription.text;
      this.logger.log(`Transcripción Whisper: ${text}`);

      // Extraer información del gasto usando GPT
      const expenseData = await this.extractExpenseFromText(text);

      return {
        ...expenseData,
        transcription: text,
        confidence: 0.9,
      };
    } catch (error) {
      this.logger.error('Error procesando audio con Whisper:', error);
      throw new BadRequestException(
        `Error al procesar el audio: ${error.message}`,
      );
    }
  }

  /**
   * Procesa audio usando Google Speech-to-Text
   */
  async processVoiceWithGoogleSpeech(
    audioBuffer: Buffer,
  ): Promise<VoiceExpenseResult> {
    if (!this.hasGoogleSpeech) {
      throw new BadRequestException('Google Speech no está configurado');
    }

    try {
      const audio = {
        content: audioBuffer.toString('base64'),
      };

      const config = {
        encoding: 'LINEAR16' as const,
        sampleRateHertz: 16000,
        languageCode: 'es-ES', // Español
        enableAutomaticPunctuation: true,
      };

      const request = {
        audio: audio,
        config: config,
      };

      const [response] = await this.speechClient.recognize(request);
      const transcription =
        response.results
          ?.map((result) => result.alternatives?.[0]?.transcript)
          .join('\n') || '';

      if (!transcription) {
        throw new Error('No se pudo transcribir el audio');
      }

      this.logger.log(`Transcripción Google Speech: ${transcription}`);

      // Extraer información del gasto
      const expenseData = await this.extractExpenseFromText(transcription);

      return {
        ...expenseData,
        transcription,
        confidence: 0.85,
      };
    } catch (error) {
      this.logger.error('Error procesando audio con Google Speech:', error);
      throw new BadRequestException(
        `Error al procesar el audio: ${error.message}`,
      );
    }
  }

  /**
   * Extrae información de gasto del texto transcrito usando GPT
   */
  private async extractExpenseFromText(
    text: string,
  ): Promise<Omit<VoiceExpenseResult, 'transcription' | 'confidence'>> {
    if (!this.hasOpenAI) {
      // Fallback sin IA
      return this.extractBasicExpenseInfo(text);
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Eres un asistente que extrae información de gastos de texto en español.
Extrae: amount (número requerido), description (string requerido, máximo 50 caracteres), categoryHint (sugerencia de categoría).

Categorías válidas: comida, transporte, entretenimiento, salud, educación, compras, servicios, otros.

Ejemplos:
- "Gasté 45 mil pesos en el supermercado" → {"amount": 45000, "description": "Compras en supermercado", "categoryHint": "comida"}
- "Me costó 12 dólares el uber" → {"amount": 12, "description": "Uber", "categoryHint": "transporte"}

Responde SOLO con JSON válido sin markdown.`,
          },
          {
            role: 'user',
            content: `Extrae la información del gasto: "${text}"`,
          },
        ],
        max_tokens: 200,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const result = JSON.parse(cleanContent);

      // Validar campos requeridos
      if (!result.amount || !result.description) {
        throw new Error('No se pudieron extraer los campos requeridos');
      }

      return result;
    } catch (error) {
      this.logger.error('Error extrayendo datos con GPT:', error);
      // Fallback
      return this.extractBasicExpenseInfo(text);
    }
  }

  /**
   * Extracción básica sin IA (fallback)
   */
  private extractBasicExpenseInfo(
    text: string,
  ): Omit<VoiceExpenseResult, 'transcription' | 'confidence'> {
    // Buscar números (montos)
    const numberRegex = /(\d{1,3}(?:[,.]?\d{3})*(?:\.\d{2})?)/g;
    const numbers: number[] = [];
    let match;

    while ((match = numberRegex.exec(text)) !== null) {
      numbers.push(parseFloat(match[1].replace(/,/g, '')));
    }

    const amount = numbers.length > 0 ? numbers[0] : 0;

    return {
      amount,
      description: text.substring(0, 50),
      categoryHint: 'otros',
    };
  }

  /**
   * Obtener MIME type del archivo de audio
   */
  private getMimeType(filename: string): string {
    const ext: string = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      webm: 'audio/webm',
      ogg: 'audio/ogg',
      m4a: 'audio/m4a',
    };
    return mimeTypes[ext] || 'audio/mpeg';
  }

  /**
   * Método principal que elige el mejor servicio disponible
   */
  async processVoice(
    audioBuffer: Buffer,
    filename: string,
  ): Promise<VoiceExpenseResult> {
    // Preferir OpenAI Whisper si está disponible
    if (this.hasOpenAI) {
      return this.processVoiceWithWhisper(audioBuffer, filename);
    }

    // Fallback a Google Speech
    if (this.hasGoogleSpeech) {
      return this.processVoiceWithGoogleSpeech(audioBuffer);
    }

    throw new BadRequestException(
      'No hay servicios de voz configurados. Configura OPENAI_API_KEY o GOOGLE_APPLICATION_CREDENTIALS',
    );
  }

  /**
   * Verificar qué servicios están disponibles
   */
  getAvailableServices(): string[] {
    const services: string[] = [];
    if (this.hasOpenAI) services.push('OpenAI Whisper');
    if (this.hasGoogleSpeech) services.push('Google Speech-to-Text');
    return services;
  }

  /**
   * Genera sugerencias de gastos basadas en el historial (bonus)
   */
  async generateExpenseSuggestions(userHistory: string[]): Promise<string[]> {
    if (!this.hasOpenAI) {
      return [];
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Genera 5 sugerencias breves de gastos comunes basadas en el historial.',
          },
          {
            role: 'user',
            content: `Historial:\n${userHistory.join('\n')}\n\nGenera 5 sugerencias:`,
          },
        ],
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content || '';
      return content.split('\n').filter((line) => line.trim());
    } catch (error) {
      this.logger.error('Error generando sugerencias:', error);
      return [];
    }
  }
}
