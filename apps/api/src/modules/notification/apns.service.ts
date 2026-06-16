import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as apn from '@parse/node-apn';

@Injectable()
export class ApnsService implements OnModuleDestroy {
  private provider: apn.Provider | null = null;
  private logger = new Logger('ApnsService');
  private bundleId: string;

  constructor(private configService: ConfigService) {
    const keyPath = this.configService.get<string>('APNS_KEY_PATH');
    const keyId = this.configService.get<string>('APNS_KEY_ID');
    const teamId = this.configService.get<string>('APNS_TEAM_ID');
    this.bundleId =
      this.configService.get<string>('APNS_BUNDLE_ID') ?? 'com.datingapp.ios';

    if (keyPath && keyId && teamId) {
      this.provider = new apn.Provider({
        token: {
          key: keyPath,
          keyId,
          teamId,
        },
        production: false,
      });
      this.logger.log('APNs provider initialized');
    } else {
      this.logger.warn(
        'APNs not configured — push notifications disabled',
      );
    }
  }

  async sendNotification(
    deviceToken: string,
    alert: string | { title: string; body: string },
    payload?: Record<string, unknown>,
  ) {
    if (!this.provider) {
      this.logger.debug('APNs not configured, skipping push');
      return;
    }

    const notification = new apn.Notification();
    notification.alert = alert;
    notification.topic = this.bundleId;
    notification.sound = 'default';

    if (payload) {
      notification.payload = payload;
    }

    try {
      const result = await this.provider.send(notification, deviceToken);
      if (result.failed.length > 0) {
        this.logger.warn(
          `APNs send failed for ${deviceToken}: ${JSON.stringify(result.failed)}`,
        );
      }
    } catch (err) {
      this.logger.error(`APNs send error: ${err}`);
    }
  }

  async onModuleDestroy() {
    if (this.provider) {
      await this.provider.shutdown();
    }
  }
}
