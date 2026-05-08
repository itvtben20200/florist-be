export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  jwt: {
    secret: process.env.JWT_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  },

  email: {
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
    from: process.env.EMAIL_FROM || 'Florist <noreply@floriststore.com>',
    adminEmail: process.env.ADMIN_EMAIL!,
  },

  crm: {
    provider: (process.env.CRM_PROVIDER || 'none') as 'hubspot' | 'salesforce' | 'pipedrive' | 'none',
    apiKey: process.env.CRM_API_KEY || '',
    baseUrl: process.env.CRM_BASE_URL || '',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
};
