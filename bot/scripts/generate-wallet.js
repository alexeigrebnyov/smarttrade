#!/usr/bin/env node

/**
 * Скрипт для генерации нового кошелька Solana
 * Использование: npm run generate-wallet
 */

const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const fs = require('fs');
const path = require('path');

// Параметры
const NETWORK = process.argv[2] || 'devnet';
const OUTPUT_DIR = path.join(__dirname, '..', 'wallets');

// Создание директории если не существует
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('🔑 Генерация нового кошелька Solana...\n');

// Генерация ключевой пары
const keypair = Keypair.generate();

console.log('✅ Кошелёк успешно сгенерирован!\n');

// Публичный ключ
const publicKey = keypair.publicKey.toBase58();
console.log('📍 Public Key:', publicKey);

// Приватный ключ в разных форматах
const privateKeyBytes = keypair.secretKey;
const privateKeyBase58 = bs58.encode(privateKeyBytes);

console.log('\n🔒 Private Key (base58):', privateKeyBase58);
console.log('⚠️  ВАЖНО: Сохраните этот ключ в безопасном месте!\n');

// Сохранение в файл JSON (формат Solana CLI)
const walletFilePath = path.join(OUTPUT_DIR, `${NETWORK}-wallet.json`);
const secretKeyArray = Array.from(privateKeyBytes);
fs.writeFileSync(walletFilePath, JSON.stringify(secretKeyArray));

console.log('💾 Кошелёк сохранён в:', walletFilePath);

// Установка прав доступа (только для владельца)
try {
  fs.chmodSync(walletFilePath, 0o600);
  console.log('🔐 Права доступа установлены: 600 (только владелец)\n');
} catch (err) {
  console.warn('⚠️  Не удалось установить права доступа:', err.message, '\n');
}

// Информация для .env
console.log('📝 Для добавления в .env используйте:\n');
console.log(`ANCHOR_WALLET=${walletFilePath}`);
console.log(`WALLET_SECRET_KEY=${privateKeyBase58}\n`);

// Инструкция для получения SOL
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📌 Следующие шаги:\n');

if (NETWORK === 'devnet') {
  console.log('1️⃣  Получите SOL на devnet:');
  console.log(`   solana airdrop 2 ${publicKey} --url devnet\n`);
  
  console.log('2️⃣  Проверьте баланс:');
  console.log(`   solana balance ${publicKey} --url devnet\n`);
} else if (NETWORK === 'mainnet' || NETWORK === 'mainnet-beta') {
  console.log('⚠️  ВНИМАНИЕ: Mainnet кошелек!\n');
  console.log('1️⃣  Переведите SOL на этот адрес:');
  console.log(`   ${publicKey}\n`);
  console.log('2️⃣  Рекомендуется использовать аппаратный кошелек (Ledger) для mainnet!\n');
}

console.log('3️⃣  Обновите .env файл:');
console.log(`   RPC_URL=https://api.${NETWORK === 'mainnet' ? 'mainnet-beta' : NETWORK}.solana.com`);
console.log(`   ANCHOR_WALLET=${walletFilePath}`);
console.log('   # Или используйте WALLET_SECRET_KEY\n');

console.log('4️⃣  Задеплойте контракт после пополнения кошелька\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('✅ Готово! Удачи! 🚀\n');
