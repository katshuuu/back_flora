-- Таблица сессий (результаты теста)
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    share_token VARCHAR(100) UNIQUE NOT NULL,
    telegram_user_id VARCHAR(255),
    telegram_username VARCHAR(255),
    
    -- Ответы на тест
    occasion VARCHAR(100),
    recipient_person_type VARCHAR(50),
    mood VARCHAR(100),
    color_preferences TEXT,
    flower_preferences TEXT,
    budget_range VARCHAR(50),
    note_text TEXT,
    
    -- Статусы
    status VARCHAR(20) DEFAULT 'pending',
    recipient_type VARCHAR(20) DEFAULT 'self',
    
    -- Временные метки
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    ordered_at TIMESTAMP,
    
    -- Статистика
    views_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMP
);

-- Таблица букетов (сгенерированные изображения)
CREATE TABLE IF NOT EXISTS bouquets (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    image_url VARCHAR(500),
    prompt_text TEXT,
    generation_status VARCHAR(20) DEFAULT 'pending',
    generation_request_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Для выбора букета
    is_selected BOOLEAN DEFAULT FALSE,
    selected_at TIMESTAMP
);

-- Таблица заказов
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    session_id INTEGER REFERENCES sessions(id),
    bouquet_id INTEGER REFERENCES bouquets(id),
    
    -- Данные клиента
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    delivery_address TEXT,
    delivery_date TIMESTAMP,
    delivery_comment TEXT,
    
    -- Детали заказа
    order_status VARCHAR(50) DEFAULT 'pending',
    
    -- Временные метки
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица переходов по ссылкам
CREATE TABLE IF NOT EXISTS link_clicks (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id),
    clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    referer TEXT
);

-- Таблица для отслеживания просмотров букетов
CREATE TABLE IF NOT EXISTS bouquet_views (
    id SERIAL PRIMARY KEY,
    bouquet_id INTEGER REFERENCES bouquets(id),
    session_id INTEGER REFERENCES sessions(id),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(share_token);
CREATE INDEX IF NOT EXISTS idx_sessions_telegram ON sessions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_bouquets_request ON bouquets(generation_request_id);
CREATE INDEX IF NOT EXISTS idx_bouquets_session ON bouquets(session_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(session_id);
CREATE INDEX IF NOT EXISTS idx_clicks_session ON link_clicks(session_id);

-- Функция для обновления времени updated_at (без использования триггеров)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at в заказах
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Функция для генерации номера заказа
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $func$
BEGIN
    NEW.order_number = 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEW.id::TEXT, 6, '0');
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Триггер для генерации номера заказа
DROP TRIGGER IF EXISTS generate_order_number_trigger ON orders;
CREATE TRIGGER generate_order_number_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION generate_order_number();

-- Функция для подсчета просмотров сессии
CREATE OR REPLACE FUNCTION update_session_views()
RETURNS TRIGGER AS $func$
BEGIN
    UPDATE sessions 
    SET views_count = views_count + 1,
        last_viewed_at = CURRENT_TIMESTAMP
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Триггер для обновления счетчика просмотров
DROP TRIGGER IF EXISTS update_session_views_trigger ON link_clicks;
CREATE TRIGGER update_session_views_trigger
    AFTER INSERT ON link_clicks
    FOR EACH ROW
    EXECUTE FUNCTION update_session_views();