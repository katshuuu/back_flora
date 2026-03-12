// check_db.js
require('dotenv').config();
const { query } = require('./db');

async function checkDatabase() {
    try {
        console.log('🔍 ПРОВЕРКА БАЗЫ ДАННЫХ\n');

        // Проверяем все сессии
        const sessions = await query(`
            SELECT 
                id,
                share_token,
                telegram_user_id,
                telegram_username,
                status,
                occasion,
                recipient_person_type,
                mood,
                color_preferences,
                flower_preferences,
                created_at,
                completed_at
            FROM sessions 
            ORDER BY created_at DESC 
            LIMIT 10
        `);

        console.log(`📊 ПОСЛЕДНИЕ 10 СЕССИЙ:`);
        console.log('='.repeat(80));
        
        for (const session of sessions.rows) {
            console.log(`
🆔 ID: ${session.id}
🔑 Token: ${session.share_token}
👤 Telegram: ${session.telegram_username || 'нет'} (${session.telegram_user_id || 'нет'})
📊 Статус: ${session.status}
📅 Создана: ${session.created_at}
✅ Завершена: ${session.completed_at || 'не завершена'}
🎨 Цвет: ${session.color_preferences || 'нет'}
🌸 Повод: ${session.occasion || 'нет'}
👥 Для кого: ${session.recipient_person_type || 'нет'}
😊 Настроение: ${session.mood || 'нет'}
`);
            console.log('-'.repeat(40));
        }

        // Проверяем букеты
        const bouquets = await query(`
            SELECT 
                b.*,
                s.share_token,
                s.telegram_username
            FROM bouquets b
            JOIN sessions s ON b.session_id = s.id
            WHERE s.telegram_user_id IS NOT NULL
            ORDER BY b.created_at DESC
            LIMIT 10
        `);

        console.log(`\n🌺 СГЕНЕРИРОВАННЫЕ БУКЕТЫ:`);
        console.log('='.repeat(80));
        
        for (const bouquet of bouquets.rows) {
            console.log(`
🌿 ID букета: ${bouquet.id}
🔑 Сессия: ${bouquet.share_token}
👤 Пользователь: ${bouquet.telegram_username}
📝 Промпт: ${bouquet.prompt_text?.substring(0, 100)}...
🖼 Изображение: ${bouquet.image_url || 'ожидание...'}
📊 Статус: ${bouquet.generation_status}
⏰ Создан: ${bouquet.created_at}
`);
            console.log('-'.repeat(40));
        }

        // Статистика
        const stats = await query(`
            SELECT 
                COUNT(*) as total_sessions,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tests,
                COUNT(CASE WHEN telegram_user_id IS NOT NULL THEN 1 END) as telegram_sessions,
                COUNT(DISTINCT telegram_user_id) as unique_users,
                COUNT(b.id) as total_bouquets,
                COUNT(CASE WHEN b.image_url IS NOT NULL THEN 1 END) as completed_bouquets
            FROM sessions s
            LEFT JOIN bouquets b ON s.id = b.session_id
        `);

        console.log(`\n📈 СТАТИСТИКА:`);
        console.log('='.repeat(80));
        console.log(`
Всего сессий: ${stats.rows[0].total_sessions}
Завершенных тестов: ${stats.rows[0].completed_tests}
Telegram сессий: ${stats.rows[0].telegram_sessions}
Уникальных пользователей: ${stats.rows[0].unique_users}
Всего букетов: ${stats.rows[0].total_bouquets}
Готовых букетов: ${stats.rows[0].completed_bouquets}
`);

    } catch (err) {
        console.error('❌ Ошибка:', err);
    } finally {
        process.exit();
    }
}

checkDatabase();