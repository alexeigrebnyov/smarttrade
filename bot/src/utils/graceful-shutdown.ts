/**
 * Graceful Shutdown Handler
 * Обеспечивает корректную остановку бота с сохранением состояния
 */

import { EventEmitter } from 'events';

export interface ShutdownOptions {
  /** Таймаут на завершение операций (мс) */
  timeoutMs?: number;
  /** Логгер для вывода сообщений */
  logger?: (msg: string) => void;
}

export class GracefulShutdown extends EventEmitter {
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;
  private cleanupTasks: Array<() => Promise<void>> = [];
  private readonly timeoutMs: number;
  private readonly logger: (msg: string) => void;
  private shutdownStartTime: number | null = null;

  constructor(options: ShutdownOptions = {}) {
    super();
    this.timeoutMs = options.timeoutMs ?? 30000; // 30 секунд по умолчанию
    this.logger = options.logger ?? ((msg) => console.log(`[SHUTDOWN] ${msg}`));
    
    this.setupSignalHandlers();
  }

  /**
   * Регистрация функции очистки
   */
  registerCleanup(task: () => Promise<void>): void {
    this.cleanupTasks.push(task);
  }

  /**
   * Инициация graceful shutdown
   */
  async shutdown(signal?: string): Promise<void> {
    if (this.isShuttingDown) {
      this.logger('Shutdown already in progress...');
      return this.shutdownPromise!;
    }

    this.isShuttingDown = true;
    this.shutdownStartTime = Date.now();
    this.logger(`Initiating graceful shutdown (signal: ${signal || 'manual'})...`);

    this.shutdownPromise = this.performShutdown();
    return this.shutdownPromise;
  }

  /**
   * Проверка что идет shutdown
   */
  isShuttingDownNow(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Принудительная остановка если таймаут истек
   */
  private checkTimeout(): void {
    if (!this.shutdownStartTime) return;
    
    const elapsed = Date.now() - this.shutdownStartTime;
    if (elapsed > this.timeoutMs) {
      this.logger(`⚠️  Timeout exceeded (${elapsed}ms > ${this.timeoutMs}ms), forcing exit...`);
      process.exit(1);
    }
  }

  /**
   * Выполнение shutdown
   */
  private async performShutdown(): Promise<void> {
    try {
      // Остановить получение новых задач
      this.emit('shutdown:start');
      this.logger('🛑 Stopping new operations...');

      // Проверка таймаута перед каждой операцией
      const timeoutCheck = setInterval(() => this.checkTimeout(), 1000);

      try {
        // Выполнение всех задач очистки последовательно
        for (let i = this.cleanupTasks.length - 1; i >= 0; i--) {
          this.checkTimeout();
          const task = this.cleanupTasks[i];
          this.logger(`Executing cleanup task ${i + 1}/${this.cleanupTasks.length}...`);
          
          try {
            await task();
          } catch (err) {
            this.logger(`⚠️  Cleanup task ${i + 1} failed: ${err}`);
            // Продолжаем выполнение остальных задач
          }
        }

        // Финальные события
        this.emit('shutdown:complete');
        this.logger('✅ Graceful shutdown completed');
      } finally {
        clearInterval(timeoutCheck);
      }
    } catch (err) {
      this.logger(`❌ Shutdown error: ${err}`);
      this.emit('shutdown:error', err);
      throw err;
    } finally {
      this.isShuttingDown = false;
    }
  }

  /**
   * Настройка обработчиков сигналов
   */
  private setupSignalHandlers(): void {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

    for (const signal of signals) {
      process.on(signal as NodeJS.Signals, async () => {
        this.logger(`Received signal ${signal}`);
        await this.shutdown(signal);
        process.exit(0);
      });
    }

    // Обработка uncaught exceptions
    process.on('uncaughtException', async (err) => {
      this.logger(`❌ Uncaught exception: ${err}`);
      await this.shutdown('uncaughtException');
      process.exit(1);
    });

    // Обработка unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      this.logger(`❌ Unhandled rejection at ${promise}: ${reason}`);
      await this.shutdown('unhandledRejection');
      process.exit(1);
    });
  }
}

/**
 * Singleton instance для глобального использования
 */
let globalShutdown: GracefulShutdown | null = null;

export function getGracefulShutdown(options?: ShutdownOptions): GracefulShutdown {
  if (!globalShutdown) {
    globalShutdown = new GracefulShutdown(options);
  }
  return globalShutdown;
}
