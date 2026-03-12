// db.js
const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;

console.log('📊 Настройки подключения к БД:');
console.log('  - Режим:', isProduction ? 'PRODUCTION (Timeweb)' : 'DEVELOPMENT');
console.log('  - URL:', databaseUrl?.replace(/:([^@]+)@/, ':*****@'));

if (!databaseUrl) {
  console.error('❌ DATABASE_URL не задан в .env файле');
  process.exit(1);
}

// Настройки для Timeweb PostgreSQL с публичным IP
const poolConfig = {
  connectionString: databaseUrl,
  connectionTimeoutMillis: 10000,  // 10 секунд на подключение
  idleTimeoutMillis: 30000,
  max: 20,
  ssl: false,  // Timeweb не требует SSL для внутренних подключений
  keepAlive: true,
};

const pool = new Pool(poolConfig);

// Проверка подключения
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Ошибка подключения к БД:', err.message);
    console.error('   Проверьте:');
    console.error('   1. Правильность пароля');
    console.error('   2. Доступность IP 5.42.112.202');
    console.error('   3. Не блокирует ли брандмауэр порт 5432');
    return;
  }
  
  console.log('✅ База данных успешно подключена!');
  release();
});

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`📊 Запрос (${duration}ms):`, text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    return res;
  } catch (error) {
    console.error('❌ Ошибка запроса:', error.message);
    throw error;
  }
}

async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { query, transaction, pool };