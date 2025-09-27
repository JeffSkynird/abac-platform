export async function registerHelmet(app: any) {
  const helmet: any = require('@fastify/helmet');
  await app.register(helmet, { contentSecurityPolicy: false });
}
