const state = {
    currentStep: 'recipientChoice',
    recipientType: null,
    currentQuestion: 0,
    answers: {
        forWhom: null,
        age: null,
        colors: null,
        note: null,
        occasion: null,
        favoriteFlowers: null,
        favoriteFlowersText: null,
        noteText: null
    },
    isGenerating: false,
    isWaitingForNoteText: false,
    isWaitingForFavoriteFlowers: false,
    isWaitingForOrderAction: false, // Новый флаг для ожидания действия после генерации
    currentImageUrl: null,
    orderId: null,
    generationRequestId: null
};
// ДОБАВЛЯЕМ: глобальные переменные для отслеживания статуса
let sessionToken = null;
let pollingInterval = null;

// ДОБАВЛЯЕМ: функция для сохранения токена сессии
function setSessionToken(token) {
    sessionToken = token;
    localStorage.setItem('currentSessionToken', token);
    console.log('🔑 Токен сессии сохранен:', token);
}

// ДОБАВЛЯЕМ: функция для проверки статуса теста
async function checkTestStatus(token) {
    try {
        const response = await fetch(`/api/quiz-status/${token}`);
        const data = await response.json();
        
        console.log('📊 Статус теста:', data);
        
        // Обновляем UI в зависимости от статуса
        updateTestStatusUI(data);
        
        return data;
    } catch (error) {
        console.error('❌ Ошибка проверки статуса:', error);
        return null;
    }
}

// ДОБАВЛЯЕМ: функция обновления UI статуса теста
function updateTestStatusUI(statusData) {
    // Находим или создаем индикатор статуса
    let statusIndicator = document.getElementById('testStatusIndicator');
    
    if (!statusIndicator) {
        statusIndicator = document.createElement('div');
        statusIndicator.id = 'testStatusIndicator';
        statusIndicator.className = 'test-status-indicator';
        document.querySelector('.chat-container').appendChild(statusIndicator);
    }
    
    // Обновляем содержимое в зависимости от статуса
    switch(statusData.status) {
        case 'test_pending':
            statusIndicator.innerHTML = `
                <div class="status-info pending">
                    <i class="fas fa-clock"></i>
                    <span>⏳ Ожидание прохождения теста в Telegram...</span>
                </div>
            `;
            break;
            
        case 'generation_pending':
        case 'generating':
            statusIndicator.innerHTML = `
                <div class="status-info generating">
                    <i class="fas fa-palette fa-spin"></i>
                    <span>🎨 Генерация вашего букета...</span>
                </div>
            `;
            break;
            
        case 'ready':
            statusIndicator.innerHTML = `
                <div class="status-info ready">
                    <i class="fas fa-check-circle"></i>
                    <span>✅ Букет готов! Обновите страницу или подождите...</span>
                </div>
            `;
            break;
            
        case 'failed':
            statusIndicator.innerHTML = `
                <div class="status-info failed">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>❌ Ошибка генерации. Попробуйте позже.</span>
                </div>
            `;
            break;
    }
}

// ДОБАВЛЯЕМ: функция запуска опроса статуса
function startStatusPolling(token) {
    // Останавливаем предыдущий опрос если был
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    // Проверяем статус сразу
    checkTestStatus(token);
    
    // Запускаем периодическую проверку
    pollingInterval = setInterval(async () => {
        const status = await checkTestStatus(token);
        
        // Если букет готов - останавливаем опрос и показываем результат
        if (status && status.status === 'ready' && status.image_url) {
            clearInterval(pollingInterval);
            pollingInterval = null;
            
            // Добавляем сообщение о готовности в чат
            addMessage(`✨ Ваш уникальный букет готов!`, false);
            
            // Показываем изображение в чате
            setTimeout(() => {
                showBouquetInChat(status.image_url);
            }, 1000);
        }
        
        // Если ошибка - тоже останавливаем
        if (status && status.status === 'failed') {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }, 3000); // Проверяем каждые 3 секунды
}

// ДОБАВЛЯЕМ: функция показа букета в чате
function showBouquetInChat(imageUrl) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message bouquet-message';
    messageDiv.innerHTML = `
        <div class="message-header">
            <i class="fas fa-spa"></i>
            <span>FloraAI</span>
        </div>
        <div class="bouquet-result">
            <div class="bouquet-image-container">
                <img src="${imageUrl}" alt="Ваш букет" class="bouquet-image">
            </div>
            <p class="bouquet-caption">🌸 Ваш персональный букет, созданный специально для вас!</p>
            <button class="order-bouquet-btn" onclick="askOrderQuestion()">
                <i class="fas fa-shopping-cart"></i> Заказать этот букет
            </button>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// МОДИФИЦИРУЕМ: функцию showSelfTestMessage
function showSelfTestMessage() {
    const typingIndicator = showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        
        // Создаем токен сессии
        state.orderId = 'self_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        setSessionToken(state.orderId);
        
        const testLink = `https://t.me/${TELEGRAM_BOT_LINK.replace('@', '')}?start=${state.orderId}`;
        
        const message = `Мы предлагаем вам пройти небольшой тест для составления описания букета и его генерации. На основе полученных результатов я покажу, как выглядит Ваш индивидуальный и неповторимый букет!💐\n\n`;
        
        const messageDiv = addMessage(message, false);
        
        const linkDiv = document.createElement('div');
        linkDiv.className = 'test-link-container';
        linkDiv.innerHTML = `
            <p><strong>Ссылка на прохождение теста:</strong></p>
            <div class="link-box">
                <a href="${testLink}" target="_blank">${testLink}</a>
                <button class="copy-link-btn" onclick="copyToClipboard('${testLink}')">
                    <i class="fas fa-copy"></i> Копировать
                </button>
            </div>
            <p class="bot-info">Перейдите по ссылке и пройдите тест в Telegram боте</p>
        `;
        messageDiv.appendChild(linkDiv);
        
        addMessage(`После прохождения теста я автоматически покажу результат здесь! 🎨`, false);
        
        state.currentStep = 'waitingForRecipient';
        creationProgress.style.display = 'none';
        
        // ЗАПУСКАЕМ ОПРОС СТАТУСА
        startStatusPolling(state.orderId);
        
    }, 1000);
}

