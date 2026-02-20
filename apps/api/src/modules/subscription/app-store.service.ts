import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
} from '@apple/app-store-server-library';
import type {
  JWSTransactionDecodedPayload,
  ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library';

@Injectable()
export class AppStoreService {
  private readonly logger = new Logger(AppStoreService.name);
  private readonly apiClient: AppStoreServerAPIClient;
  private readonly verifier: SignedDataVerifier;

  constructor(private config: ConfigService) {
    const signingKey = this.config.get<string>('APP_STORE_SERVER_KEY', '');
    const keyId = this.config.get<string>('APPLE_KEY_ID', '');
    const issuerId = this.config.get<string>('APPLE_ISSUER_ID', '');
    const bundleId = this.config.get<string>('APPLE_BUNDLE_ID', '');
    const envStr = this.config.get<string>('APPLE_ENVIRONMENT', 'Sandbox');
    const environment = envStr === 'Production' ? Environment.PRODUCTION : Environment.SANDBOX;

    this.apiClient = new AppStoreServerAPIClient(
      signingKey,
      keyId,
      issuerId,
      bundleId,
      environment,
    );

    this.verifier = new SignedDataVerifier(
      [],
      false,
      environment,
      bundleId,
    );
  }

  async verifyTransaction(transactionId: string): Promise<JWSTransactionDecodedPayload> {
    const response = await this.apiClient.getTransactionInfo(transactionId);
    return this.verifier.verifyAndDecodeTransaction(response.signedTransactionInfo!);
  }

  async verifyNotification(signedPayload: string): Promise<ResponseBodyV2DecodedPayload> {
    return this.verifier.verifyAndDecodeNotification(signedPayload);
  }
}
