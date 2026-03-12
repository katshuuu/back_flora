// server.js
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
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;

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

async function saveImage(base64, requestId) {
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
        const base64 = await generateWithYandexART(prompt);
        const imageUrl = await saveImage(base64, requestId);

        await query(
            `UPDATE bouquets
             SET image_url = $1,
                 generation_status = 'completed'
             WHERE generation_request_id = $2`,
            [imageUrl, requestId]
        );

        console.log(`✅ Изображение сохранено для заказа ${token}: ${imageUrl}`);
    } catch (err) {
        console.error('❌ Ошибка сохранения изображения:', err);
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
ГЕНЕРАЦИЯ ИНДИВИДУАЛЬНОЙ ССЫЛКИ
========================
*/

app.post('/api/create-session', async (req, res) => {
    try {
        const { telegramUserId, telegramUsername } = req.body;
        
        const shareToken = uuidv4();
        
        const result = await query(
            `INSERT INTO sessions 
             (share_token, telegram_user_id, telegram_username, status)
             VALUES ($1, $2, $3, 'pending')
             RETURNING id, share_token`,
            [shareToken, telegramUserId || null, telegramUsername || null]
        );
        
        const sessionId = result.rows[0].id;
        const token = result.rows[0].share_token;
        const shareUrl = `${SITE_URL}/quiz/${token}`;
        
        res.json({
            success: true,
            sessionId,
            token,
            shareUrl
        });
        
    } catch (err) {
        console.error('❌ Ошибка создания сессии:', err);
        res.status(500).json({ error: 'Не удалось создать сессию' });
    }
});

/*
========================
СОХРАНЕНИЕ ОТВЕТОВ ТЕСТА
========================
*/

app.post('/api/save-answers', async (req, res) => {
    try {
        const { token, answers } = req.body;

        await query(
            `UPDATE sessions SET
             occasion = $1,
             recipient_person_type = $2,
             mood = $3,
             color_preferences = $4,
             flower_preferences = $5,
             budget_range = $6,
             note_text = $7,
             status = 'completed',
             completed_at = NOW()
             WHERE share_token = $8`,
            [
                answers.occasion,
                answers.forWhom,
                answers.mood || 'happy',
                answers.colors,
                answers.favoriteFlowersText,
                answers.budget || 'medium',
                answers.noteText,
                token
            ]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('❌ Ошибка сохранения ответов:', err);
        res.status(500).json({ error: 'Ошибка сохранения' });
    }
});

/*
========================
ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЯ
========================
*/

app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, requestId, token } = req.body;
        const id = requestId || uuidv4();

        // Получаем session_id по токену
        const sessionResult = await query(
            `SELECT id FROM sessions WHERE share_token = $1`,
            [token]
        );

        if (!sessionResult.rows.length) {
            return res.status(404).json({ error: 'Сессия не найдена' });
        }

        const sessionId = sessionResult.rows[0].id;

        // Сохраняем информацию о генерации
        await query(
            `INSERT INTO bouquets
             (session_id, prompt_text, generation_request_id, generation_status)
             VALUES($1, $2, $3, 'pending')
             RETURNING id`,
            [sessionId, prompt, id]
        );

        // Запускаем генерацию (не ждем)
        generateAndSaveImage(prompt, id, token).catch(console.error);

        res.json({
            success: true,
            requestId: id,
            message: 'Генерация запущена'
        });

    } catch (err) {
        console.error('❌ Ошибка генерации:', err);
        res.status(500).json({ error: 'Ошибка генерации' });
    }
});

async function generateAndSaveImage(prompt, requestId, token) {
    try {
        const base64 = await generateWithYandexART(prompt);
        const imageUrl = await saveImage(base64, requestId);

        await query(
            `UPDATE bouquets
             SET image_url = $1,
                 generation_status = 'completed'
             WHERE generation_request_id = $2`,
            [imageUrl, requestId]
        );

        console.log(`✅ Изображение сохранено: ${imageUrl}`);
    } catch (err) {
        console.error('❌ Ошибка сохранения изображения:', err);
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

        // Записываем клик по ссылке
        await query(
            `INSERT INTO link_clicks(session_id, ip_address, user_agent, referer)
             VALUES($1, $2, $3, $4)`,
            [session.id, req.ip, req.headers['user-agent'], req.get('Referer')]
        );

        res.json(session);
    } catch (err) {
        console.error('❌ Ошибка получения результатов:', err);
        res.status(500).json({ error: 'Ошибка загрузки' });
    }
});

/*
========================
СТАТУС ГЕНЕРАЦИИ
========================
*/