// МОДИФИЦИРУЕМ: функцию showRecipientTestMessage
function showRecipientTestMessage() {
    const typingIndicator = showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        
        state.orderId = 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        setSessionToken(state.orderId);
        
        const testLink = `https://t.me/${TELEGRAM_BOT_LINK.replace('@', '')}?start=${state.orderId}`;
        
        const message = `Отлично! Отправьте эту ссылку получателю букета. Он должен пройти небольшой тест, чтобы мы могли создать идеальный букет именно для него! 🌸\n\n`;
        
        const messageDiv = addMessage(message, false);
        
        const linkDiv = document.createElement('div');
        linkDiv.className = 'test-link-container';
        linkDiv.innerHTML = `
            <p><strong>Ссылка для получателя:</strong></p>
            <div class="link-box">
                <a href="${testLink}" target="_blank">${testLink}</a>
                <button class="copy-link-btn" onclick="copyToClipboard('${testLink}')">
                    <i class="fas fa-copy"></i> Копировать
                </button>
            </div>
        `;
        messageDiv.appendChild(linkDiv);
        
        addMessage(`Я буду следить за прохождением теста и покажу результат здесь! 🔍`, false);
        
        state.currentStep = 'waitingForRecipient';
        creationProgress.style.display = 'none';
        
        // ЗАПУСКАЕМ ОПРОС СТАТУСА
        startStatusPolling(state.orderId);
        
    }, 1000);
}

// ДОБАВЛЯЕМ: проверку при загрузке страницы (если есть сохраненный токен)
window.addEventListener('load', function() {
    // Проверяем, есть ли сохраненный токен сессии
    const savedToken = localStorage.getItem('currentSessionToken');
    if (savedToken) {
        console.log('🔄 Найден сохраненный токен:', savedToken);
        // Проверяем статус
        startStatusPolling(savedToken);
    }
});
// Вопросы для опроса
const questions = [
    {
        id: 'forWhom',
        text: 'Для кого букет?',
        options: [
            { text: 'Для жены/мужа', icon: 'fas fa-heart', value: 'супруг(а)' },
            { text: 'Для мамы/папы', icon: 'fas fa-home', value: 'родитель' },
            { text: 'Для девушки/парня', icon: 'fas fa-user-friends', value: 'возлюбленный(ая)' },
            { text: 'Коллеге на день рождения', icon: 'fas fa-briefcase', value: 'коллега' },
            { text: 'Подруге/другу', icon: 'fas fa-user', value: 'друг' },
            { text: 'Себе в офис/домой', icon: 'fas fa-building', value: 'себе' }
        ]
    },
    {
        id: 'occasion',
        text: 'Какой повод для букета? 💐',
        options: [
            { text: '8 марта', icon: 'fas fa-female', value: '8 марта' },
            { text: 'Свадьба', icon: 'fas fa-ring', value: 'свадьба' },
            { text: 'День рождения', icon: 'fas fa-birthday-cake', value: 'день рождения' },
            { text: 'Годовщина отношений', icon: 'fas fa-heart', value: 'годовщина' },
            { text: 'Просто так/без повода', icon: 'fas fa-surprise', value: 'без повода' },
            { text: 'Извинение', icon: 'fas fa-dove', value: 'извинение' }
        ]
    },
    {
        id: 'age',
        text: 'Какой возраст получателя?',
        options: [
            { text: 'Ребенок (до 12 лет)', icon: 'fas fa-child', value: 'ребенок' },
            { text: 'Подросток (13-19 лет)', icon: 'fas fa-user-graduate', value: 'подросток' },
            { text: 'Молодой (20-35 лет)', icon: 'fas fa-user', value: 'молодой' },
            { text: 'Взрослый (36-55 лет)', icon: 'fas fa-user-tie', value: 'взрослый' },
            { text: 'Пожилой (55+)', icon: 'fas fa-user-friends', value: 'пожилой' },
            { text: 'Не важно', icon: 'fas fa-times', value: 'не важно' }
        ]
    },
    {
        id: 'colors',
        text: 'Какие цвета предпочтительны?',
        options: [
            { text: 'Нежные пастельные', icon: 'fas fa-pastafarianism', value: 'пастельные' },
            { text: 'Яркие и сочные', icon: 'fas fa-fire', value: 'яркие' },
            { text: 'Бело-зеленые', icon: 'fas fa-leaf', value: 'бело-зеленые' },
            { text: 'Красные/бордовые', icon: 'fas fa-heart', value: 'красные' },
            { text: 'Розовые', icon: 'fas fa-heart', value: 'розовые' },
            { text: 'Синие/фиолетовые', icon: 'fas fa-moon', value: 'синие' }
        ]
    },
    {
        id: 'favoriteFlowers',
        text: 'Есть ли любимые цветы?',
        options: [
            { text: 'Да', icon: 'fas fa-check', value: 'да' },
            { text: 'Нет', icon: 'fas fa-times', value: 'нет' }
        ]
    },
    {
        id: 'note',
        text: 'Нужна ли записка к букету?',
        options: [
            { text: 'Да, с текстом "С днем рождения!"', icon: 'fas fa-birthday-cake', value: 'с днем рождения' },
            { text: 'Да, с романтичным текстом', icon: 'fas fa-heart', value: 'романтичная' },
            { text: 'Да, со своим текстом', icon: 'fas fa-pen', value: 'своя' },
            { text: 'Да, стандартная открытка', icon: 'fas fa-envelope', value: 'стандартная' },
            { text: 'Нет, записка не нужна', icon: 'fas fa-times', value: 'нет' },
            { text: 'Пока не знаю', icon: 'fas fa-question', value: 'не знаю' }
        ]
    }
];

// Элементы DOM
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const closeBtn = document.getElementById('closeBtn');
const chatInputContainer = document.getElementById('chatInputContainer');
const creationProgress = document.getElementById('creationProgress');
const progressFill = document.getElementById('progressFill');
const progressStep = document.getElementById('progressStep');
const root = document.documentElement;

// Конфигурация
const SITE_URL = window.location.origin;
const TELEGRAM_BOT_LINK = '@YourVibeCheck_Bot';

// Функция для обновления прогресс-бара
function updateProgressBar() {
    const totalQuestions = 6;
    const progress = ((state.currentQuestion) / totalQuestions) * 100;
    root.style.setProperty('--progress', `${progress}%`);
    progressFill.style.width = `${progress}%`;
    progressStep.textContent = state.currentQuestion === totalQuestions ? 'Генерация букета...' : `Вопрос ${state.currentQuestion + 1} из ${totalQuestions}`;
}

