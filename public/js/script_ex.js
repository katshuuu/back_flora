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
    currentImageUrl: null,
    orderId: null,
    generationRequestId: null
};

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
const SITE_URL = 'http://localhost:3000';

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

// Функция для показа сообщения о тесте для получателя
function showRecipientTestMessage() {
    const typingIndicator = showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        
        state.orderId = 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const message = `Мы предлагаем получателю (адресату букета) пройти небольшой тест для составления описания букета и его генерации. На основе полученных результатов я покажу, как выглядит Ваш индивидуальный и неповторимый букет!💐\n\n`;
        
        const messageDiv = addMessage(message, false);
        
        const actionButtons = createChoiceButtons([
            {
                text: 'Хорошо, сейчас отправлю ссылку получателю',
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
        
        const testLink = `${SITE_URL}/test.html?order=${state.orderId}`;
        
        addMessage(`Отлично! Отправьте получателю эту ссылку для прохождения теста:`, false);
        
        const linkDiv = document.createElement('div');
        linkDiv.className = 'test-link-container';
        linkDiv.innerHTML = `
            <div class="link-box">
                <a href="${testLink}" target="_blank">${testLink}</a>
                <button class="copy-link-btn" onclick="copyToClipboard('${testLink}')">
                    <i class="fas fa-copy"></i> Копировать
                </button>
            </div>
            <p style="margin-top: 10px;">После завершения теста изображение появится здесь автоматически</p>
        `;
        
        const lastMessage = chatMessages.lastChild;
        lastMessage.appendChild(linkDiv);
        
        showWaitingIndicator();
        
        state.currentStep = 'waitingForRecipient';
        creationProgress.style.display = 'none';
        
        startPollingForResults();
    }, 800);
}

// Функция для периодической проверки результатов
function startPollingForResults() {
    const pollInterval = setInterval(async () => {
        if (state.currentStep !== 'waitingForRecipient') {
            clearInterval(pollInterval);
            return;
        }
        
        try {
            const response = await fetch(`${SITE_URL}/api/check-order/${state.orderId}`);
            const data = await response.json();
            
            if (data.status === 'completed' && data.imageUrl) {
                clearInterval(pollInterval);
                handleRecipientTestComplete(data.imageUrl);
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 3000);
}

// Функция для обработки завершения теста получателем
function handleRecipientTestComplete(imageUrl) {
    const typingIndicator = showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        
        showGeneratedBouquet(imageUrl);
        
        creationProgress.style.display = 'none';
        
        state.currentStep = 'generation';
        state.currentImageUrl = imageUrl;
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

// Функция для показа сообщения о тесте для себя
function showSelfTestMessage() {
    const typingIndicator = showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        
        state.orderId = 'self_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        addMessage('Давайте создадим букет специально для вас! Я задам несколько вопросов, чтобы понять ваши предпочтения.', false);
        
        state.recipientType = 'self';
        state.currentStep = 'questions';
        
        creationProgress.style.display = 'flex';
        
        setTimeout(() => {
            askNextQuestion();
        }, 1500);
    }, 1000);
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
                <h3>Генерация вашего букета</h3>
                <p>Статус: <span class="waiting-status">в процессе</span></p>
                <p class="waiting-subtext">YandexART создает уникальное изображение...</p>
                <p class="waiting-order-id">ID заказа: ${state.orderId}</p>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(waitingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
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
        
        addMessage(`Отлично! Я получила все ваши ответы🌸 Сейчас начинаю генерацию вашего уникального букета с помощью YandexART...`, false);
        
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

// Функция для показа сгенерированного букета
function showGeneratedBouquet(imageUrl) {
    const waitingIndicator = document.getElementById('waitingIndicator');
    if (waitingIndicator) {
        waitingIndicator.remove();
    }
    
    const resultHTML = `
        <div class="bouquet-result">
            <div class="result-header">
                <div class="result-icon">
                    <i class="fas fa-magic"></i>
                </div>
                <div class="result-title">Ваш уникальный букет готов!</div>
                <div class="result-subtitle">Создано с помощью YandexART</div>
            </div>
            
            <div class="bouquet-image-container">
                <img class="bouquet-image" src="${imageUrl}" alt="Ваш уникальный букет" style="display: block; width: 100%; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
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
            
            <div class="action-buttons" style="display: flex;" id="actionButtons">
                <button class="action-btn order-btn" id="orderBtn">
                    <i class="fab fa-telegram"></i> Связаться с флористом 🌸
                </button>
                <button class="action-btn restart-btn" id="restartBtn">
                    <i class="fas fa-redo"></i> Создать новый букет
                </button>
            </div>
        </div>
    `;

    const resultDiv = document.createElement('div');
    resultDiv.innerHTML = resultHTML;
    
    chatMessages.appendChild(resultDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    state.currentImageUrl = imageUrl;

    setTimeout(() => {
        const orderBtn = document.getElementById('orderBtn');
        const restartBtn = document.getElementById('restartBtn');
        
        if (orderBtn) orderBtn.addEventListener('click', connectToFlorist);
        if (restartBtn) restartBtn.addEventListener('click', restartQuestionnaire);
    }, 100);
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

    orderDetails += `\n\nИзображение букета сгенерировано через YandexART. Флорист может воссоздать эту композицию с живыми цветами.`;

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
    
    .waiting-subtext {
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