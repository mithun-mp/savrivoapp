import dotenv from 'dotenv';
dotenv.config();

function get(key: string, defaultValue?: string): string {
  return process.env[key] ?? defaultValue ?? '';
}

function getNumber(key: string, defaultValue: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : defaultValue;
}

export const config = {
  nodeEnv: get('NODE_ENV', 'development'),
  port: getNumber('PORT', 4000),
  mongoUri: get('MONGODB_URI', ''),
  jwt: {
    secret: get('JWT_SECRET', 'default-dev-secret-change-in-production'),
    expiresIn: get('JWT_EXPIRES_IN', '7d'),
  },
  admin: {
    email: get('ADMIN_EMAIL', ''),
    passwordHash: get('ADMIN_PASSWORD_HASH', ''),
  },
  frontendOrigin: get('FRONTEND_ORIGIN', 'http://localhost:4321'),
  amazon: {
    associateTag: get('AMAZON_ASSOCIATE_TAG', ''),
    accessKey: get('AMAZON_ACCESS_KEY', ''),
    secretKey: get('AMAZON_SECRET_KEY', ''),
    marketplace: get('AMAZON_MARKETPLACE', 'www.amazon.in'),
  },
  flipkart: {
    affiliateId: get('FLIPKART_AFFILIATE_ID', ''),
    token: get('FLIPKART_TOKEN', ''),
  },
  contact: {
    emailHost: get('CONTACT_EMAIL_HOST', ''),
    emailPort: getNumber('CONTACT_EMAIL_PORT', 587),
    emailUser: get('CONTACT_EMAIL_USER', ''),
    emailPass: get('CONTACT_EMAIL_PASS', ''),
    emailTo: get('CONTACT_EMAIL_TO', 'hello@savrivo.in'),
  },
  gemini: {
    apiKey1: get('GEMINI_API_KEY_1', ''),
    apiKey2: get('GEMINI_API_KEY_2', ''),
    apiKey3: get('GEMINI_API_KEY_3', ''),
    modelPrimary: get('GEMINI_MODEL_PRIMARY', 'gemini-3.8-flash'),
    modelSecondary: get('GEMINI_MODEL_SECONDARY', 'gemini-3.6-flash'),
    modelTertiary: get('GEMINI_MODEL_TERTIARY', 'gemini-3.5-flash-lite'),
    modelQuaternary: get('GEMINI_MODEL_QUATERNARY', 'gemini-3.1-flash-lite'),
    modelPreview1: get('GEMINI_MODEL_PREVIEW_1', 'gemini-3.1-pro-preview'),
    modelsList: get('GEMINI_MODELS', ''),
    modelAdvanced: get('GEMINI_MODEL_ADVANCED', 'gemini-3.8-flash'),
    modelFallback: get('GEMINI_MODEL', ''),
    maxRetries: getNumber('GEMINI_MAX_RETRIES', 3),
    timeoutMs: getNumber('GEMINI_REQUEST_TIMEOUT', 20000),
  },
  isDev: get('NODE_ENV', 'development') === 'development',
  isProd: get('NODE_ENV', 'development') === 'production',
};