// Функция для показа индикатора набора
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return typingDiv;
}

// Функция для удаления индикатора набора
function removeTypingIndicator(typingElement) {
    if (typingElement && typingElement.parentNode) {
        typingElement.remove();
    }
}

// Функция для добавления сообщения в чат
function addMessage(text, isUser = false, options = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;

    let messageHTML = `
        <div class="message-header">
            <i class="fas ${isUser ? 'fa-user' : 'fa-spa'}"></i>
            <span>${isUser ? 'Вы' : 'FloraAI'}</span>
        </div>
        <p>${text}</p>
    `;

    if (options && !isUser) {
        messageHTML += `
            <div class="options-container">
                <div class="options-title">Выберите подходящий вариант:</div>
                <div class="options-grid" id="optionsGrid">
        `;

        options.forEach((option, index) => {
            messageHTML += `
                <button class="option-btn" data-index="${index}" data-value="${option.value}">
                    <div class="option-icon">
                        <i class="${option.icon}"></i>
                    </div>
                    ${option.text}
                </button>
            `;
        });

        messageHTML += `
                </div>
            </div>
        `;
    }

    messageDiv.innerHTML = messageHTML;
    chatMessages.appendChild(messageDiv);

    if (options && !isUser) {
        setTimeout(() => {
            const optionButtons = messageDiv.querySelectorAll('.option-btn');
            optionButtons.forEach(button => {
                button.addEventListener('click', function () {
                    const index = parseInt(this.getAttribute('data-index'));
                    const value = this.getAttribute('data-value');

                    optionButtons.forEach(btn => btn.classList.remove('selected'));
                    this.classList.add('selected');

                    handleOptionSelect(value);
                });
            });
        }, 100);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

// Функция для создания кнопок выбора
function createChoiceButtons(buttons) {
    const container = document.createElement('div');
    container.className = 'options-container';
    
    const grid = document.createElement('div');
    grid.className = 'options-grid';
    
    buttons.forEach(button => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `
            <div class="option-icon">
                <i class="${button.icon}"></i>
            </div>
            ${button.text}
        `;
        btn.addEventListener('click', () => button.action());
        grid.appendChild(btn);
    });
    
    container.appendChild(grid);
    return container;
}

// Функция для отправки промпта на сервер
async function sendPromptToServer(prompt, orderId) {
    const requestId = 'gen_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    state.generationRequestId = requestId;
    
    try {
        await fetch(`${SITE_URL}/api/save-prompt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requestId,
                prompt,
                orderId,
                timestamp: Date.now()
            })
        });

        const response = await fetch(`${SITE_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt,
                orderId,
                requestId
            })
        });

        const data = await response.json();
        
        if (data.success) {
            return { requestId: data.requestId };
        } else {
            throw new Error(data.error || 'Generation failed');
        }
    } catch (error) {
        console.error('Error sending prompt to server:', error);
        throw error;
    }
}

// Функция для проверки статуса генерации
async function checkGenerationStatus(requestId) {
    try {
        const response = await fetch(`${SITE_URL}/api/generation-status/${requestId}`);
        const data = await response.json();
        
        if (data.status === 'completed' && data.imageUrl) {
            return {
                completed: true,
                imageUrl: data.imageUrl
            };
        } else if (data.status === 'failed') {
            throw new Error('Generation failed');
        }
        
        return { completed: false };
    } catch (error) {
        console.error('Error checking generation status:', error);
        throw error;
    }
}

// Функция для ожидания генерации
async function waitForGeneration(requestId) {
    const maxAttempts = 60;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        try {
            const result = await checkGenerationStatus(requestId);
            
            if (result.completed) {
                return result;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
            
        } catch (error) {
            console.error('Error waiting for generation:', error);
            throw error;
        }
    }
    
    throw new Error('Timeout: Generation took too long');
}

// Функция для показа сообщения о тесте для себя
function showSelfTestMessage() {
    const typingIndicator = showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        
        state.orderId = 'self_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const testLink = `https://t.me/${TELEGRAM_BOT_LINK.replace('@', '')}?start=test_${state.orderId}`;
        
        const message = `Мы предлагаем вам пройти небольшой тест для составления описания букета и его генерации. На основе полученных результатов я покажу, как выглядит Ваш индивидуальный и неповторимый букет!💐\n\n`;
        
        const messageDiv = addMessage(message, false);
        
        const linkDiv = document.createElement('div');
        linkDiv.className = 'test-link-container';
        linkDiv.innerHTML = `
            <p><strong>Ссылка на прохождение:</strong></p>
            <div class="link-box">
                <a href="${testLink}" target="_blank">${testLink}</a>
                <button class="copy-link-btn" onclick="copyToClipboard('${testLink}')">
                    <i class="fas fa-copy"></i> Копировать
                </button>
            </div>
            <p class="bot-info">Бот для тестирования: ${TELEGRAM_BOT_LINK}</p>
        `;
        messageDiv.appendChild(linkDiv);
        
        addMessage(`Нажмите на ссылку выше, чтобы начать тестирование в боте. После завершения теста я сгенерирую изображение и покажу вам результат! ✨`, false);
        
        state.currentStep = 'waitingForRecipient';
        creationProgress.style.display = 'none';
        
        showWaitingIndicator();
        
        startPollingForResults();
    }, 1000);
}

// Функция для показа сообщения о тесте для получателя
function showRecipientTestMessage() {
    const typingIndicator = showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        
        state.orderId = 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const testLink = `https://t.me/${TELEGRAM_BOT_LINK.replace('@', '')}?start=test_${state.orderId}`;
        
        const message = `Мы предлагаем получателю (адресату букета) пройти небольшой тест для составления описания букета и его генерации. На основе полученных результатов я покажу, как выглядит Ваш индивидуальный и неповторимый букет!💐\n\n`;
        
        const messageDiv = addMessage(message, false);
        
        const linkDiv = document.createElement('div');
        linkDiv.className = 'test-link-container';
        linkDiv.innerHTML = `
            <p><strong>Ссылка на прохождение:</strong></p>
            <div class="link-box">
                <a href="${testLink}" target="_blank">${testLink}</a>
                <button class="copy-link-btn" onclick="copyToClipboard('${testLink}')">
                    <i class="fas fa-copy"></i> Копировать
                </button>
            </div>
            <p class="bot-info">Бот для тестирования: ${TELEGRAM_BOT_LINK}</p>
        `;
        messageDiv.appendChild(linkDiv);
        
        const actionButtons = createChoiceButtons([
            {
                text: 'Хорошо, сейчас отправлю ссылку',
                icon: 'fas fa-check',
                action: () => handleSendLink()
            },
            {
                text: 'Не могу связаться с получателем',
                icon: 'fas fa-times',
                action: () => handleCantReachRecipient()
            }
        ]);
        
        messageDiv.appendChild(actionButtons);
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 1000);
}

