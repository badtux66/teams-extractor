import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { PushGatewayPort, PushMessage } from '../application/ports/push.port';

/**
 * FCM push adapter. In production this initializes firebase-admin and calls
 * messaging().sendEachForMulticast().
 */
@Injectable()
export class FcmPushAdapter implements PushGatewayPort {
  private readonly logger = new Logger('FCM');
  private initialized = false;

  constructor(private readonly config: ConfigService) {
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
      }
      this.initialized = true;
    } catch (e: any) {
      this.logger.warn(`Failed to initialize Firebase Admin SDK: ${e.message}`);
    }
  }

  async send(message: PushMessage): Promise<void> {
    if (message.tokens.length === 0) return;
    
    if (!this.initialized) {
      this.logger.debug(
        `[DRY RUN] Push -> ${message.tokens.length} device(s): ${message.title} — ${message.body}`,
      );
      return;
    }

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: message.tokens,
        notification: {
          title: message.title,
          body: message.body,
        },
        data: message.data,
      });

      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            this.logger.error(`FCM send failed for token ${message.tokens[idx]}: ${resp.error?.message}`);
            // Phase 4: Token cleanup would happen here by dispatching an event to remove invalid tokens
          }
        });
      }
    } catch (error: any) {
      this.logger.error(`FCM broadcast failed: ${error.message}`);
    }
  }
}
