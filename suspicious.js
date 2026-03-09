// suspicious.js - Handles suspicious activity alerts

$(document).ready(function() {
    loadAlerts();
    
    $('#refresh-btn').click(function() {
        loadAlerts();
    });
});

function loadAlerts() {
    // Load alerts from localStorage
    const storedAlerts = localStorage.getItem('suspiciousAlerts');
    const alerts = storedAlerts ? JSON.parse(storedAlerts) : getSampleAlerts();
    
    displayAlerts(alerts);
}

function displayAlerts(alerts) {
    const container = $('#alerts-container');
    container.empty();
    
    if (alerts.length === 0) {
        container.html('<div class="alert alert-info">No suspicious activities detected.</div>');
        return;
    }
    
    alerts.forEach((alert, index) => {
        const alertHtml = `
            <div class="alert-card alert-${alert.type}">
                <h6><i class="fas fa-exclamation-triangle me-2"></i>${alert.title}</h6>
                <p class="mb-1">${alert.message}</p>
                <small class="text-muted">${alert.time}</small>
                <button class="btn btn-sm btn-outline-secondary ms-2" onclick="dismissAlert(${index})">Dismiss</button>
            </div>
        `;
        container.append(alertHtml);
    });
}

function dismissAlert(index) {
    const storedAlerts = localStorage.getItem('suspiciousAlerts');
    if (storedAlerts) {
        const alerts = JSON.parse(storedAlerts);
        alerts.splice(index, 1);
        localStorage.setItem('suspiciousAlerts', JSON.stringify(alerts));
        loadAlerts();
    }
}

// Function to trigger alert (can be called from login page)
function triggerSuspiciousAlert(type, accountNo, reason) {
    const alert = {
        type: type,
        title: getAlertTitle(type),
        message: `Account ${accountNo}: ${reason}`,
        time: new Date().toLocaleString()
    };
    
    // Store in localStorage
    const storedAlerts = localStorage.getItem('suspiciousAlerts');
    const alerts = storedAlerts ? JSON.parse(storedAlerts) : [];
    alerts.unshift(alert); // Add to beginning
    localStorage.setItem('suspiciousAlerts', JSON.stringify(alerts));
    
    // Show notification
    showNotification(alert.title, alert.message, type);
}

function getAlertTitle(type) {
    switch(type) {
        case 'danger': return 'Critical Security Alert';
        case 'warning': return 'Suspicious Activity Warning';
        default: return 'Alert';
    }
}

function showNotification(title, message, type) {
    // Create a simple notification
    const notification = $(`
        <div class="alert alert-${type} position-fixed" style="top: 20px; right: 20px; z-index: 9999; max-width: 300px;">
            <strong>${title}</strong><br>${message}
            <button type="button" class="btn-close" onclick="$(this).parent().fadeOut()"></button>
        </div>
    `);
    
    $('body').append(notification);
    setTimeout(() => notification.fadeOut(), 5000);
}

function getSampleAlerts() {
    return [
        {
            type: 'danger',
            title: 'Multiple Failed Login Attempts',
            message: 'Account 10234 has 3 failed login attempts in the last 5 minutes.',
            time: new Date().toLocaleString()
        },
        {
            type: 'warning',
            title: 'Large Transaction Detected',
            message: 'Transaction of ₹50,000 detected on account 10235.',
            time: new Date().toLocaleString()
        }
    ];
}