// Функция для обработки отправки ссылки
function handleSendLink() {
    addMessage('Хорошо, сейчас отправлю ссылку', true);
    
    const typingIndicator = showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        
        addMessage(`Отлично! Я буду ждать, пока получатель пройдет тест. Как только он завершит тестирование, я сгенерирую изображение и сразу покажу вам результат! 🌸\n\nВы можете следить за статусом здесь.`, false);
        
        showWaitingIndicator();
        
        state.currentStep = 'waitingForRecipient';
        creationProgress.style.display = 'none';
        
        startPollingForResults();
    }, 800);
}

// Функция для периодической проверки результатов
function startPollingForResults() {
    console.log('🔄 Начинаем опрос результатов для orderId:', state.orderId);
    
    const pollInterval = setInterval(async () => {
        // Если состояние изменилось, прекращаем опрос
        if (state.currentStep !== 'waitingForRecipient') {
            console.log('⏹️ Состояние изменилось, прекращаем опрос');
            clearInterval(pollInterval);
            return;
        }
        
        try {
            console.log('📡 Проверка статуса заказа:', state.orderId);
            const response = await fetch(`${SITE_URL}/api/check-order/${state.orderId}`);
            const data = await response.json();
            
            console.log('📊 Статус ответа:', data);
            
            if (data.status === 'completed' && data.imageUrl) {
                console.log('✅ Получен готовый результат!');
                clearInterval(pollInterval);
                
                // Обновляем статус в индикаторе
                const statusSpan = document.querySelector('.waiting-status');
                if (statusSpan) {
                    statusSpan.textContent = 'получены результаты';
                    statusSpan.style.color = '#00b894';
                }
                
                // Показываем сообщение о начале генерации
                setTimeout(() => {
                    const waitingIndicator = document.getElementById('waitingIndicator');
                    if (waitingIndicator) {
                        waitingIndicator.remove();
                    }
                    
                    // Добавляем сообщение о генерации
                    addMessage(`Отлично! Я получила все ваши ответы🌸 Сейчас начинаю генерацию вашего уникального букета...`, false);
                    
                    setTimeout(() => {
                        addMessage(`✅ Запрос на генерацию отправлен! Искусственный интеллект создает ваш букет. Это займет около 30 секунд.`, false);
                        
                        // Показываем новый индикатор ожидания генерации
                        showGenerationWaitingIndicator();
                        
                        // Запускаем проверку статуса генерации
                        startGenerationPolling(state.orderId);
                    }, 1500);
                }, 1000);
            } else if (data.status === 'generating') {
                // Если тест пройден, но генерация еще идет
                const statusSpan = document.querySelector('.waiting-status');
                if (statusSpan) {
                    statusSpan.textContent = 'генерация...';
                    statusSpan.style.color = '#f39c12';
                }
            } else {
                console.log('⏳ Статус ожидания:', data.status);
            }
            
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 3000); // Проверяем каждые 3 секунды
}

// Новая функция для проверки статуса генерации
function startGenerationPolling(orderId) {
    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${SITE_URL}/api/check-order/${orderId}`);
            const data = await response.json();
            
            if (data.status === 'completed' && data.imageUrl) {
                clearInterval(pollInterval);
                
                const waitingIndicator = document.getElementById('generationWaitingIndicator');
                if (waitingIndicator) {
                    waitingIndicator.remove();
                }
                
                showGeneratedBouquet(data.imageUrl);
                
                // После показа букета задаем вопрос о заказе
                setTimeout(() => {
                    askOrderQuestion();
                }, 2000);
            }
        } catch (error) {
            console.error('Generation polling error:', error);
        }
    }, 3000);
}

// Новая функция для показа индикатора ожидания генерации
function showGenerationWaitingIndicator() {
    const waitingDiv = document.createElement('div');
    waitingDiv.className = 'waiting-indicator';
    waitingDiv.id = 'generationWaitingIndicator';
    waitingDiv.innerHTML = `
        <div class="waiting-content">
            <div class="waiting-spinner">
                <i class="fas fa-palette fa-spin"></i>
            </div>
            <div class="waiting-text">
                <h3>🎨 Генерация букета...</h3>
                <p>Статус: <span class="waiting-status" style="color: #f39c12;">создание</span></p>
                <p class="waiting-order-id">ID заказа: ${state.orderId}</p>
                <p class="waiting-info">Нейросеть создает ваш уникальный букет</p>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(waitingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Функция для обработки завершения теста получателем
function handleRecipientTestComplete(imageUrl) {
    const typingIndicator = showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        
        // Удаляем индикатор ожидания
        const waitingIndicator = document.getElementById('waitingIndicator');
        if (waitingIndicator) {
            waitingIndicator.remove();
        }
        
        // Добавляем сообщение о генерации
        addMessage(`Отлично! Я получила все ваши ответы🌸 Сейчас начинаю генерацию вашего уникального букета...`, false);
        
        setTimeout(() => {
            addMessage(`✅ Запрос на генерацию отправлен! Искусственный интеллект создает ваш букет. Это займет около 30 секунд.`, false);
            
            // Показываем готовое изображение
            showGeneratedBouquet(imageUrl);
            
            creationProgress.style.display = 'none';
            state.currentStep = 'completed';
            state.currentImageUrl = imageUrl;
            
            // После показа букета задаем вопрос о заказе
            setTimeout(() => {
                askOrderQuestion();
            }, 2000);
        }, 1500);
    }, 1000);
}

// Функция для обработки случая, когда не можем связаться с получателем
function handleCantReachRecipient() {
    addMessage('Не могу связаться с получателем', true);
    
    const typingIndicator = showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        
        addMessage('Хорошо, тогда я задам вам несколько вопросов, чтобы создать букет самостоятельно.', false);
        
        state.recipientType = 'self';
        state.currentStep = 'questions';
        
        creationProgress.style.display = 'flex';
        
        setTimeout(() => {
            askNextQuestion();
        }, 1500);
    }, 800);
}

