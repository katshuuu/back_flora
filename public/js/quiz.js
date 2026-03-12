// quiz.js - скрипт для страницы /quiz/:token

document.addEventListener('DOMContentLoaded', function() {
    // Получаем токен из URL
    const pathParts = window.location.pathname.split('/');
    const token = pathParts[pathParts.length - 1];
    
    if (!token) {
        showError('Токен не найден');
        return;
    }
    
    console.log('🔍 Токен сессии:', token);
    
    // Элементы страницы
    const statusElement = document.getElementById('testStatus');
    const generationElement = document.getElementById('generationStatus');
    const chatMessages = document.getElementById('chatMessages');
    const creationProgress = document.getElementById('creationProgress');
    const progressStep = document.getElementById('progressStep');
    const progressFill = document.getElementById('progressFill');
    
    // Функция обновления статуса
    async function checkStatus() {
        try {
            const response = await fetch(`/api/quiz-status/${token}`);
            const data = await response.json();
            
            console.log('📊 Статус:', data);
            
            // Обновляем UI в зависимости от статуса
            switch(data.status) {
                case 'test_pending':
                    showTestPending();
                    break;
                case 'generation_pending':
                case 'generating':
                    showGenerating(data);
                    break;
                case 'ready':
                    showReady(data);
                    break;
                case 'failed':
                    showError(data.message);
                    break;
                case 'not_found':
                    showError('Сессия не найдена');
                    break;
            }
            
        } catch (error) {
            console.error('❌ Ошибка проверки статуса:', error);
        }
    }
    
    function showTestPending() {
        if (creationProgress) creationProgress.style.display = 'block';
        if (progressStep) progressStep.textContent = 'Ожидание прохождения теста';
        if (progressFill) progressFill.style.width = '30%';
        
        addAIMessage('🔄 Ожидаем прохождения теста в Telegram...');
        addAIMessage('После завершения теста здесь появится ваш уникальный букет!');
    }
    
    function showGenerating(data) {
        if (creationProgress) creationProgress.style.display = 'block';
        if (progressStep) progressStep.textContent = 'Генерация букета';
        if (progressFill) progressFill.style.width = '70%';
        
        addAIMessage('✨ Нейросеть создает ваш уникальный букет...');
        addAIMessage('Это займет около 30-60 секунд');
    }
    
    function showReady(data) {
        if (creationProgress) creationProgress.style.display = 'none';
        
        // Очищаем сообщения
        if (chatMessages) {
            chatMessages.innerHTML = '';
            
            // Добавляем сообщение с результатом
            addAIMessage('🎉 Ваш уникальный букет готов!');
            
            if (data.profile) {
                let profileText = '📊 Ваш профиль:\n';
                if (data.profile.mood) profileText += `• Настроение: ${data.profile.mood}\n`;
                if (data.profile.color) profileText += `• Цветовая гамма: ${data.profile.color}\n`;
                if (data.profile.person_type) profileText += `• Тип: ${data.profile.person_type}`;
                addAIMessage(profileText);
            }
            
            // Добавляем изображение
            const imageContainer = document.createElement('div');
            imageContainer.className = 'message ai-message';
            imageContainer.innerHTML = `
                <div class="message-header">
                    <i class="fas fa-spa"></i>
                    <span>FloraAI</span>
                </div>
                <img src="${data.image_url}" alt="Ваш букет" class="bouquet-image" style="max-width: 100%; border-radius: 10px; margin-top: 10px;">
                <div style="margin-top: 20px; text-align: center;">
                    <button class="button" onclick="proceedToOrder('${token}', ${data.bouquet_id})">
                        Продолжить оформление
                    </button>
                </div>
            `;
            chatMessages.appendChild(imageContainer);
        }
    }
    
    function showError(message) {
        if (creationProgress) creationProgress.style.display = 'none';
        addAIMessage(`❌ ${message || 'Произошла ошибка'}`);
    }
    
    function addAIMessage(text) {
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        messageDiv.innerHTML = `
            <div class="message-header">
                <i class="fas fa-spa"></i>
                <span>FloraAI</span>
            </div>
            <p>${text.replace(/\n/g, '<br>')}</p>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Запускаем опрос статуса каждые 3 секунды
    checkStatus();
    setInterval(checkStatus, 3000);
});

// Функция для перехода к оформлению заказа
function proceedToOrder(token, bouquetId) {
    window.location.href = `/order/${token}?bouquet=${bouquetId}`;
}