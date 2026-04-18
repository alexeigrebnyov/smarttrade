/**
 * Rate Limiter для контроля частоты запросов
 */

export interface RateLimitOptions {
  /** Максимальное количество запросов */
  maxRequests: number;
  /** Временное окно в миллисекундах */
  windowMs: number;
  /** Сообщение при превышении лимита */
  message?: string;
}

interface RequestRecord {
  timestamp: number;
  count: number;
}

export class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly message: string;
  private requests: Map<string, RequestRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: RateLimitOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
    this.message = options.message ?? 'Rate limit exceeded';
    
    // Запуск очистки старых записей каждые 10% от окна
    const cleanupIntervalMs = Math.max(1000, Math.floor(windowMs / 10));
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  /**
   * Проверка можно ли выполнить запрос
   */
  async checkLimit(key: string = 'default'): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const record = this.requests.get(key);

    if (!record || now - record.timestamp > this.windowMs) {
      // Новое окно
      this.requests.set(key, { timestamp: now, count: 1 });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt: now + this.windowMs
      };
    }

    const elapsed = now - record.timestamp;
    const remaining = this.maxRequests - record.count;

    if (record.count >= this.maxRequests) {
      // Лимит превышен
      return {
        allowed: false,
        remaining: 0,
        resetAt: record.timestamp + this.windowMs
      };
    }

    // Увеличиваем счетчик
    record.count++;
    this.requests.set(key, record);

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt: record.timestamp + this.windowMs
    };
  }

  /**
   * Выполнение функции с rate limiting
   */
  async execute<T>(fn: () => Promise<T>, key: string = 'default'): Promise<T> {
    const limit = await this.checkLimit(key);
    
    if (!limit.allowed) {
      const waitTime = limit.resetAt - Date.now();
      throw new RateLimitError(
        `${this.message}. Retry after ${Math.ceil(waitTime / 1000)}s`,
        waitTime,
        limit.resetAt
      );
    }

    return fn();
  }

  /**
   * Ожидание пока лимит не будет доступен
   */
  async waitForLimit(key: string = 'default'): Promise<void> {
    while (true) {
      const limit = await this.checkLimit(key);
      
      if (limit.allowed) {
        return;
      }

      const waitTime = limit.resetAt - Date.now();
      if (waitTime > 0) {
        await this.sleep(Math.min(waitTime, 5000)); // Ждём максимум 5 секунд за раз
      }
    }
  }

  /**
   * Сброс лимита для ключа
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Сброс всех лимитов
   */
  resetAll(): void {
    this.requests.clear();
  }

  /**
   * Получение статистики по ключу
   */
  getStats(key: string): { count: number; remaining: number; resetAt: number } | null {
    const record = this.requests.get(key);
    if (!record) return null;

    const now = Date.now();
    if (now - record.timestamp > this.windowMs) {
      return { count: 0, remaining: this.maxRequests, resetAt: now + this.windowMs };
    }

    return {
      count: record.count,
      remaining: Math.max(0, this.maxRequests - record.count),
      resetAt: record.timestamp + this.windowMs
    };
  }

  /**
   * Очистка старых записей
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requests.entries()) {
      if (now - record.timestamp > this.windowMs * 2) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * Утилита для сна
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Остановка и очистка ресурсов
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.requests.clear();
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfterMs: number,
    public resetAt: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Пресеты для распространённых сценариев
 */
export const RateLimitPresets = {
  /** Для RPC запросов (100 запросов в секунду) */
  rpc: new RateLimiter({ maxRequests: 100, windowMs: 1000 }),
  
  /** Для DEX API (10 запросов в секунду) */
  dexApi: new RateLimiter({ maxRequests: 10, windowMs: 1000 }),
  
  /** Для транзакций (5 транзакций в секунду) */
  transactions: new RateLimiter({ maxRequests: 5, windowMs: 1000 }),
  
  /** Консервативный режим (1 запрос в секунду) */
  conservative: new RateLimiter({ maxRequests: 1, windowMs: 1000 }),
  
  /** Для сканирования пулов (30 запросов в минуту) */
  poolScan: new RateLimiter({ maxRequests: 30, windowMs: 60000 })
};
