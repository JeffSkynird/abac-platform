import Redis from 'ioredis';
import { PubSubPort } from '../../core/events/pubsub.port';

export class RedisPubSub implements PubSubPort {
  private client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  async publishInvalidate(tenantId: string) {
    await this.client.publish('pdp:invalidate', tenantId);
  }
}
