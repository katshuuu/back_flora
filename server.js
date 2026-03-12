require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('./db');
const cloudinary = require('cloudinary').v2;

const app = express();

/*
========================
MIDDLEWARE
========================
*/

app.use(cors({
    origin: [
        'http://127.0.0.1:5501',
        'http://localhost:5501',
        'http://localhost:3000',
        'http://5.129.243.61:3001',
        process.env.SITE_URL
    ].filter(Boolean)
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

/*
========================
CONFIG
========================
*/

const PORT = process.env.PORT || 3000;
const SITE_URL = process.env.SITE_URL || `http://5.129.243.61:${PORT}`;

const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID;
const YANDEX_API_KEY = process.env.YANDEX_API_KEY;

if (!YANDEX_FOLDER_ID || !YANDEX_API_KEY) {
    console.error('❌ Yandex credentials missing');
    process.exit(1);
}

/*
========================
CLOUDINARY
========================
*/

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/*
========================
TEMP FOLDER
========================
*/

fs.ensureDirSync('./temp');

/*
========================
YANDEX ART GENERATION
========================
*/

const YANDEX_ART_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/imageGenerationAsync';

async function waitForImage(operationId) {
    const maxAttempts = 60;

    for (let i = 0; i < maxAttempts; i++) {
        const response = await axios.get(
            `https://operation.api.cloud.yandex.net/operations/${operationId}`,
            { headers: { Authorization: `Api-Key ${YANDEX_API_KEY}` } }
        );

        if (response.data.done) {
            if (response.data.response?.image) {
                return response.data.response.image;
            }
            throw new Error('Image missing');
        }

        await new Promise(r => setTimeout(r, 1000));
    }

    throw new Error('Generation timeout');
}

async function generateWithYandexART(prompt) {
    const body = {
        modelUri: `art://${YANDEX_FOLDER_ID}/yandex-art/latest`,
        messages: [{ text: prompt, weight: 1 }],
        generationOptions: {
            seed: Math.floor(Math.random() * 100000),
            format: "JPEG",
            aspectRatio: { widthRatio: 1, heightRatio: 1 }
        }
    };

    const response = await axios.post(YANDEX_ART_URL, body, {
        headers: {
            Authorization: `Api-Key ${YANDEX_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    return await waitForImage(response.data.id);
}

async function saveImageToCloudinary(base64, requestId) {
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    
    const result = await cloudinary.uploader.upload(
        `data:image/jpeg;base64,${base64Data}`,
        {
            folder: "floramind",
            public_id: `${requestId}_${Date.now()}`
        }
    );

    return result.secure_url;
}

// Функция для генерации и сохранения изображения
async function generateAndSaveImage(prompt, requestId, token) {
    try {
        console.log(`🎨 Начинаем генерацию изображения для requestId: ${requestId}`);
        
        const base64 = await generateWithYandexART(prompt);
        console.log(`✅ Изображение сгенерировано, сохраняем в Cloudinary...`);
        
        const imageUrl = await saveImageToCloudinary(base64, requestId);

        await query(
            `UPDATE bouquets
             SET image_url = $1,
                 generation_status = 'completed'
             WHERE generation_request_id = $2`,
            [imageUrl, requestId]
        );

        console.log(`✅ Изображение сохранено для заказа ${token}: ${imageUrl}`);
    } catch (err) {
        console.error('❌ Ошибка генерации/сохранения изображения:', err);
        await query(
            `UPDATE bouquets
             SET generation_status = 'failed'
             WHERE generation_request_id = $1`,
            [requestId]
        );
    }
}

/*
========================
СОЗДАНИЕ СЕССИИ (ДЛЯ САЙТА)
========================
*/

app.post('/api/create-session', async (req, res) => {
    try {
        const { recipientType } = req.body; // 'self' или 'other'
        
        const shareToken = uuidv4();
        
        const result = await query(
            `INSERT INTO sessions 
             (share_token, recipient_type, status, created_at)
             VALUES ($1, $2, 'pending', NOW())
             RETURNING id, share_token`,
            [shareToken, recipientType || 'self']
        );
        
        const sessionId = result.rows[0].id;
        const token = result.rows[0].share_token;
        
        // Создаем ссылку для Telegram бота
        const botLink = `https://t.me/your_bot_username?start=${token}`;
        
        res.json({
            success: true,
            sessionId,
            token,
            botLink,
            message: 'Отправьте эту ссылку получателю или пройдите тест сами'
        });
        
    } catch (err) {
        console.error('❌ Ошибка создания сессии:', err);
        res.status(500).json({ error: 'Не удалось создать сессию' });
    }
});

/*
========================
СОЗДАНИЕ СЕССИИ С СУЩЕСТВУЮЩИМ ТОКЕНОМ (ДЛЯ БОТА)
========================
*/

app.post('/api/create-session-with-token', async (req, res) => {
    try {
        const { telegramUserId, telegramUsername, token } = req.body;
        
        // Проверяем, существует ли уже сессия с таким токеном
        const existingSession = await query(
            'SELECT id FROM sessions WHERE share_token = $1',
            [token]
        );

        if (existingSession.rows.length > 0) {
            // Сессия уже существует, обновляем telegram данные
            await query(
                `UPDATE sessions SET 
                 telegram_user_id = $1,
                 telegram_username = $2
                 WHERE share_token = $3`,
                [telegramUserId || null, telegramUsername || null, token]
            );
            
            return res.json({
                success: true,
                token: token,
                sessionId: existingSession.rows[0].id,
                shareUrl: `${SITE_URL}/quiz/${token}`
            });
        }

        // Создаем новую сессию с указанным токеном
        const result = await query(
            `INSERT INTO sessions 
             (share_token, telegram_user_id, telegram_username, status, created_at)
             VALUES ($1, $2, $3, 'pending', NOW())
             RETURNING id, share_token`,
            [token, telegramUserId || null, telegramUsername || null]
        );
        
        const sessionId = result.rows[0].id;
        const shareUrl = `${SITE_URL}/quiz/${token}`;
        
        res.json({
            success: true,
            sessionId,
            token,
            shareUrl
        });
        
    } catch (err) {
        console.error('❌ Ошибка создания сессии с токеном:', err);
        res.status(500).json({ error: 'Не удалось создать сессию' });
    }
});

/*
========================
СОХРАНЕНИЕ РЕЗУЛЬТАТОВ ТЕСТА ИЗ TELEGRAM БОТА
========================
*/

app.post('/api/save-test-results', async (req, res) => {
    try {
        const { 
            telegram_id, 
            telegram_name,
            profile, 
            scores, 
            ai_prompt,
            session_token,
            answers 
        } = req.body;

        console.log('📥 Получены результаты теста:', { 
            session_token, 
            telegram_id,
            profile 
        });

        // Маппинг профиля из бота в поля таблицы sessions
        const occasion = 'telegram_test';
        const recipientPersonType = profile?.form || 'self';
        const mood = profile?.mood || 'M1';
        const colorPreferences = profile?.color || 'P';
        
        // Преобразуем mood код в читаемое значение
        const moodMap = {
            'M1': 'romantic',
            'M2': 'happy',
            'M3': 'dramatic',
            'M4': 'calm'
        };

        let sessionId;

        // Обновляем сессию с результатами теста
        const updateResult = await query(
            `UPDATE sessions SET
             occasion = $1,
             recipient_person_type = $2,
             mood = $3,
             color_preferences = $4,
             telegram_user_id = $5,
             telegram_username = $6,
             status = 'completed',
             completed_at = NOW()
             WHERE share_token = $7
             RETURNING id`,
            [
                occasion,
                recipientPersonType,
                moodMap[mood] || 'happy',
                colorPreferences,
                telegram_id ? String(telegram_id) : null,
                telegram_name || null,
                session_token
            ]
        );

        if (updateResult.rows.length === 0) {
            console.log('⚠️ Сессия не найдена, создаем новую');
            // Если сессия не найдена, создаем новую
            const newSession = await query(
                `INSERT INTO sessions 
                 (share_token, telegram_user_id, telegram_username, status, completed_at, 
                  occasion, recipient_person_type, mood, color_preferences)
                 VALUES ($1, $2, $3, 'completed', NOW(), $4, $5, $6, $7)
                 RETURNING id`,
                [
                    session_token, 
                    telegram_id ? String(telegram_id) : null, 
                    telegram_name || null,
                    occasion,
                    recipientPersonType,
                    moodMap[mood] || 'happy',
                    colorPreferences
                ]
            );
            
            sessionId = newSession.rows[0].id;
            console.log('✅ Создана новая сессия с ID:', sessionId);
        } else {
            sessionId = updateResult.rows[0].id;
            console.log('✅ Обновлена существующая сессия с ID:', sessionId);
        }

        // Сохраняем промпт для генерации
        const requestId = 'gen_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        await query(
            `INSERT INTO bouquets
             (session_id, prompt_text, generation_status, generation_request_id, created_at)
             VALUES($1, $2, 'pending', $3, NOW())`,
            [sessionId, ai_prompt, requestId]
        );

        console.log('📝 Сохранен промпт для генерации, requestId:', requestId);

        // Запускаем генерацию в фоне
        generateAndSaveImage(ai_prompt, requestId, session_token).catch(error => {
            console.error('❌ Ошибка в фоновой генерации:', error);
        });

        res.json({ 
            success: true,
            message: 'Результаты сохранены, генерация запущена',
            requestId: requestId
        });

    } catch (err) {
        console.error('❌ Ошибка сохранения результатов:', err);
        res.status(500).json({ error: err.message });
    }
});

/*
========================
ПРОВЕРКА СТАТУСА ТЕСТА И ГЕНЕРАЦИИ ПО ТОКЕНУ (ДЛЯ САЙТА)
========================
*/

app.get('/api/quiz-status/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        console.log(`🔍 Проверка статуса для токена: ${token}`);
        
        const result = await query(
            `SELECT 
                s.id as session_id,
                s.status as session_status,
                s.completed_at,
                s.telegram_user_id,
                s.occasion,
                s.recipient_person_type,
                s.mood,
                s.color_preferences,
                b.id as bouquet_id,
                b.image_url,
                b.generation_status,
                b.generation_request_id,
                b.prompt_text,
                b.created_at as generation_started_at
             FROM sessions s
             LEFT JOIN bouquets b ON s.id = b.session_id
             WHERE s.share_token = $1
             ORDER BY b.created_at DESC
             LIMIT 1`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.json({ 
                status: 'not_found',
                message: 'Сессия не найдена'
            });
        }

        const session = result.rows[0];
        
        let responseStatus = {
            token: token,
            session_id: session.session_id,
            test_completed: !!session.completed_at,
            session_status: session.session_status,
            has_generation: !!session.bouquet_id,
            timestamp: new Date().toISOString()
        };

        // Определяем статус для фронтенда
        if (!session.completed_at) {
            responseStatus.status = 'test_pending';
            responseStatus.message = 'Ожидание прохождения теста в Telegram';
        } 
        else if (!session.bouquet_id) {
            responseStatus.status = 'generation_pending';
            responseStatus.message = 'Тест пройден, подготовка генерации...';
        }
        else if (session.generation_status === 'pending') {
            responseStatus.status = 'generating';
            responseStatus.message = 'Генерация вашего уникального букета...';
            responseStatus.generation_request_id = session.generation_request_id;
            responseStatus.generation_started = session.generation_started_at;
        }
        else if (session.generation_status === 'completed' && session.image_url) {
            responseStatus.status = 'ready';
            responseStatus.message = 'Ваш букет готов!';
            responseStatus.image_url = session.image_url;
            responseStatus.bouquet_id = session.bouquet_id;
            
            // Добавляем профиль для отображения
            const moodMap = {
                'romantic': 'Романтичное',
                'happy': 'Радостное',
                'dramatic': 'Драматичное',
                'calm': 'Спокойное'
            };
            
            const colorMap = {
                'P': 'Нежная пастель',
                'B': 'Яркая энергия',
                'D': 'Глубокая драма',
                'N': 'Природная гармония'
            };
            
            responseStatus.profile = {
                mood: moodMap[session.mood] || session.mood,
                color: colorMap[session.color_preferences] || session.color_preferences,
                person_type: session.recipient_person_type === 'self' ? 'Для себя' : 'Для другого'
            };
        }
        else if (session.generation_status === 'failed') {
            responseStatus.status = 'failed';
            responseStatus.message = 'Не удалось сгенерировать букет. Пожалуйста, попробуйте позже.';
        }

        console.log(`📊 Статус для токена ${token}:`, responseStatus.status);

        res.json(responseStatus);

    } catch (err) {
        console.error('❌ Ошибка проверки статуса:', err);
        res.status(500).json({ 
            status: 'error',
            error: err.message 
        });
    }
});

/*
========================
ПРОВЕРКА СУЩЕСТВОВАНИЯ СЕССИИ
========================
*/

app.get('/api/check-session/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        const result = await query(
            'SELECT id FROM sessions WHERE share_token = $1',
            [token]
        );
        
        res.json({
            exists: result.rows.length > 0
        });
    } catch (err) {
        console.error('❌ Ошибка проверки сессии:', err);
        res.status(500).json({ error: err.message });
    }
});

