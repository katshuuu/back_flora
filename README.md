# FloraAI Backend

Серверная часть для **FloraAI** — персонального флориста на основе искусственного интеллекта. Приложение генерирует уникальные цветочные композиции по текстовому описанию пользователя, используя **YandexART API** для создания изображений и **Cloudinary** для их хранения.

## Функциональность🚀 :

- Приём текстового запроса (промпта) от фронтенда
- Генерация изображения через YandexART (асинхронно)
- Сохранение результата в Cloudinary и возврат публичного URL
- Проверка статуса генерации по `requestId` или `orderId`
- Тестовые эндпоинты для проверки интеграций

## Технологии🛠 :

- Node.js + Express
- Axios (HTTP-запросы)
- Cloudinary SDK
- dotenv (конфигурация)
- fs-extra (работа с временными файлами)
- UUID для идентификаторов

## Установка и запуск локально

1. Клонировать репозиторий:
   ```bash
   git clone https://github.com/katshuuu/floramind_project.git
   cd backend
   ```

2. Установить зависимости:
   ```bash
   npm install
   ```

3. Создать файл `.env` в корне проекта (см. ниже)

4. Запустить сервер:
   ```bash
   npm start
   ```
   Для разработки с автоперезагрузкой:
   ```bash
   npm run dev
   ```

Сервер будет доступен по адресу `http://localhost:3001` (порт настраивается).

## 🔐 Переменные окружения (`.env`)

| Переменная | Описание |
|------------|----------|
| `PORT` | Порт сервера (по умолчанию 3001) |
| `YANDEX_FOLDER_ID` | ID каталога в Yandex Cloud |
| `YANDEX_API_KEY` | API‑ключ для Yandex Cloud |
| `CLOUDINARY_CLOUD_NAME` | Имя облака Cloudinary |
| `CLOUDINARY_API_KEY` | API‑ключ Cloudinary |
| `CLOUDINARY_API_SECRET` | Секрет Cloudinary |
| `SITE_URL` | Базовый URL для локальных ссылок (опционально) |

Пример:
```env
PORT=3001
YANDEX_FOLDER_ID=b1g...
YANDEX_API_KEY=AQVN...
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=123456
CLOUDINARY_API_SECRET=abc123
```

## 🧩 API Эндпоинты

### 1. `POST /api/save-prompt`
Сохраняет промпт для последующей генерации.

**Тело запроса:**
```json
{
  "requestId": "uuid",
  "prompt": "string",
  "orderId": "string" // опционально
}
```

**Ответ:** `{ success: true, requestId }`

---

### 2. `POST /api/generate`
Запускает генерацию изображения.

**Тело запроса:**
```json
{
  "prompt": "string",
  "orderId": "string",   // опционально
  "requestId": "string"  // опционально
}
```

**Ответ:**
```json
{
  "success": true,
  "requestId": "uuid",
  "imageUrl": "https://res.cloudinary.com/...",
  "orderId": "string"
}
```

---

### 3. `GET /api/generation-status/:requestId`
Возвращает статус генерации по `requestId`.

**Ответ:**
- Если готово: `{ status: "completed", imageUrl: "..." }`
- Если в процессе: `{ status: "processing" }` (или `pending`)

---

### 4. `GET /api/check-order/:orderId`
Проверяет статус заказа по `orderId`.

**Ответ:** аналогично предыдущему.

---

### 5. `GET /api/test`
Тестовый эндпоинт для проверки работы сервера.

**Ответ:**
```json
{
  "status": "✅ FloraAI server is running!",
  "yandexIntegration": "YandexART API",
  "cloudinaryIntegration": "Cloudinary",
  "siteUrl": "http://localhost:3001"
}
```

---

### 6. `GET /api/test-cloudinary`
Проверяет подключение к Cloudinary.

**Ответ:**
```json
{
  "success": true,
  "message": "✅ Cloudinary работает",
  "testUrl": "https://res.cloudinary.com/..."
}
```

---

### 7. `GET /api/test-connection`
Проверяет соединение с Yandex Cloud API.

**Ответ:**
```json
{
  "success": true,
  "message": "✅ Соединение с Yandex Cloud установлено",
  "folderId": "b1g..."
}
```

---

### 8. `GET /health`
Health‑check для контейнерных сред (например, Timeweb Cloud).

**Ответ:** `{ status: "healthy" }` или `{ status: "OK", timestamp: ... }`

---

### 9. `GET /`
Отдаёт `index.html` из папки `public` (фронтенд‑часть, если она собрана в этой же директории).

## 📁 Структура проекта

```
backend/
├── public/                  # статические файлы (фронтенд)
│   └── index.html
├── server.js                # основной файл сервера
├── package.json
├── .env                     # переменные окружения (не в репозитории)
└── README.md
```

## 🌐 Деплой

### На Timeweb Cloud (или другой облачной платформе)

1. Убедитесь, что в `.env` заданы все необходимые переменные.
2. В настройках приложения укажите команду запуска: `node server.js`.
3. Откройте порт `3001` (или используйте прокси на 80/443).
4. Health‑check эндпоинт: `/health`.

После деплоя сервер будет доступен по внешнему URL без указания порта (если настроен прокси).