// Функция для показа индикатора ожидания
function showWaitingIndicator() {
    const waitingDiv = document.createElement('div');
    waitingDiv.className = 'waiting-indicator';
    waitingDiv.id = 'waitingIndicator';
    waitingDiv.innerHTML = `
        <div class="waiting-content">
            <div class="waiting-spinner">
                <i class="fas fa-spinner fa-spin"></i>
            </div>
            <div class="waiting-text">
                <h3>⏳ Ожидаем прохождения теста в Telegram</h3>
                <p>Статус: <span class="waiting-status">ожидание</span></p>
                <p class="waiting-order-id">🆔 ID заказа: ${state.orderId}</p>
                <p class="waiting-bot-info">🤖 Бот: ${TELEGRAM_BOT_LINK}</p>
                <p class="waiting-instruction">
                    👆 Перейдите в бота и пройдите тест, чтобы увидеть ваш уникальный букет
                </p>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(waitingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Добавляем пояснительное сообщение
    setTimeout(() => {
        addMessage(`🔔 Я буду автоматически проверять статус каждые 3 секунды. Как только тест будет пройден, статус изменится на "получены результаты" и начнется генерация букета.`, false);
    }, 1000);
}

// Функция обработки выбора опции в вопросах
function handleOptionSelect(value) {
    const currentQuestion = questions[state.currentQuestion];
    state.answers[currentQuestion.id] = value;

    const selectedOption = currentQuestion.options.find(opt => opt.value === value);
    addMessage(selectedOption.text, true);

    if (currentQuestion.id === 'favoriteFlowers') {
        if (value === 'да') {
            state.isWaitingForFavoriteFlowers = true;
            addMessage('Напишите, какие цветы любимые)', false);
            
            setTimeout(() => {
                chatInputContainer.style.display = 'flex';
                userInput.focus();
            }, 400);
            
            return;
        } else {
            setTimeout(() => {
                state.currentQuestion++;
                updateProgressBar();

                if (state.currentQuestion < questions.length) {
                    askNextQuestion();
                } else {
                    startBouquetGeneration();
                }
            }, 800);
            return;
        }
    }

    if (currentQuestion.id === 'note' && value === 'своя') {
        state.isWaitingForNoteText = true;
        addMessage('Напишите текст записки ✍️', false);
        
        setTimeout(() => {
            chatInputContainer.style.display = 'flex';
            userInput.focus();
        }, 400);
        
        return;
    }

    setTimeout(() => {
        state.currentQuestion++;
        updateProgressBar();

        if (state.currentQuestion < questions.length) {
            askNextQuestion();
        } else {
            startBouquetGeneration();
        }
    }, 800);
}

// Функция для задания следующего вопроса
function askNextQuestion() {
    const typingIndicator = showTypingIndicator();

    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        const question = questions[state.currentQuestion];
        addMessage(question.text, false, question.options);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 1000);
}

// Функция для показа выбора получателя
function showRecipientChoice() {
    const typingIndicator = showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        
        const welcomeMessage = document.getElementById('initialMessage');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'block';
        }
        
        const messageDiv = addMessage('Заказываете цветы для себя или другого получателя?', false);
        
        const choiceButtons = createChoiceButtons([
            {
                text: 'Для себя',
                icon: 'fas fa-user',
                action: () => {
                    addMessage('Для себя', true);
                    state.recipientType = 'self';
                    showSelfTestMessage();
                }
            },
            {
                text: 'Для другого человека',
                icon: 'fas fa-users',
                action: () => {
                    addMessage('Для другого человека', true);
                    state.recipientType = 'other';
                    showRecipientTestMessage();
                }
            }
        ]);
        
        messageDiv.appendChild(choiceButtons);
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 2000);
}

// Функция для генерации промпта на основе ответов пользователя
function generatePrompt() {
    const forWhom = state.answers.forWhom || 'близкий человек';
    const occasion = state.answers.occasion || 'особый случай';
    const age = state.answers.age || 'взрослый';
    const colors = state.answers.colors || 'пастельные';
    const favoriteFlowers = state.answers.favoriteFlowers === 'да' ? state.answers.favoriteFlowersText : null;
    
    const colorMap = {
        'пастельные': 'soft pastel pink, lavender, mint green, pale yellow',
        'яркие': 'vibrant bright orange, hot pink, electric blue, yellow',
        'бело-зеленые': 'elegant white and green, white roses, eucalyptus',
        'красные': 'romantic red roses, deep burgundy, crimson',
        'розовые': 'delicate pink peonies, blush roses, light pink',
        'синие': 'mystical blue hydrangeas, purple irises, lavender'
    };
    
    const occasionMap = {
        '8 марта': 'International Womens Day spring bouquet',
        'свадьба': 'elegant wedding bridal bouquet',
        'день рождения': 'festive birthday celebration bouquet',
        'годовщина': 'romantic anniversary love bouquet',
        'без повода': 'surprise just because beautiful bouquet',
        'извинение': 'apology forgiveness romantic bouquet'
    };
    
    const forWhomMap = {
        'супруг(а)': 'for beloved spouse',
        'родитель': 'for dear parent',
        'возлюбленный(ая)': 'for romantic partner',
        'коллега': 'for colleague professional',
        'друг': 'for dear friend',
        'себе': 'for self-care home decoration'
    };
    
    const ageMap = {
        'ребенок': 'playful cheerful colors',
        'подросток': 'modern trendy style',
        'молодой': 'youthful vibrant',
        'взрослый': 'elegant sophisticated',
        'пожилой': 'classic timeless',
        'не важно': 'balanced'
    };
    
    let prompt = `Professional photography of a beautiful flower bouquet, ${colorMap[colors] || 'mixed colorful flowers'}, `;
    prompt += `${occasionMap[occasion] || 'elegant floral arrangement'}, `;
    prompt += `${forWhomMap[forWhom] || 'for special person'}, `;
    prompt += `${ageMap[age] || 'elegant'}, `;
    
    if (favoriteFlowers) {
        prompt += `made with ${favoriteFlowers}, `;
    }
    
    prompt += `highly detailed, photorealistic, 8k resolution, professional lighting, soft shadows, white background, studio shot, commercial product photography, ultra realistic, sharp focus, florist quality, fresh flowers, dew drops, premium arrangement`;
    
    if (state.answers.note && state.answers.note !== 'нет' && state.answers.note !== 'не знаю') {
        if (state.answers.note === 'своя' && state.answers.noteText) {
            prompt += `, with a small elegant note card that says "${state.answers.noteText}"`;
        } else if (state.answers.note === 'с днем рождения') {
            prompt += `, with a birthday card saying "Happy Birthday!"`;
        } else if (state.answers.note === 'романтичная') {
            prompt += `, with a romantic love note card`;
        }
    }
    
    return prompt;
}

// Функция для начала генерации букета
async function startBouquetGeneration() {
    state.isGenerating = true;
    creationProgress.style.display = 'none';

    const typingIndicator = showTypingIndicator();

    setTimeout(async () => {
        removeTypingIndicator(typingIndicator);
        
        const prompt = generatePrompt();
        
        addMessage(`Отлично! Я получила все ваши ответы🌸 Сейчас начинаю генерацию вашего уникального букета...`, false);
        
        try {
            const { requestId } = await sendPromptToServer(prompt, state.orderId);
            
            addMessage(`✅ Запрос на генерацию отправлен! Искусственный интеллект создает ваш букет. Это займет около 30 секунд.`, false);
            
            showWaitingIndicator();
            
            const result = await waitForGeneration(requestId);
            
            const waitingIndicator = document.getElementById('waitingIndicator');
            if (waitingIndicator) {
                waitingIndicator.remove();
            }
            
            showGeneratedBouquet(result.imageUrl);
            
            // После показа букета задаем дополнительный вопрос
            setTimeout(() => {
                askOrderQuestion();
            }, 2000);
            
        } catch (error) {
            console.error('Generation error:', error);
            
            const waitingIndicator = document.getElementById('waitingIndicator');
            if (waitingIndicator) {
                waitingIndicator.remove();
            }
            
            addMessage(`⚠️ Произошла ошибка при генерации изображения. Пожалуйста, попробуйте еще раз или свяжитесь с флористом напрямую.`, false);
        }
    }, 1500);
}

// Новая функция для вопроса после генерации
function askOrderQuestion() {
    state.isWaitingForOrderAction = true;
    
    const orderQuestion = document.createElement('div');
    orderQuestion.className = 'message ai-message';
    orderQuestion.innerHTML = `
        <div class="message-header">
            <i class="fas fa-spa"></i>
            <span>FloraAI</span>
        </div>
        <p>Хотите оформить заказ этого букета?</p>
        <div class="options-container">
            <div class="options-grid">
                <button class="option-btn" id="orderYesBtn">
                    <div class="option-icon">
                        <i class="fas fa-check"></i>
                    </div>
                    Да, связаться с флористом
                </button>
                <button class="option-btn" id="orderNoBtn">
                    <div class="option-icon">
                        <i class="fas fa-times"></i>
                    </div>
                    Нет, создать другой букет
                </button>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(orderQuestion);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    setTimeout(() => {
        const yesBtn = document.getElementById('orderYesBtn');
        const noBtn = document.getElementById('orderNoBtn');
        
        if (yesBtn) {
            yesBtn.addEventListener('click', () => {
                addMessage('Да, связаться с флористом', true);
                state.isWaitingForOrderAction = false;
                connectToFlorist();
            });
        }
        
        if (noBtn) {
            noBtn.addEventListener('click', () => {
                addMessage('Нет, создать другой букет', true);
                state.isWaitingForOrderAction = false;
                restartQuestionnaire();
            });
        }
    }, 100);
}