/*
========================
ПОЛУЧЕНИЕ РЕЗУЛЬТАТОВ СЕССИИ
========================
*/

app.get('/api/session-results/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const result = await query(
            `SELECT s.*, 
                    b.id as bouquet_id, 
                    b.image_url, 
                    b.prompt_text,
                    b.generation_status
             FROM sessions s
             LEFT JOIN bouquets b ON s.id = b.session_id
             WHERE s.share_token = $1
             ORDER BY b.created_at DESC`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Сессия не найдена' });
        }

        const session = {
            ...result.rows[0],
            bouquets: result.rows
                .filter(row => row.bouquet_id !== null)
                .map(row => ({
                    id: row.bouquet_id,
                    imageUrl: row.image_url,
                    promptText: row.prompt_text,
                    status: row.generation_status
                }))
        };

        // Записываем просмотр
        if (session.id) {
            await query(
                `INSERT INTO link_clicks(session_id, ip_address, user_agent, referer)
                 VALUES($1, $2, $3, $4)`,
                [session.id, req.ip, req.headers['user-agent'], req.get('Referer')]
            );
        }

        res.json(session);
    } catch (err) {
        console.error('❌ Ошибка получения результатов:', err);
        res.status(500).json({ error: 'Ошибка загрузки' });
    }
});

