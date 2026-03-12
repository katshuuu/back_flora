// public/js/order.js

let orderData = null;

document.addEventListener('DOMContentLoaded', () => {
    // Загружаем данные из localStorage
    const savedData = localStorage.getItem('orderData');
    if (savedData) {
        orderData = JSON.parse(savedData);
        displayOrderSummary();
    } else {
        // Проверяем, может это прямая ссылка на заказ
        const orderNumber = window.location.pathname.split('/').pop();
        if (orderNumber && orderNumber.startsWith('ORD-')) {
            loadOrderInfo(orderNumber);
        } else {
            showError('Информация о заказе не найдена');
        }
    }
    
    // Настраиваем отправку формы
    const form = document.getElementById('order-form');
    if (form) {
        form.addEventListener('submit', handleOrderSubmit);
    }
});

// Отображение сводки заказа
function displayOrderSummary() {
    if (!orderData || !orderData.sessionData) return;
    
    const summaryDiv = document.getElementById('order-summary');
    if (!summaryDiv) return;
    
    const session = orderData.sessionData;
    
    summaryDiv.innerHTML = `
        <div class="summary-card">
            <h3>Ваш букет</h3>
            <p><strong>Повод:</strong> ${session.occasion || 'Не указан'}</p>
            <p><strong>Для кого:</strong> ${session.recipient_person_type || 'Себя'}</p>
            <p><strong>Предпочтения:</strong> ${session.color_preferences || 'Любые цвета'}</p>
            
            <div class="selected-bouquet">
                ${session.bouquets?.find(b => b.id === orderData.bouquetId)?.imageUrl 
                    ? `<img src="${session.bouquets.find(b => b.id === orderData.bouquetId).imageUrl}" alt="Выбранный букет">` 
                    : ''}
            </div>
        </div>
    `;
}

// Обработка отправки формы
async function handleOrderSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    const orderPayload = {
        token: orderData.token,
        bouquetId: orderData.bouquetId,
        customerName: formData.get('name'),
        customerPhone: formData.get('phone'),
        customerEmail: formData.get('email'),
        deliveryAddress: formData.get('address'),
        deliveryDate: formData.get('deliveryDate'),
        deliveryComment: formData.get('comment')
    };
    
    // Валидация
    if (!orderPayload.customerName || !orderPayload.customerPhone) {
        showError('Имя и телефон обязательны для заполнения');
        return;
    }
    
    try {
        showLoader();
        
        const response = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Очищаем localStorage
            localStorage.removeItem('orderData');
            
            // Показываем успешное сообщение
            showSuccess(`
                <div class="success-page">
                    <h2>✅ Заказ оформлен!</h2>
                    <p>Номер вашего заказа: <strong>${data.orderNumber}</strong></p>
                    <p>Мы свяжемся с вами в ближайшее время для подтверждения.</p>
                    <button onclick="window.location.href='/'">На главную</button>
                </div>
            `);
        } else {
            showError(data.error || 'Ошибка оформления заказа');
        }
        
        hideLoader();
    } catch (err) {
        console.error('Ошибка:', err);
        showError('Не удалось оформить заказ');
        hideLoader();
    }
}

// Загрузка информации о заказе по номеру
async function loadOrderInfo(orderNumber) {
    try {
        showLoader();
        
        const response = await fetch(`/api/order/${orderNumber}`);
        const data = await response.json();
        
        if (data.error) {
            showError('Заказ не найден');
            return;
        }
        
        displayOrderInfo(data);
        hideLoader();
    } catch (err) {
        console.error('Ошибка:', err);
        showError('Не удалось загрузить информацию о заказе');
        hideLoader();
    }
}

// Отображение информации о заказе
function displayOrderInfo(order) {
    const container = document.getElementById('order-info');
    if (!container) return;
    
    container.innerHTML = `
        <div class="order-status-card">
            <h2>Заказ #${order.order_number}</h2>
            <div class="status-badge ${order.order_status}">
                Статус: ${getStatusText(order.order_status)}
            </div>
            
            <div class="order-details">
                <h3>Детали заказа</h3>
                <p><strong>Клиент:</strong> ${order.customer_name}</p>
                <p><strong>Телефон:</strong> ${order.customer_phone}</p>
                ${order.customer_email ? `<p><strong>Email:</strong> ${order.customer_email}</p>` : ''}
                ${order.delivery_address ? `<p><strong>Адрес доставки:</strong> ${order.delivery_address}</p>` : ''}
                ${order.delivery_date ? `<p><strong>Дата доставки:</strong> ${new Date(order.delivery_date).toLocaleString('ru-RU')}</p>` : ''}
                
                <div class="bouquet-info">
                    <h4>Выбранный букет</h4>
                    <img src="${order.image_url}" alt="Букет">
                    <p><strong>Повод:</strong> ${order.occasion || 'Не указан'}</p>
                    <p><strong>Предпочтения:</strong> ${order.color_preferences || 'Любые'}</p>
                </div>
            </div>
        </div>
    `;
}

// Вспомогательные функции
function getStatusText(status) {
    const statuses = {
        'pending': 'Ожидает подтверждения',
        'confirmed': 'Подтвержден',
        'paid': 'Оплачен',
        'delivered': 'Доставлен',
        'cancelled': 'Отменен'
    };
    return statuses[status] || status;
}

function showLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

function showSuccess(html) {
    const container = document.querySelector('.container');
    if (container) {
        container.innerHTML = html;
    }
}