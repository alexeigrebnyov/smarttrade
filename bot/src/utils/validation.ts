/**
 * Утилиты для валидации входных данных
 */

import { PublicKey } from '@solana/web3.js';

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Валидация PublicKey
 */
export function validatePublicKey(value: string | PublicKey, fieldName = 'PublicKey'): PublicKey {
  if (!value) {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  try {
    return value instanceof PublicKey ? value : new PublicKey(value);
  } catch (err) {
    throw new ValidationError(`Invalid ${fieldName}: ${value}`, fieldName);
  }
}

/**
 * Валидация числа (положительное, не NaN)
 */
export function validatePositiveNumber(value: number, fieldName = 'Number', options?: {
  min?: number;
  max?: number;
  allowZero?: boolean;
}): number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a valid number`, fieldName);
  }

  const min = options?.min ?? (options?.allowZero ? 0 : Number.EPSILON);
  
  if (value < min) {
    throw new ValidationError(`${fieldName} must be >= ${min}, got ${value}`, fieldName);
  }

  if (options?.max !== undefined && value > options.max) {
    throw new ValidationError(`${fieldName} must be <= ${options.max}, got ${value}`, fieldName);
  }

  return value;
}

/**
 * Валидация процента (0-100 или 0-10000 для basis points)
 */
export function validatePercentage(value: number, fieldName = 'Percentage', isBasisPoints = false): number {
  const max = isBasisPoints ? 10000 : 100;
  const validated = validatePositiveNumber(value, fieldName, { min: 0, max, allowZero: true });
  
  if (validated > max) {
    throw new ValidationError(`${fieldName} cannot exceed ${max}${isBasisPoints ? ' (basis points)' : '%'}`, fieldName);
  }

  return validated;
}

/**
 * Валидация адреса программы Solana
 */
export function validateProgramId(value: string | PublicKey): PublicKey {
  const pk = validatePublicKey(value, 'Program ID');
  
  // Проверка что это не системная программа или заглушка
  const systemProgram = new PublicKey('11111111111111111111111111111111');
  if (pk.equals(systemProgram)) {
    throw new ValidationError('Program ID cannot be System Program (1111...)', 'Program ID');
  }

  return pk;
}

/**
 * Валидация конфигурации пула
 */
export function validatePoolConfig(config: {
  rayPool: string | PublicKey;
  dlmmPool: string | PublicKey;
  mints: {
    in: string | PublicKey;
    out: string | PublicKey;
    decimalsIn: number;
    decimalsOut?: number;
  };
}): void {
  validatePublicKey(config.rayPool, 'rayPool');
  validatePublicKey(config.dlmmPool, 'dlmmPool');
  validatePublicKey(config.mints.in, 'mints.in');
  validatePublicKey(config.mints.out, 'mints.out');
  validatePositiveNumber(config.mints.decimalsIn, 'mints.decimalsIn', { min: 0, max: 20 });
  
  if (config.mints.decimalsOut !== undefined) {
    validatePositiveNumber(config.mints.decimalsOut, 'mints.decimalsOut', { min: 0, max: 20 });
  }
}

/**
 * Валидация параметров свопа
 */
export function validateSwapParams(params: {
  amountIn: number;
  minAmountOut: number;
  slippageBps: number;
  decimals: number;
}): void {
  validatePositiveNumber(params.amountIn, 'amountIn', { allowZero: false });
  validatePositiveNumber(params.minAmountOut, 'minAmountOut', { allowZero: true });
  validatePercentage(params.slippageBps, 'slippageBps', true);
  validatePositiveNumber(params.decimals, 'decimals', { min: 0, max: 20 });

  // Минимальный amountOut должен быть меньше или равен amountIn (с учётом комиссий)
  if (params.minAmountOut > params.amountIn) {
    throw new ValidationError(
      `minAmountOut (${params.minAmountOut}) cannot exceed amountIn (${params.amountIn})`,
      'minAmountOut'
    );
  }
}

/**
 * Валидация приватного ключа
 */
export function validatePrivateKey(key: string): void {
  if (!key || typeof key !== 'string') {
    throw new ValidationError('Private key is required', 'WALLET_SECRET_KEY');
  }

  // Проверка формата base58
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(key)) {
    throw new ValidationError('Private key must be valid base58 string', 'WALLET_SECRET_KEY');
  }

  // Проверка длины (обычно 64-88 символов для Solana)
  if (key.length < 64 || key.length > 88) {
    throw new ValidationError(
      `Private key length should be 64-88 characters, got ${key.length}`,
      'WALLET_SECRET_KEY'
    );
  }
}

/**
 * Валидация URL RPC
 */
export function validateRpcUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new ValidationError('RPC URL is required', 'RPC_URL');
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch (err) {
    throw new ValidationError('RPC URL must be valid HTTP/HTTPS URL', 'RPC_URL');
  }

  return url;
}

/**
 * Комплексная валидация ENV переменных
 */
export function validateEnv(env: Record<string, string | undefined>): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Обязательные переменные
  const required = ['RPC_URL', 'WALLET_SECRET_KEY', 'PROGRAM_ID'];
  for (const key of required) {
    if (!env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // Валидация RPC URL
  if (env.RPC_URL) {
    try {
      validateRpcUrl(env.RPC_URL);
    } catch (err) {
      errors.push((err as ValidationError).message);
    }
  }

  // Валидация приватного ключа
  if (env.WALLET_SECRET_KEY) {
    try {
      validatePrivateKey(env.WALLET_SECRET_KEY);
    } catch (err) {
      errors.push((err as ValidationError).message);
    }
  }

  // Валидация PROGRAM_ID
  if (env.PROGRAM_ID) {
    try {
      validateProgramId(env.PROGRAM_ID);
    } catch (err) {
      errors.push((err as ValidationError).message);
    }
  }

  // Опциональные переменные с предупреждениями
  if (!env.TELEGRAM_BOT_TOKEN && !env.DISCORD_WEBHOOK_URL) {
    warnings.push('No notification channel configured (Telegram/Discord)');
  }

  if (!env.CIRCUIT_BREAKER_MAX_LOSS_SOL) {
    warnings.push('CircuitBreaker max loss not configured, using defaults');
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Санитизация строки для безопасного логирования
 */
export function sanitizeForLog(value: string, sensitive = false): string {
  if (!value) return '';
  
  if (sensitive) {
    // Показать только первые и последние 4 символа
    if (value.length <= 8) return '****';
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }
  
  return value;
}
