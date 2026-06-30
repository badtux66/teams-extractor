export const PUSH_GATEWAY = Symbol('PUSH_GATEWAY');

export interface PushMessage {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Push delivery abstraction (FCM in production). */
export interface PushGatewayPort {
  send(message: PushMessage): Promise<void>;
}