/*
========================
СОЗДАНИЕ ЗАКАЗА
========================
*/

app.post('/api/create-order', async (req, res) => {
    try {
        const {
            token,
            bouquetId,
            customerName,
            customerPhone,
            customerEmail,
            deliveryAddress,
            deliveryDate,
            deliveryComment
        } = req.body;

        // Валидация
        if (!customerName || !customerPhone) {
            return res.status(400).json({ error: 'Имя и телефон обязательны' });
        }

        const result = await transaction(async (client) => {
            // Получаем информацию о сессии и букете
            const sessionInfo = await client.query(
                `SELECT s.id as session_id, b.id as bouquet_id, b.image_url
                 FROM sessions s
                 JOIN bouquets b ON s.id = b.session_id
                 WHERE s.share_token = $1 AND b.id = $2`,
                [token, bouquetId]
            );

            if (sessionInfo.rows.length === 0) {
                throw new Error('Букет не найден');
            }

            const session = sessionInfo.rows[0];

            // Создаем заказ (номер генерируется триггером)
            const orderResult = await client.query(
                `INSERT INTO orders (
                    session_id, bouquet_id, customer_name, customer_phone,
                    customer_email, delivery_address, delivery_date,
                    delivery_comment, order_status
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
                 RETURNING id, order_number`,
                [
                    session.session_id,
                    session.bouquet_id,
                    customerName,
                    customerPhone,
                    customerEmail || null,
                    deliveryAddress || null,
                    deliveryDate || null,
                    deliveryComment || null
                ]
            );

            // Обновляем статус сессии
            await client.query(
                `UPDATE sessions 
                 SET status = 'ordered', ordered_at = NOW() 
                 WHERE id = $1`,
                [session.session_id]
            );

            return orderResult.rows[0];
        });

        res.json({
            success: true,
            orderId: result.id,
            orderNumber: result.order_number,
            message: 'Заказ успешно оформлен!'
        });

    } catch (err) {
        console.error('❌ Ошибка создания заказа:', err);
        res.status(500).json({ error: 'Не удалось оформить заказ' });
    }
});

