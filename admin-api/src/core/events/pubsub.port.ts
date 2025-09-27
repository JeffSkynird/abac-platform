export interface PubSubPort {
  publishInvalidate(tenantId: string): Promise<void>;
}