app.get('/api/generation-status/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;

        const result = await query(
            `SELECT generation_status as status, image_url
             FROM bouquets
             WHERE generation_request_id = $1`,
            [requestId]
        );

        if (!result.rows.length) {
            return res.json({ status: 'pending' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('❌ Ошибка статуса:', err);
        res.status(500).json({ error: 'Ошибка проверки статуса' });
    }
});

/*
========================
ВЫБОР БУКЕТА
========================
*/

app.post('/api/select-bouquet', async (req, res) => {
    try {
        const { bouquetId, token } = req.body;

        // Сбрасываем выбор для всех букетов сессии и выбираем новый
        await transaction(async (client) => {
            await client.query(
                `UPDATE bouquets 
                 SET is_selected = false
                 WHERE session_id = (SELECT id FROM sessions WHERE share_token = $1)`,
                [token]
            );

            await client.query(
                `UPDATE bouquets 
                 SET is_selected = true, selected_at = NOW()
                 WHERE id = $1`,
                [bouquetId]
            );
        });

        res.json({ success: true });
    } catch (err) {
        console.error('❌ Ошибка выбора букета:', err);
        res.status(500).json({ error: 'Ошибка выбора букета' });
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

            // Создаем заказ
            const orderResult = await client.query(
                `INSERT INTO orders (
                    session_id, bouquet_id, customer_name, customer_phone,
                    customer_email, delivery_address, delivery_date,
                    delivery_comment, order_status, source_url
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
                 RETURNING id, order_number`,
                [
                    session.session_id,
                    session.bouquet_id,
                    customerName,
                    customerPhone,
                    customerEmail || null,
                    deliveryAddress || null,
                    deliveryDate || null,
                    deliveryComment || null,
                    req.get('Referer') || SITE_URL
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

        // Отправляем уведомление в Telegram
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID) {
            await sendTelegramNotification({
                orderNumber: result.order_number,
                customerName,
                customerPhone,
                customerEmail
            });
        }

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
УВЕДОМЛЕНИЯ В TELEGRAM
========================
*/

async function sendTelegramNotification(orderData) {
    try {
        const message = `
🆕 **Новый заказ!** #${orderData.orderNumber}

👤 **Клиент:** ${orderData.customerName}
📞 **Телефон:** ${orderData.customerPhone}
${orderData.customerEmail ? `📧 **Email:** ${orderData.customerEmail}` : ''}

🔗 [Посмотреть в админке](${SITE_URL}/admin/order/${orderData.orderNumber})
        `;

        await axios.post(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID,
                text: message,
                parse_mode: 'Markdown',
                disable_web_page_preview: false
            }
        );
    } catch (err) {
        console.error('❌ Ошибка отправки уведомления:', err.message);
    }
}

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
ПРОВЕРКА СТАТУСА ЗАКАЗА ДЛЯ ОЖИДАНИЯ РЕЗУЛЬТАТОВ ИЗ TELEGRAM
========================
*/

app.get('/api/check-order/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        console.log(`🔍 Проверка статуса заказа: ${orderId}`);
        
        // Ищем сессию по orderId (share_token)
        const result = await query(
            `SELECT s.*, 
                    b.id as bouquet_id, 
                    b.image_url, 
                    b.generation_status,
                    b.generation_request_id
             FROM sessions s
             LEFT JOIN bouquets b ON s.id = b.session_id
             WHERE s.share_token = $1
             ORDER BY b.created_at DESC
             LIMIT 1`,
            [orderId]
        );

        if (result.rows.length === 0) {
            console.log(`⚠️ Сессия не найдена для orderId: ${orderId}`);
            return res.json({ 
                status: 'pending',
                exists: false 
            });
        }

        const session = result.rows[0];
        console.log(`📊 Статус сессии:`, {
            status: session.status,
            generation_status: session.generation_status,
            has_image: !!session.image_url
        });
        
        // Проверяем статус
        if (session.image_url) {
            return res.json({
                status: 'completed',
                imageUrl: session.image_url,
                sessionData: session
            });
        } else if (session.generation_status === 'completed' && session.image_url) {
            return res.json({
                status: 'completed',
                imageUrl: session.image_url,
                sessionData: session
            });
        } else if (session.generation_status === 'pending') {
            return res.json({
                status: 'generating',
                message: 'Генерация в процессе'
            });
        } else if (session.status === 'completed') {
            return res.json({
                status: 'test_completed',
                message: 'Тест пройден, ожидание генерации'
            });
        } else {
            return res.json({
                status: 'pending',
                message: 'Ожидание прохождения теста'
            });
        }

    } catch (err) {
        console.error('❌ Ошибка проверки заказа:', err);
        res.status(500).json({ error: err.message });
    }
});

/*
========================
ПОЛУЧЕНИЕ РЕЗУЛЬТАТОВ ТЕСТА ИЗ TELEGRAM БОТА
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

        let sessionId;

        // Обновляем сессию с результатами теста
        const updateResult = await query(
            `UPDATE sessions SET
             occasion = $1,
             recipient_person_type = $2,
             mood = $3,
             color_preferences = $4,
             flower_preferences = $5,
             telegram_user_id = $6,
             telegram_username = $7,
             status = 'completed',
             completed_at = NOW()
             WHERE share_token = $8
             RETURNING id`,
            [
                'telegram_test',
                profile?.form || 'self',
                profile?.mood || 'happy',
                profile?.color || 'pastel',
                profile?.flower || 'mixed',
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
                 (share_token, telegram_user_id, telegram_username, status, completed_at)
                 VALUES ($1, $2, $3, 'completed', NOW())
                 RETURNING id`,
                [session_token, telegram_id ? String(telegram_id) : null, telegram_name || null]
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
             (session_id, prompt_text, generation_status, generation_request_id)
             VALUES($1, $2, 'pending', $3)`,
            [sessionId, ai_prompt, requestId]
        );

        console.log('📝 Сохранен промпт для генерации, requestId:', requestId);

        // Запускаем генерацию в фоне
        generateAndSaveImage(ai_prompt, requestId, session_token).catch(error => {
            console.error('❌ Ошибка в фоновой генерации:', error);
        });

        res.json({ 
            success: true,
            message: 'Результаты сохранены',
            requestId: requestId
        });

    } catch (err) {
        console.error('❌ Ошибка сохранения результатов:', err);
        res.status(500).json({ error: err.message });
    }
});


/*
========================
ГЛАВНАЯ СТРАНИЦА
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
// ПОЛУЧЕНИЕ СТАТУСА ТЕСТА И ГЕНЕРАЦИИ ПО ТОКЕНУ
app.get('/api/quiz-status/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        console.log(`🔍 Проверка статуса для токена: ${token}`);
        
        // Получаем информацию о сессии и букете
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
                s.flower_preferences,
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
        
        // Определяем статус для фронтенда
        let responseStatus = {
            token: token,
            session_id: session.session_id,
            test_completed: !!session.completed_at,
            session_status: session.session_status,
            has_generation: !!session.bouquet_id,
            timestamp: new Date().toISOString()
        };

        // Если тест не пройден
        if (!session.completed_at) {
            responseStatus.status = 'test_pending';
            responseStatus.message = 'Ожидание прохождения теста в Telegram';
        } 
        // Если тест пройден, но генерация еще не началась
        else if (!session.bouquet_id) {
            responseStatus.status = 'generation_pending';
            responseStatus.message = 'Тест пройден, подготовка генерации...';
        }
        // Если генерация в процессе
        else if (session.generation_status === 'pending') {
            responseStatus.status = 'generating';
            responseStatus.message = 'Генерация вашего уникального букета...';
            responseStatus.generation_request_id = session.generation_request_id;
            responseStatus.generation_started = session.generation_started_at;
        }
        // Если генерация завершена
        else if (session.generation_status === 'completed' && session.image_url) {
            responseStatus.status = 'ready';
            responseStatus.message = 'Ваш букет готов!';
            responseStatus.image_url = session.image_url;
            responseStatus.bouquet_id = session.bouquet_id;
            responseStatus.profile = {
                occasion: session.occasion,
                person_type: session.recipient_person_type,
                mood: session.mood,
                color: session.color_preferences,
                flower: session.flower_preferences
            };
        }
        // Если генерация не удалась
        else if (session.generation_status === 'failed') {
            responseStatus.status = 'failed';
            responseStatus.message = 'Не удалось сгенерировать букет. Пожалуйста, попробуйте позже.';
        }

        // Логируем для отладки
        console.log(`📊 Статус для токена ${token}:`, {
            status: responseStatus.status,
            test_completed: responseStatus.test_completed,
            generation_status: session.generation_status
        });

        res.json(responseStatus);

    } catch (err) {
        console.error('❌ Ошибка проверки статуса:', err);
        res.status(500).json({ 
            status: 'error',
            error: err.message 
        });
    }
});

// Проверка существования сессии по токену
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
ЗАПУСК СЕРВЕРА
========================
*/

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 FloraAI server running

📡 URL: http://0.0.0.0:${PORT}
🌐 Доступно из сети по IP: http://10.20.130.157:${PORT}
🔌 PORT: ${PORT}

📋 Endpoints:
   POST   /api/create-session       - Создать сессию
   POST   /api/save-answers         - Сохранить ответы
   POST   /api/generate             - Сгенерировать букет
   GET    /api/session-results/:token - Получить результаты
   POST   /api/select-bouquet       - Выбрать букет
   POST   /api/create-order         - Создать заказ
   GET    /api/order/:number        - Информация о заказе
   GET    /api/admin/stats          - Статистика
   GET    /api/test                 - Проверка сервера
   GET    /api/test-db              - Проверка БД

📊 База данных: Timeweb PostgreSQL
   ${process.env.DATABASE_URL?.replace(/:[^:]*@/, ':*****@')}
`);
});