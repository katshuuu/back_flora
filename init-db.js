// init-db.js
require('dotenv').config();
const { query, pool } = require('./db');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  console.log('🚀 Инициализация базы данных на Timeweb...');
  console.log('📦 Подключение к:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':*****@'));
  
  try {
    // Читаем SQL файл
    const sqlPath = path.join(__dirname, 'init-db.sql');
    
    if (!fs.existsSync(sqlPath)) {
      console.error('❌ Файл init-db.sql не найден!');
      process.exit(1);
    }
    
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('📄 SQL файл загружен, размер:', sql.length, 'символов');
    
    // Разделяем SQL на отдельные команды (улучшенный парсинг)
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.startsWith('DROP'));
    
    console.log(`📦 Найдено ${commands.length} SQL команд для выполнения`);
    
    // Выполняем команды по очереди
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      try {
        console.log(`\n🔄 Выполнение команды ${i + 1}/${commands.length}...`);
        console.log(`   ${cmd.substring(0, 100)}...`);
        
        await query(cmd);
        console.log(`✅ Команда ${i + 1} выполнена успешно`);
        successCount++;
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`⚠️ Команда ${i + 1}: объект уже существует`);
          successCount++;
        } else {
          console.error(`❌ Ошибка в команде ${i + 1}:`, err.message);
          errorCount++;
        }
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 РЕЗУЛЬТАТ ИНИЦИАЛИЗАЦИИ:');
    console.log('   ✅ Успешно:', successCount);
    console.log('   ❌ Ошибок:', errorCount);
    console.log('='.repeat(50));
    
    // Проверяем созданные таблицы
    console.log('\n🔍 Проверка созданных таблиц...');
    
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tables.rows.length === 0) {
      console.log('   ⚠️ Таблицы не найдены');
    } else {
      console.log('   📋 Найденные таблицы:');
      for (const table of tables.rows) {
        const count = await query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
        console.log(`   - ${table.table_name}: ${count.rows[0].count} записей`);
      }
    }
    
    console.log('\n✅ Инициализация базы данных завершена!');
    
  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

initDatabase();