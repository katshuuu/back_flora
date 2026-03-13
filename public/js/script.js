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
    isWaitingForOrderAction: false,
    currentImageUrl: null,
    orderId: null,
    generationRequestId: null,
    sessionToken: null,
    pollingInterval: null,
    generationPollingInterval: null
};

// Конфигурация
const SITE_URL = window.location.origin;
const TELEGRAM_BOT_LINK = '@YourVibeCheck_Bot'; // Замените на вашего бота

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

// Очищаем все при загрузке страницы
window.addEventListener('load', function() {
    // Принудительно очищаем localStorage
    localStorage.removeItem('currentSessionToken');
    
    // Очищаем sessionStorage если используется
    sessionStorage.clear();
    
    // Запускаем инициализацию чата
    initChat();
});

// Функция для создания сессии на сервере
async function createSession(recipientType) {
    try {
        const response = await fetch('/api/create-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recipientType })
        });
        
        const data = await response.json();
        
        if (data.success) {
            state.sessionToken = data.token;
            localStorage.setItem('currentSessionToken', data.token);
            console.log('✅ Сессия создана, токен:', data.token);
            return data;
        } else {
            throw new Error('Failed to create session');
        }
    } catch (error) {
        console.error('❌ Ошибка создания сессии:', error);
        return null;
    }
}

// Функция для проверки статуса теста
async function checkTestStatus(token) {
    try {
        const response = await fetch(`/api/quiz-status/${token}`);
        const data = await response.json();
        
        console.log('📊 Статус теста:', data);
        updateTestStatusUI(data);
        
        return data;
    } catch (error) {
        console.error('❌ Ошибка проверки статуса:', error);
        return null;
    }
}

// Функция обновления UI статуса теста
function updateTestStatusUI(statusData) {
    let statusIndicator = document.getElementById('testStatusIndicator');
    
    if (!statusIndicator) {
        statusIndicator = document.createElement('div');
        statusIndicator.id = 'testStatusIndicator';
        statusIndicator.className = 'test-status-indicator';
        document.querySelector('.chat-container').appendChild(statusIndicator);
    }
    
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
                    <span>✅ Букет готов!</span>
                </div>
            `;
            // Показываем изображение
            if (statusData.image_url) {
                showGeneratedBouquet(statusData.image_url);
            }
            break;
            
        case 'failed':
            statusIndicator.innerHTML = `
                <div class="status-info failed">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>❌ Ошибка генерации</span>
                </div>
            `;
            break;
    }
}

// Функция запуска опроса статуса
function startStatusPolling(token) {
    if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
    }
    
    // Проверяем сразу
    checkTestStatus(token);
    
    state.pollingInterval = setInterval(async () => {
        const status = await checkTestStatus(token);
        
        if (status && (status.status === 'ready' || status.status === 'failed')) {
            clearInterval(state.pollingInterval);
            state.pollingInterval = null;
        }
    }, 3000);
}

// Функция для показа сообщения о тесте для себя
async function showSelfTestMessage() {
    const typingIndicator = showTypingIndicator();
    
    setTimeout(async () => {
        removeTypingIndicator(typingIndicator);
        
        // Создаем сессию на сервере
        const sessionData = await createSession('self');
        
        if (!sessionData) {
            addMessage('❌ Ошибка создания сессии. Попробуйте позже.', false);
            return;
        }
        
        const testLink = `https://t.me/${TELEGRAM_BOT_LINK.replace('@', '')}?start=${sessionData.token}`;
        
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
        
        // Запускаем опрос статуса
        startStatusPolling(sessionData.token);
        
    }, 1000);
}