function showGeneratedBouquet(imageUrl) {
    const waitingIndicator = document.getElementById('waitingIndicator');
    if (waitingIndicator) {
        waitingIndicator.remove();
    }
    
    // Создаем основной контейнер
    const resultDiv = document.createElement('div');
    resultDiv.className = 'bouquet-result-wrapper';
    
    const resultHTML = `
        <div class="bouquet-result" id="bouquetResult">
            <div class="result-header">
                <div class="result-icon">
                    <i class="fas fa-magic"></i>
                </div>
                <div class="result-title">Ваш уникальный букет готов!</div>
                <div class="result-subtitle">Создано с помощью YandexART</div>
            </div>
            
            <div class="bouquet-image-container" id="bouquetImageContainer" style="text-align: center; overflow-x: auto; max-width: 100%; margin: 20px 0;">
                <img class="bouquet-image" id="bouquetImage" src="${imageUrl}" alt="Ваш уникальный букет" style="display: inline-block; width: auto; max-width: none; height: auto; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); cursor: pointer;">
            </div>
            
            <div class="bouquet-description">
                ${generateBouquetDescription()}
            </div>
            
            <div class="bouquet-details" id="bouquetDetails">
                <div class="detail-card">
                    <div class="detail-card-title">Для кого</div>
                    <div class="detail-card-value">${getOptionText('forWhom')}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-card-title">Возраст</div>
                    <div class="detail-card-value">${getOptionText('age')}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-card-title">Цвета</div>
                    <div class="detail-card-value">${getOptionText('colors')}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-card-title">Повод</div>
                    <div class="detail-card-value">${getOptionText('occasion')}</div>
                </div>
            </div>
        </div>
    `;
    
    resultDiv.innerHTML = resultHTML;
    chatMessages.appendChild(resultDiv);
    
    // Получаем ссылки на элементы
    const bouquetImage = document.getElementById('bouquetImage');
    const bouquetImageContainer = document.getElementById('bouquetImageContainer');
    const bouquetResult = document.getElementById('bouquetResult');
    const bouquetDetails = document.getElementById('bouquetDetails');
    
    let isExpanded = false;
    
    // Функция для сворачивания изображения (первый вариант)
    function collapseImage() {
        if (isExpanded) {
            // Возвращаем к исходному состоянию (первый вариант)
            bouquetImageContainer.style.overflowX = 'auto';
            bouquetImageContainer.style.overflow = '';
            bouquetImageContainer.style.width = '';
            bouquetImageContainer.style.margin = '20px 0';
            
            bouquetImage.style.display = 'inline-block';
            bouquetImage.style.maxWidth = 'none';
            bouquetImage.style.width = 'auto';
            
            bouquetResult.style.display = '';
            bouquetResult.style.maxWidth = '';
            bouquetResult.style.width = '';
            bouquetResult.style.margin = '';
            
            bouquetDetails.style.width = '';
            bouquetDetails.style.margin = '';
            
            isExpanded = false;
            console.log('Image collapsed to original mode');
        }
    }
    
    // Функция для расширения изображения (второй вариант)
    function expandImage() {
        if (!isExpanded) {
            // Меняем на увеличенный режим (второй вариант)
            bouquetImageContainer.style.overflow = 'visible';
            bouquetImageContainer.style.overflowX = 'visible';
            bouquetImageContainer.style.width = 'fit-content';
            bouquetImageContainer.style.margin = '20px auto';
            
            bouquetImage.style.display = 'block';
            bouquetImage.style.maxWidth = '100%';
            bouquetImage.style.width = 'auto';
            
            bouquetResult.style.display = 'inline-block';
            bouquetResult.style.maxWidth = '100%';
            bouquetResult.style.width = 'fit-content';
            bouquetResult.style.margin = '0 auto';
            
            bouquetDetails.style.width = 'fit-content';
            bouquetDetails.style.margin = '0 auto';
            
            isExpanded = true;
            console.log('Image expanded to full mode');
        }
    }
    
    // Обработчик клика на изображение - переключение режимов
    bouquetImage.addEventListener('click', function(event) {
        event.stopPropagation(); // Предотвращаем всплытие события
        
        if (isExpanded) {
            collapseImage();
        } else {
            expandImage();
        }
    });
    
    // Обработчик клика на документ - сворачивание при клике вне изображения
    document.addEventListener('click', function(event) {
        // Проверяем, кликнули ли не по изображению, не по контейнеру и не по деталям
        if (isExpanded && 
            !bouquetImage.contains(event.target) && 
            !bouquetImageContainer.contains(event.target) &&
            !bouquetDetails.contains(event.target)) {
            collapseImage();
        }
    });
    
    // Предотвращаем схлопывание при клике на детали
    bouquetDetails.addEventListener('click', function(event) {
        event.stopPropagation();
    });
    
    // Добавляем обработчик для кнопок внутри деталей (если есть)
    const detailCards = bouquetDetails.querySelectorAll('.detail-card');
    detailCards.forEach(card => {
        card.addEventListener('click', function(event) {
            event.stopPropagation();
        });
    });
    
    // Прокручиваем чат вниз
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Сохраняем состояние
    state.currentImageUrl = imageUrl;
    state.currentStep = 'completed';
}

