// test-connection.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  ssl: false
});

console.log('🔍 Тестирование подключения к Timeweb...');
console.log('URL:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':*****@'));

pool.query('SELECT NOW() as time, version() as version', (err, res) => {
  if (err) {
    console.error('❌ Ошибка подключения:');
    console.error('   Сообщение:', err.message);
    console.error('   Код:', err.code);
    
    if (err.message.includes('timeout')) {
      console.error('\n💡 Сервер не отвечает. Проверьте:');
      console.error('   1. Публичный IP доступен?');
      console.error('   2. Порт 5432 открыт в брандмауэре Timeweb?');
      console.error('   3. Нет ли блокировки провайдером?');
    }
    if (err.message.includes('password')) {
      console.error('\n💡 Неправильный пароль. Проверьте .env файл');
    }
    if (err.message.includes('database')) {
      console.error('\n💡 База данных не существует. Проверьте имя default_db');
    }
  } else {
    console.log('✅ Подключение успешно!');
    console.log('   Время на сервере:', res.rows[0].time);
    console.log('   Версия PostgreSQL:', res.rows[0].version.split(',')[0]);
  }
  
  pool.end();
});