// Функция для показа сообщения о тесте для получателя
async function showRecipientTestMessage() {
    const typingIndicator = showTypingIndicator();
    
    setTimeout(async () => {
        removeTypingIndicator(typingIndicator);
        
        // Создаем сессию на сервере
        const sessionData = await createSession('other');
        
        if (!sessionData) {
            addMessage('❌ Ошибка создания сессии. Попробуйте позже.', false);
            return;
        }
        
        const testLink = `https://t.me/${TELEGRAM_BOT_LINK.replace('@', '')}?start=${sessionData.token}`;
        
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
        
        const actionButtons = createChoiceButtons([
            {
                text: 'Хорошо, сейчас отправлю ссылку',
                icon: 'fas fa-check',
                action: () => handleSendLink(sessionData.token)
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
function handleSendLink(token) {
    addMessage('Хорошо, сейчас отправлю ссылку', true);
    
    const typingIndicator = showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        
        addMessage(`Отлично! Я буду ждать, пока получатель пройдет тест. Как только он завершит тестирование, я сгенерирую изображение и сразу покажу вам результат! 🌸`, false);
        
        showWaitingIndicator(token);
        
        state.currentStep = 'waitingForRecipient';
        creationProgress.style.display = 'none';
        
        startStatusPolling(token);
    }, 800);
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
function showWaitingIndicator(token) {
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
                <p class="waiting-order-id">🆔 ID сессии: ${token}</p>
                <p class="waiting-bot-info">🤖 Бот: ${TELEGRAM_BOT_LINK}</p>
                <p class="waiting-instruction">
                    👆 Перейдите в бота и пройдите тест, чтобы увидеть ваш уникальный букет
                </p>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(waitingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    setTimeout(() => {
        addMessage(`🔔 Я буду автоматически проверять статус каждые 3 секунды. Как только тест будет пройден, начнется генерация букета.`, false);
    }, 1000);
}

// Функция для отправки промпта на сервер
async function sendPromptToServer(prompt, token) {
    const requestId = 'gen_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    state.generationRequestId = requestId;
    
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt,
                token,
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
            const { requestId } = await sendPromptToServer(prompt, state.sessionToken);
            
            addMessage(`✅ Запрос на генерацию отправлен! Искусственный интеллект создает ваш букет. Это займет около 30 секунд.`, false);
            
            // Запускаем проверку статуса для отслеживания генерации
            startStatusPolling(state.sessionToken);
            
        } catch (error) {
            console.error('Generation error:', error);
            addMessage(`⚠️ Произошла ошибка при генерации изображения. Пожалуйста, попробуйте еще раз.`, false);
        }
    }, 1500);
}

// Функция для показа сгенерированного букета
function showGeneratedBouquet(imageUrl) {
    // Удаляем индикатор ожидания если есть
    const waitingIndicator = document.getElementById('waitingIndicator');
    if (waitingIndicator) {
        waitingIndicator.remove();
    }
    
    const resultDiv = document.createElement('div');
    resultDiv.className = 'bouquet-result-wrapper';
    
    // Определяем, откуда пришли данные - из Telegram или с сайта
    const isTelegramFlow = !state.answers.forWhom && !state.answers.occasion;
    
    // Определяем тип получателя
    const isForSelf = state.recipientType === 'self';
    
    // Формируем описание в зависимости от сценария
    let descriptionText = '';
    if (isTelegramFlow) {
        // Сценарий: тест пройден в Telegram (не важно, self или other)
        descriptionText = isForSelf 
            ? 'Букет, созданный под Ваши предпочтения🤍' 
            : 'Букет, созданный под предпочтения адресата🤍';
    } else {
        // Сценарий: тест пройден на сайте (только для other)
        descriptionText = generateBouquetDescription();
    }
    
    const resultHTML = `
        <div class="bouquet-result" id="bouquetResult" style="display: inline-block; max-width: 100%; width: fit-content; margin: 0 auto;">
            <div class="result-header">
                <div class="result-icon">
                    <i class="fas fa-magic"></i>
                </div>
                <div class="result-title">Ваш уникальный букет готов!</div>
                <div class="result-subtitle">Создано с помощью YandexART</div>
            </div>
            
            <div class="bouquet-image-container" id="bouquetImageContainer" style="text-align: center; overflow: visible; width: fit-content; max-width: 100%; margin: 20px auto;">
                <img class="bouquet-image" id="bouquetImage" src="${imageUrl}" alt="Ваш уникальный букет" style="display: block; width: auto; height: auto; max-width: 100%; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); cursor: pointer; transition: all 0.3s ease; transform-origin: center center;">
            </div>
            
            <div class="bouquet-description">
                ${descriptionText}
            </div>
            
            ${!isTelegramFlow ? `
            <div class="bouquet-details" id="bouquetDetails" style="width: fit-content; margin: 0 auto;">
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
            ` : ''}
            
            <div style="text-align: center; margin-top: 20px;">
                <button class="order-bouquet-btn" onclick="askOrderQuestion()">
                    <i class="fas fa-shopping-cart"></i> Заказать этот букет
                </button>
            </div>
        </div>
    `;
    
    resultDiv.innerHTML = resultHTML;
    chatMessages.appendChild(resultDiv);
    
    // Добавляем обработчик для увеличения изображения
    const bouquetImage = document.getElementById('bouquetImage');
    const imageContainer = document.getElementById('bouquetImageContainer');
    
    if (bouquetImage && imageContainer) {
        // Состояние увеличения
        let isExpanded = false;
        
        // Функция для закрытия
        function closeExpandedImage() {
            if (isExpanded) {
                // Возвращаем исходные стили
                bouquetImage.style.transform = 'scale(1)';
                bouquetImage.style.zIndex = '1';
                bouquetImage.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
                isExpanded = false;
                
                // Удаляем обработчик после закрытия
                document.removeEventListener('click', handleDocumentClick);
            }
        }
        
        // Обработчик клика вне изображения
        function handleDocumentClick(event) {
            if (isExpanded && !bouquetImage.contains(event.target)) {
                closeExpandedImage();
            }
        }
        
        // Обработчик клика на изображение
        bouquetImage.addEventListener('click', function(event) {
            event.stopPropagation(); // Предотвращаем всплытие события
            
            if (!isExpanded) {
                // Увеличиваем изображение (scale 1.5)
                this.style.transform = 'scale(1.5)';
                this.style.zIndex = '1000';
                this.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)';
                isExpanded = true;
                
                // Добавляем обработчик для закрытия при клике вне изображения
                // Используем setTimeout чтобы избежать немедленного срабатывания
                setTimeout(() => {
                    document.addEventListener('click', handleDocumentClick);
                }, 0);
            } else {
                // Если изображение уже увеличено, закрываем его
                closeExpandedImage();
            }
        });
        
        // Очистка обработчиков при удалении элемента (для предотвращения утечек памяти)
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (!document.body.contains(bouquetImage)) {
                    document.removeEventListener('click', handleDocumentClick);
                    observer.disconnect();
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
    state.currentImageUrl = imageUrl;
}

// Вспомогательные функции (остаются без изменений)
function updateProgressBar() {
    const totalQuestions = 6;
    const progress = ((state.currentQuestion) / totalQuestions) * 100;
    root.style.setProperty('--progress', `${progress}%`);
    progressFill.style.width = `${progress}%`;
    progressStep.textContent = state.currentQuestion === totalQuestions ? 'Генерация букета...' : `Вопрос ${state.currentQuestion + 1} из ${totalQuestions}`;
}

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

function removeTypingIndicator(typingElement) {
    if (typingElement && typingElement.parentNode) {
        typingElement.remove();
    }
}

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

function askNextQuestion() {
    const typingIndicator = showTypingIndicator();

    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        const question = questions[state.currentQuestion];
        addMessage(question.text, false, question.options);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 1000);
}

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

function getOptionText(questionId) {
    const question = questions.find(q => q.id === questionId);
    if (!question || !state.answers[questionId]) return 'Не указано';
    
    const option = question.options.find(opt => opt.value === state.answers[questionId]);
    return option ? option.text : 'Не указано';
}

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

    return `${baseDescription} ${colorDescription} ${occasionDescription}${favoriteFlowersText}`;
}

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

function restartQuestionnaire() {
    // Очищаем интервалы
    if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
        state.pollingInterval = null;
    }
    
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
    state.sessionToken = null;
    state.generationRequestId = null;

    localStorage.removeItem('currentSessionToken');
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

function initChat() {
    creationProgress.style.display = 'none';
    
    // Проверяем, есть ли сохраненный токен
    const savedToken = localStorage.getItem('currentSessionToken');
    if (savedToken) {
        console.log('🔄 Найден сохраненный токен:', savedToken);
        state.sessionToken = savedToken;
        startStatusPolling(savedToken);
    }
    
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
    .test-status-indicator {
        position: sticky;
        bottom: 10px;
        left: 10px;
        right: 10px;
        z-index: 100;
        margin: 10px 0;
    }
    
    .status-info {
        padding: 12px 20px;
        border-radius: 30px;
        background: white;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 500;
    }
    
    .status-info.pending {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
    }
    
    .status-info.generating {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
    }
    
    .status-info.ready {
        background: linear-gradient(135deg, #00b09b 0%, #96c93d 100%);
        color: white;
    }
    
    .status-info.failed {
        background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
        color: white;
    }
    
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
    
    .waiting-instruction {
        margin-top: 10px;
        font-size: 13px;
        color: #555;
        font-style: italic;
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
    
    .bouquet-result-wrapper {
        margin: 20px 0;
    }
    
    .bouquet-result {
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        border-radius: 15px;
        padding: 20px;
        animation: fadeIn 0.5s ease;
    }
    
    .result-header {
        text-align: center;
        margin-bottom: 20px;
    }
    
    .result-icon {
        font-size: 40px;
        color: #667eea;
        margin-bottom: 10px;
    }
    
    .result-title {
        font-size: 24px;
        font-weight: bold;
        color: #333;
        margin-bottom: 5px;
    }
    
    .result-subtitle {
        font-size: 12px;
        color: #667eea;
        opacity: 0.8;
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
        cursor: pointer;
    }
    
    .bouquet-image.expanded {
        transform: scale(1.5);
    }
    
    .bouquet-description {
        background: rgba(255,255,255,0.5);
        border-radius: 10px;
        padding: 15px;
        margin: 20px 0;
        line-height: 1.6;
        color: #333;
    }
    
    .bouquet-details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        margin-top: 20px;
    }
    
    .detail-card {
        background: white;
        border-radius: 10px;
        padding: 15px;
        text-align: center;
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    }
    
    .detail-card-title {
        font-size: 12px;
        color: #666;
        margin-bottom: 5px;
        text-transform: uppercase;
    }
    
    .detail-card-value {
        font-size: 14px;
        font-weight: 600;
        color: #333;
    }
    
    .order-bouquet-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 15px 30px;
        border-radius: 30px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        display: inline-flex;
        align-items: center;
        gap: 10px;
    }
    
    .order-bouquet-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
    }
    
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

document.head.appendChild(style);

window.addEventListener('load', initChat);