// Функция для получения текста опции
function getOptionText(questionId) {
    const question = questions.find(q => q.id === questionId);
    if (!question || !state.answers[questionId]) return 'Не указано';
    
    const option = question.options.find(opt => opt.value === state.answers[questionId]);
    return option ? option.text : 'Не указано';
}

// Функция для генерации описания букета
function generateBouquetDescription() {
    const descriptions = {
        'супруг(а)': 'Этот букет создан специально для вашей второй половинки. Каждый цветок в нём символизирует разные грани ваших отношений: страсть, нежность, верность и вечную любовь.',
        'родитель': 'Композиция, наполненная теплотой и благодарностью. Цветы подобраны так, чтобы выразить всю глубину ваших чувств к самому близкому человеку.',
        'возлюбленный(ая)': 'Романтичный букет, который говорит без слов. Нежные оттенки и изящные формы создают атмосферу зарождающихся чувств и особенной связи.',
        'коллега': 'Элегантная и сдержанная композиция, идеально подходящая для деловой среды. Выражает уважение и признательность, сохраняя профессиональный тон.',
        'друг': 'Жизнерадостный и непринуждённый букет, который станет прекрасным способом сказать "я ценю нашу дружбу".',
        'себе': 'Букет для тех, кто ценит красоту вокруг себя. Композиция, которая будет радовать вас каждый день и создавать особое настроение.'
    };

    const baseDescription = descriptions[state.answers.forWhom] || 'Уникальная композиция, созданная специально для вашего случая.';

    let colorDescription = '';
    if (state.answers.colors === 'пастельные') {
        colorDescription = 'Нежные пастельные оттенки создают ощущение лёгкости и чистоты, как утренний туман над цветущим лугом.';
    } else if (state.answers.colors === 'яркие') {
        colorDescription = 'Яркие, сочные цвета наполняют композицию энергией и жизнерадостностью, притягивая взгляды и поднимая настроение.';
    } else if (state.answers.colors === 'бело-зеленые') {
        colorDescription = 'Гармония белого и зелёного создаёт ощущение свежести и чистоты, напоминая о весеннем пробуждении природы.';
    }

    let occasionDescription = '';
    if (state.answers.occasion === 'день рождения') {
        occasionDescription = 'Идеально подобран для дня рождения — каждый цветок несёт пожелание счастья, здоровья и радости на весь следующий год.';
    } else if (state.answers.occasion === '8 марта') {
        occasionDescription = 'Весенняя композиция, созданная специально для Международного женского дня, символизирует пробуждение, красоту и нежность.';
    } else if (state.answers.occasion === 'годовщина') {
        occasionDescription = 'Этот букет рассказывает историю ваших отношений — от первых нежных чувств до глубокой привязанности, которая с годами только крепнет.';
    }

    let favoriteFlowersText = '';
    if (state.answers.favoriteFlowers === 'да' && state.answers.favoriteFlowersText) {
        favoriteFlowersText = ` В букете использованы ваши любимые цветы: ${state.answers.favoriteFlowersText}.`;
    }

    return `${baseDescription} ${colorDescription} ${occasionDescription}${favoriteFlowersText} Я тщательно подобрала каждый элемент, чтобы создать гармоничную композицию, которая будет радовать получателя и точно передаст ваши чувства.`;
}

// Функция для связи с флористом
function connectToFlorist() {
    let orderDetails = `Новый заказ от FloraAI:

📋 Детали букета:
• Для кого: ${getOptionText('forWhom')}
• Возраст: ${getOptionText('age')}
• Цвета: ${getOptionText('colors')}
• Записка: ${state.answers.noteText || getOptionText('note')}
• Повод: ${getOptionText('occasion')}`;

    if (state.answers.favoriteFlowers === 'да' && state.answers.favoriteFlowersText) {
        orderDetails += `\n• Любимые цветы: ${state.answers.favoriteFlowersText}`;
    }

    if (state.currentImageUrl) {
        orderDetails += `\n\n🔗 Ссылка на изображение букета: ${state.currentImageUrl}`;
    }

    orderDetails += `\n\nИзображение букета сгенерировано успешно! Флорист может воссоздать эту композицию с живыми цветами.`;

    addMessage("Отлично! Сейчас я перенаправлю вас в наш Telegram-чат с флористом, где вы сможете уточнить детали заказа и указать адрес доставки. 🌸", false);

    const telegramBotUrl = "https://t.me/FloraAI_Florist_Bot";

    setTimeout(() => {
        window.open(telegramBotUrl, '_blank');
        addMessage(`Если переход не произошел автоматически, перейдите по ссылке: <a href="${telegramBotUrl}" target="_blank">${telegramBotUrl}</a><br><br>В чате с флористом отправьте сообщение: "Хочу заказать букет, сгенерированный FloraAI"`, false);
    }, 1500);
}

