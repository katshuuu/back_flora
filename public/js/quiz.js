// public/js/quiz.js - ЭТОТ ФАЙЛ БУДЕТ РАБОТАТЬ ТОЛЬКО НА СТРАНИЦЕ /quiz/:token

document.addEventListener('DOMContentLoaded', async () => {
    // Получаем токен из URL
    const token = window.location.pathname.split('/').pop();
    
    if (token && token.length > 20) {
        await loadQuizPage(token);
    }
});

async function loadQuizPage(token) {
    try {
        const response = await fetch(`/api/quiz-status/${token}`);
        const data = await response.json();
        
        if (data.status === 'ready' && data.image_url) {
            // Показываем готовый букет
            showBouquet(data);
        } else {
            // Показываем статус ожидания
            showWaitingStatus(data);
            // Запускаем опрос
            startPolling(token);
        }
    } catch (err) {
        console.error('Ошибка:', err);
        showError('Не удалось загрузить страницу');
    }
}

function showBouquet(data) {
    document.body.innerHTML = `
        <div class="bouquet-page">
            <h1>🌸 Ваш персональный букет</h1>
            <img src="${data.image_url}" alt="Букет" style="max-width: 100%;">
            <button onclick="window.location.href='/'">Создать новый букет</button>
        </div>
    `;
}

function showWaitingStatus(data) {
    // Отображаем статус ожидания
    // ... код отображения
}

function startPolling(token) {
    setInterval(async () => {
        const response = await fetch(`/api/quiz-status/${token}`);
        const data = await response.json();
        if (data.status === 'ready') {
            location.reload();
        }
    }, 3000);
}