/*
========================
ПОЛУЧЕНИЕ ИНФОРМАЦИИ О ЗАКАЗЕ
========================
*/

app.get('/api/order/:orderNumber', async (req, res) => {
    try {
        const { orderNumber } = req.params;

        const result = await query(
            `SELECT o.*, s.occasion, s.mood, s.color_preferences, b.image_url
             FROM orders o
             JOIN sessions s ON o.session_id = s.id
             JOIN bouquets b ON o.bouquet_id = b.id
             WHERE o.order_number = $1`,
            [orderNumber]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('❌ Ошибка получения заказа:', err);
        res.status(500).json({ error: 'Ошибка загрузки заказа' });
    }
});

/*
========================
СТАТИСТИКА ДЛЯ АДМИНА
========================
*/

app.get('/api/admin/stats', async (req, res) => {
    try {
        const stats = await query(`
            SELECT
                (SELECT COUNT(*) FROM sessions) as total_sessions,
                (SELECT COUNT(*) FROM sessions WHERE status = 'completed') as completed_tests,
                (SELECT COUNT(*) FROM sessions WHERE status = 'ordered') as converted_orders,
                (SELECT COUNT(*) FROM orders) as total_orders,
                (SELECT COUNT(*) FROM orders WHERE order_status = 'pending') as pending_orders,
                (SELECT COUNT(*) FROM orders WHERE order_status = 'confirmed') as confirmed_orders,
                (SELECT COUNT(*) FROM link_clicks) as total_clicks,
                (SELECT COUNT(*) FROM bouquets) as total_bouquets
        `);

        res.json(stats.rows[0]);
    } catch (err) {
        console.error('❌ Ошибка статистики:', err);
        res.status(500).json({ error: 'Ошибка загрузки статистики' });
    }
});

/*
========================
ТЕСТОВЫЕ ЭНДПОИНТЫ
========================
*/

app.get('/api/test', (req, res) => {
    res.json({
        status: 'FloraAI server working',
        database: true,
        yandex: true,
        cloudinary: true,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/test-db', async (req, res) => {
    try {
        const result = await query('SELECT NOW() as time');
        res.json({
            success: true,
            time: result.rows[0].time,
            message: 'Подключение к БД работает'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/*
========================
ГЛАВНЫЕ СТРАНИЦЫ
========================
*/

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/quiz/:token', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'quiz.html'));
});

app.get('/order/:orderNumber', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'order.html'));
});

/*
========================
ЗАПУСК СЕРВЕРА
========================
*/

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 FloraAI server running

📡 URL: http://5.129.243.61:${PORT}
🔌 PORT: ${PORT}

📋 Основные эндпоинты:
   POST   /api/create-session              - Создать сессию (с сайта)
   POST   /api/create-session-with-token    - Создать сессию с токеном (для бота)
   POST   /api/save-test-results            - Сохранить результаты теста (от бота)
   GET    /api/quiz-status/:token           - Получить статус (для сайта)
   GET    /api/check-session/:token         - Проверить сессию
   GET    /api/session-results/:token       - Получить результаты
   POST   /api/create-order                  - Создать заказ

📊 Интеграция с Telegram ботом готова!
    `);
});