// Функция для перезапуска опроса
function restartQuestionnaire() {
    state.currentStep = 'recipientChoice';
    state.recipientType = null;
    state.currentQuestion = 0;
    state.answers = {
        forWhom: null,
        age: null,
        colors: null,
        note: null,
        occasion: null,
        favoriteFlowers: null,
        favoriteFlowersText: null,
        noteText: null
    };
    state.isGenerating = false;
    state.isWaitingForNoteText = false;
    state.isWaitingForFavoriteFlowers = false;
    state.isWaitingForOrderAction = false;
    state.currentImageUrl = null;
    state.orderId = null;
    state.generationRequestId = null;

    chatMessages.innerHTML = '';
    
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'message ai-message';
    welcomeDiv.id = 'initialMessage';
    welcomeDiv.innerHTML = `
        <div class="message-header">
            <i class="fas fa-spa"></i>
            <span>FloraAI</span>
        </div>
        <p>Здравствуйте! 🌷 
            <br> Я ваш персональный флорист с искусственным интеллектом. Помогу создать уникальную цветочную композицию, которая идеально передаст ваши чувства.</p>
        <p>Я задам вам несколько вопросов, чтобы понять ваши предпочтения, а затем создам индивидуальный букет специально для вашего случая!</p>
    `;
    chatMessages.appendChild(welcomeDiv);
    
    creationProgress.style.display = 'none';
    
    setTimeout(() => {
        showRecipientChoice();
    }, 1000);
}

// Функция для копирования в буфер обмена
window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = 'Ссылка скопирована!';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 2000);
    });
};

// Инициализация чата
function initChat() {
    creationProgress.style.display = 'none';
    showRecipientChoice();
}

// Обработчики событий
sendButton.addEventListener('click', () => {
    const message = userInput.value.trim();
    if (!message) return;

    addMessage(message, true);
    userInput.value = '';
    userInput.style.height = 'auto';

    if (state.isWaitingForNoteText) {
        state.answers.noteText = message;
        state.answers.note = 'своя';
        state.isWaitingForNoteText = false;
        chatInputContainer.style.display = 'none';

        state.currentQuestion++;
        updateProgressBar();

        setTimeout(() => {
            if (state.currentQuestion < questions.length) {
                askNextQuestion();
            } else {
                startBouquetGeneration();
            }
        }, 600);
    } else if (state.isWaitingForFavoriteFlowers) {
        state.answers.favoriteFlowersText = message;
        state.isWaitingForFavoriteFlowers = false;
        chatInputContainer.style.display = 'none';

        state.currentQuestion++;
        updateProgressBar();

        setTimeout(() => {
            if (state.currentQuestion < questions.length) {
                askNextQuestion();
            } else {
                startBouquetGeneration();
            }
        }, 600);
    }
});

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendButton.click();
    }
});

userInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

closeBtn.addEventListener('click', () => {
    if (window.opener) {
        window.close();
    } else {
        addMessage("Спасибо за использование FloraAI! Если решите создать букет позже, мы всегда готовы помочь. 🌸", false);
    }
});

// Добавляем стили
const style = document.createElement('style');
style.textContent = `
    .test-link-container {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        padding: 15px;
        margin: 10px 0;
        color: white;
    }
    
    .link-box {
        display: flex;
        align-items: center;
        gap: 10px;
        background: rgba(255, 255, 255, 0.1);
        padding: 10px;
        border-radius: 8px;
        margin-top: 10px;
        flex-wrap: wrap;
    }
    
    .link-box a {
        color: white;
        text-decoration: underline;
        word-break: break-all;
        flex: 1;
    }
    
    .copy-link-btn {
        background: white;
        border: none;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 14px;
        color: #764ba2;
        transition: all 0.3s ease;
        white-space: nowrap;
    }
    
    .copy-link-btn:hover {
        background: #f0f0f0;
        transform: scale(1.05);
    }
    
    .bot-info {
        margin-top: 10px;
        font-size: 14px;
        opacity: 0.9;
        font-style: italic;
    }
    
    .copy-notification {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #4CAF50;
        color: white;
        padding: 10px 20px;
        border-radius: 30px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideUp 0.3s ease;
    }
    
    .waiting-indicator {
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        border-radius: 15px;
        padding: 20px;
        margin: 20px 0;
        animation: pulse 2s infinite;
    }
    
    .waiting-content {
        display: flex;
        align-items: center;
        gap: 20px;
        flex-wrap: wrap;
    }
    
    .waiting-spinner {
        font-size: 40px;
        color: #667eea;
    }
    
    .waiting-text {
        flex: 1;
    }
    
    .waiting-text h3 {
        margin: 0 0 10px 0;
        color: #333;
    }
    
    .waiting-status {
        color: #667eea;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .waiting-order-id {
        margin-top: 10px;
        font-size: 12px;
        color: #666;
        font-family: monospace;
    }
    
    .waiting-bot-info {
        margin-top: 5px;
        font-size: 14px;
        color: #764ba2;
        font-weight: 500;
    }
    
    @keyframes pulse {
        0% {
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.1);
        }
        50% {
            box-shadow: 0 4px 25px rgba(102, 126, 234, 0.3);
        }
        100% {
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.1);
        }
    }
    
    .bouquet-image-container {
        margin: 20px 0;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    
    .bouquet-image {
        width: 100%;
        display: block;
        transition: transform 0.3s ease;
    }
    
    .bouquet-image:hover {
        transform: scale(1.02);
    }
    
    .result-subtitle {
        font-size: 12px;
        color: #667eea;
        margin-top: 5px;
        opacity: 0.8;
    }
`;

document.head.appendChild(style);

window.addEventListener('load', initChat);