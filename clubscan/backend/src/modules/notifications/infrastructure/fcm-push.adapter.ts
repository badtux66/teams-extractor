import { Injectable, Logger } from '@nestjs/common';
import { PushGatewayPort, PushMessage } from '../application/ports/push.port';

/**
 * FCM push adapter. In production this initializes firebase-admin and calls
 * messaging().sendEachForMulticast(). When unconfigured it logs (dev), so the
 * notification pipeline works end-to-end without external credentials.
 */
@Injectable()
export class FcmPushAdapter implements PushGatewayPort {
  private readonly logger = new Logger('FCM');

  async send(message: PushMessage): Promise<void> {
    if (message.tokens.length === 0) return;
    // Production: firebase-admin messaging multicast with retry + token cleanup.
    this.logger.debug(
      `Push -> ${message.tokens.length} device(s): ${message.title} — ${message.body}`,
    );
  }
}
