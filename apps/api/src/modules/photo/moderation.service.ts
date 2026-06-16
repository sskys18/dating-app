import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RekognitionClient,
  DetectModerationLabelsCommand,
} from '@aws-sdk/client-rekognition';

export type ModerationVerdict =
  | { available: true; ok: true; labels: string[] }
  | { available: true; ok: false; labels: string[]; reason: string }
  | { available: false };

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private readonly client: RekognitionClient | null;
  private readonly minConfidence: number;

  constructor(private config: ConfigService) {
    const region = this.config.get<string>('AWS_S3_REGION', '');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID', '');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY', '');
    const enabled = this.config.get<string>('MODERATION_ENABLED', 'true') !== 'false';

    // Rekognition shares the same AWS credentials/region as S3. If any are
    // missing (e.g. local dev) the client is left null and moderation reports
    // itself unavailable, so confirm() falls back to manual review.
    if (enabled && region && accessKeyId && secretAccessKey) {
      this.client = new RekognitionClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.client = null;
    }

    this.minConfidence = Number(
      this.config.get<string>('MODERATION_MIN_CONFIDENCE', '80'),
    );
  }

  get available(): boolean {
    return this.client !== null;
  }

  /**
   * Runs an image buffer through AWS Rekognition DetectModerationLabels.
   * Returns ok=false when any moderation label (NSFW/violence/etc.) is
   * detected at or above the confidence threshold.
   */
  async moderate(image: Buffer): Promise<ModerationVerdict> {
    if (!this.client) return { available: false };

    try {
      const res = await this.client.send(
        new DetectModerationLabelsCommand({
          Image: { Bytes: image },
          MinConfidence: this.minConfidence,
        }),
      );

      const labels = (res.ModerationLabels ?? [])
        .map((l) => l.Name)
        .filter((n): n is string => !!n);

      if (labels.length > 0) {
        return {
          available: true,
          ok: false,
          labels,
          reason: `Flagged by moderation: ${labels.join(', ')}`,
        };
      }

      return { available: true, ok: true, labels: [] };
    } catch (err) {
      // shortcut: on Rekognition API/network error we treat it as unavailable
      // so the photo stays pending for manual review rather than being
      // wrongly auto-approved or wrongly rejected. Upgrade path: add a retry
      // queue / dead-letter so transient failures get re-moderated instead of
      // permanently parked in pending.
      this.logger.error(
        `Rekognition moderation failed; deferring to manual review: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { available: false };
    }
  }
}
