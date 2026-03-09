// main.js - Consolidated JavaScript for Neo Bank
// Contains all JavaScript functionality from all HTML pages

$(document).ready(function() {
    // Initialize based on current page
    const currentPage = window.location.pathname.split('/').pop();

    // Dashboard functionality
    if (currentPage === 'dashboard.html') {
        initDashboard();
    }

    // Login page functionality
    if (currentPage === 'loginpage.html') {
        initLoginPage();
    }

    // Registration functionality
    if (currentPage === 'registration.html') {
        initRegistration();
    }

    // Admin unlock functionality
    if (currentPage === 'admin-unlock.html') {
        initAdminUnlock();
    }

    // Suspicious alerts functionality
    if (currentPage === 'suspicious-alert.html') {
        initSuspiciousAlerts();
    }

    // Homepage functionality
    if (currentPage === 'indexlogin.html') {
        initHomepage();
    }

    // Registration success functionality
    if (currentPage === 'registration-success.html') {
        initRegistrationSuccess();
    }

    // Test pages
    if (currentPage === 'security-test.html' || currentPage === 'transfer-test.html') {
        // No special initialization needed for test pages
    }
});

// ===== DASHBOARD FUNCTIONALITY =====
function initDashboard() {
    // Upon initial load show any pending message from login
    const pending = sessionStorage.getItem('loginMessage');
    if (pending) {
        alert(pending);
        sessionStorage.removeItem('loginMessage');
    }

    // Check if user is logged in
    const loggedInAccount = localStorage.getItem('currentAccount');
    if (!loggedInAccount) {
        window.location.replace('loginpage.html');
        return;
    }

    currentAccount = loggedInAccount;
    loadAccountData();

    $('#transfer-form').submit(function(e) {
        e.preventDefault();
        performTransfer();
    });
}

let currentAccount = null;

function loadAccountData() {
    const accounts = getAccounts();
    const account = accounts[currentAccount];

    if (account) {
        $('#account-no').text(currentAccount);
        $('#balance').text('₹' + account.balance.toLocaleString('en-IN'));
        $('#device-id').text(account.deviceBoundId || 'Not bound');

        // Monitor balance viewing activity
        monitorBalanceAccess();

        loadTransactions();
    }
}

function performTransfer() {
    const amount = parseFloat($('#amount').val());
    const recipientAccountNo = $('#recipient').val().trim();

    if (amount <= 0) {
        alert('Invalid amount');
        return;
    }

    if (!recipientAccountNo) {
        alert('Please enter recipient account number');
        return;
    }

    const accounts = getAccounts();
    const senderAccount = accounts[currentAccount];
    const recipientAccount = accounts[recipientAccountNo];

    // Validate recipient account exists
    if (!recipientAccount) {
        alert('Recipient account not found. Please check the account number.');
        return;
    }

    // Don't allow transfer to self
    if (recipientAccountNo === currentAccount) {
        alert('Cannot transfer to your own account');
        return;
    }

    if (senderAccount.balance < amount) {
        alert('Insufficient balance');
        return;
    }

    // Perform the transfer
    senderAccount.balance -= amount;
    recipientAccount.balance += amount;

    // Add transaction records
    addTransaction(currentAccount, 'Transfer to Account ' + recipientAccountNo, -amount);
    addTransaction(recipientAccountNo, 'Received from Account ' + currentAccount, amount);

    // Check for suspicious activity on sender
    if (amount > 50000) {
        triggerSuspiciousAlert('warning', currentAccount, 'Large transaction: ₹' + amount.toLocaleString('en-IN') + ' to Account ' + recipientAccountNo);
    }

    // Check high frequency (simplified)
    const recentTransactions = getRecentTransactions(currentAccount);
    if (recentTransactions.length > 5) {
        triggerSuspiciousAlert('warning', currentAccount, 'High frequency transactions detected');
    }

    saveAccounts(accounts);
    loadAccountData();
    $('#transfer-form')[0].reset();

    alert('Transfer successful! ₹' + amount.toLocaleString('en-IN') + ' transferred to Account ' + recipientAccountNo);
}

function addTransaction(accountNo, description, amount) {
    const transactions = getTransactions();
    const transaction = {
        id: Date.now(),
        accountNo: accountNo,
        description: description,
        amount: amount,
        timestamp: new Date().toISOString()
    };

    transactions.push(transaction);
    localStorage.setItem('neoBankTransactions', JSON.stringify(transactions));
}

function getTransactions() {
    const stored = localStorage.getItem('neoBankTransactions');
    return stored ? JSON.parse(stored) : [];
}

function getRecentTransactions(accountNo) {
    const transactions = getTransactions();
    const oneHourAgo = new Date(Date.now() - 3600000);

    return transactions.filter(t =>
        t.accountNo === accountNo &&
        new Date(t.timestamp) > oneHourAgo
    );
}

function loadTransactions() {
    const transactions = getTransactions().filter(t => t.accountNo === currentAccount).slice(-5);

    if (transactions.length === 0) {
        $('#transactions-list').html('<p class="text-muted">No recent transactions</p>');
        return;
    }

    let html = '<div class="list-group">';
    transactions.reverse().forEach(t => {
        const date = new Date(t.timestamp).toLocaleString();
        const amountClass = t.amount < 0 ? 'text-danger' : 'text-success';
        html += `
            <div class="list-group-item bg-transparent border-secondary">
                <div class="d-flex justify-content-between">
                    <div>
                        <strong>${t.description}</strong>
                        <br><small class="text-muted">${date}</small>
                    </div>
                    <div class="${amountClass} fw-bold">
                        ${t.amount < 0 ? '-' : '+'}₹${Math.abs(t.amount).toLocaleString('en-IN')}
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';

    $('#transactions-list').html(html);
}

function logout() {
    localStorage.removeItem('currentAccount');
    window.location.href = 'indexlogin.html';
}

// Security monitoring functions
function monitorBalanceAccess() {
    const now = Date.now();
    const accessKey = `balanceAccess_${currentAccount}`;
    const stored = localStorage.getItem(accessKey);

    let accessLog = stored ? JSON.parse(stored) : [];

    // Add current access
    accessLog.push(now);

    // Keep only last hour's accesses
    const oneHourAgo = now - 3600000;
    accessLog = accessLog.filter(time => time > oneHourAgo);

    // Check for suspicious activity
    if (accessLog.length > 15) { // More than 15 balance checks per hour
        triggerSuspiciousAlert('warning', currentAccount, 'Excessive balance viewing detected: ' + accessLog.length + ' checks in last hour');
    }

    localStorage.setItem(accessKey, JSON.stringify(accessLog));
}

function monitorTransactionHistoryAccess() {
    const now = Date.now();
    const accessKey = `historyAccess_${currentAccount}`;
    const stored = localStorage.getItem(accessKey);

    let accessLog = stored ? JSON.parse(stored) : [];

    // Add current access
    accessLog.push(now);

    // Keep only last hour's accesses
    const oneHourAgo = now - 3600000;
    accessLog = accessLog.filter(time => time > oneHourAgo);

    // Check for suspicious activity
    if (accessLog.length > 10) { // More than 10 history views per hour
        triggerSuspiciousAlert('warning', currentAccount, 'Frequent transaction history access: ' + accessLog.length + ' views in last hour');
    }

    localStorage.setItem(accessKey, JSON.stringify(accessLog));
}

// Monitor transaction history access when loadTransactions is called
const originalLoadTransactions = loadTransactions;
loadTransactions = function() {
    monitorTransactionHistoryAccess();
    return originalLoadTransactions.apply(this, arguments);
};

// ===== LOGIN PAGE FUNCTIONALITY =====
function initLoginPage() {
    document.querySelector('form').addEventListener('submit', function(e) {
        e.preventDefault();

        const username = document.getElementById('login-username').value;
        const password = document.getElementById('pwd').value;
        const deviceIdInput = document.getElementById('deviceIdInput').value.trim();

        let result;

        if (deviceIdInput) {
            // If device ID is provided, use it
            const originalDeviceId = localStorage.getItem('neoBankDeviceId');
            localStorage.setItem('neoBankDeviceId', deviceIdInput);
            result = authenticateUser(username, password);

            if (!result.success && originalDeviceId) {
                // Restore original device ID if login failed
                localStorage.setItem('neoBankDeviceId', originalDeviceId);
            }
        } else {
            // Try without device ID first
            result = authenticateUser(username, password);
        }

        // ✅ Check if login was successful
        if (result.success === true) {
            // save account first so dashboard sees it
            localStorage.setItem('currentAccount', result.accountNo);
            localStorage.setItem('isLoggedIn', 'true');

            // store a small flag so the dashboard can show feedback
            sessionStorage.setItem('loginMessage', 'Login successful! Account: ' + result.accountNo);

            // redirect immediately; using replace avoids history entry and
            // ensures the navigation takes effect even if an alert is open.
            window.location.replace('dashboard.html');
            return; // nothing else should run after redirect
        } else {
            alert('Login failed: ' + result.message);
        }
    });
}

// ===== REGISTRATION FUNCTIONALITY =====
function initRegistration() {
    // Generate or retrieve persistent Device ID
    function getDeviceId() {
        let deviceId = localStorage.getItem('neoBankDeviceId');
        if (!deviceId) {
            deviceId = "NB-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 5).toUpperCase();
            localStorage.setItem('neoBankDeviceId', deviceId);
        }
        return deviceId;
    }

    // Copy Device ID to clipboard
    window.copyDeviceId = function() {
        const deviceId = $('#deviceId').text();
        navigator.clipboard.writeText(deviceId).then(function() {
            // Show temporary feedback
            const originalText = $('#deviceId').text();
            $('#deviceId').text('COPIED!');
            setTimeout(() => $('#deviceId').text(originalText), 1000);
        }).catch(function(err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = deviceId;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            $('#deviceId').text('COPIED!');
            setTimeout(() => $('#deviceId').text(originalText), 1000);
        });
    };

    // Simulate Device Fingerprinting on page load
    const hardwareID = getDeviceId();
    $('#deviceId').text(hardwareID);

    // Generate account preview when name is typed
    $('input[placeholder="Arjun Sharma"]').on('input', function() {
        const fullName = $(this).val();
        if (fullName.length > 2) {
            const accountNo = '10' + Math.floor(Math.random() * 90000 + 10000);
            const username = fullName.toLowerCase().replace(/\s+/g, '') + accountNo.slice(-4);
            $('#previewUsername').text(username);
            $('#previewAccountNo').text(accountNo);
            $('#accountPreview').show();
        } else {
            $('#accountPreview').hide();
        }
    });

    // Capture Behavioral Biometrics (Typing Speed)
    let keystrokes = [];
    $('input').on('keydown', function(e) {
        keystrokes.push(Date.now());
    });

    $('#regForm').on('submit', function(e) {
        e.preventDefault();

        // Monitor registration attempts
        if (!monitorRegistrationAttempts()) {
            return; // Registration blocked due to suspicious activity
        }

        // Get form data
        const fullName = $('input[placeholder="Arjun Sharma"]').val();
        const aadhaar = $('input[placeholder="XXXX XXXX 1234"]').val();
        const pan = $('input[placeholder="ABCDE1234F"]').val();
        const mobile = $('input[placeholder="98765 43210"]').val();
        const pin = $('#pin').val();

        if (pin.length !== 6) {
            alert('PIN must be exactly 6 digits');
            return;
        }

        if (fullName.length < 3) {
            alert('Please enter your full name');
            return;
        }

        // Generate account number
        const accountNo = '10' + Math.floor(Math.random() * 90000 + 10000);

        // Create username from name
        const username = fullName.toLowerCase().replace(/\s+/g, '') + accountNo.slice(-4);

        // Get existing accounts
        const accounts = getAccounts();

        // Create new account
        accounts[accountNo] = {
            username: username,
            password: pin,
            balance: 100000, // Initial balance ₹1,00,000 for testing
            status: 'ACTIVE',
            failedAttempts: 0,
            lastActivity: new Date().toLocaleString(),
            deviceBoundId: hardwareID,
            fullName: fullName,
            aadhaar: aadhaar,
            pan: pan,
            mobile: mobile,
            registrationDate: new Date().toISOString()
        };

        // Save accounts
        saveAccounts(accounts);

        // Store registration data for success page
        localStorage.setItem('regUsername', username);
        localStorage.setItem('regAccountNo', accountNo);
        localStorage.setItem('regPassword', pin);
        localStorage.setItem('regDeviceId', hardwareID);

        // Redirect to success page with parameters
        const params = new URLSearchParams({
            username: username,
            accountNo: accountNo,
            password: pin,
            deviceId: hardwareID
        });

        window.location.href = "registration-success.html?" + params.toString();
    });
}

// Security monitoring functions
function monitorRegistrationAttempts() {
    const now = Date.now();
    const regKey = 'registrationAttempts';
    const stored = localStorage.getItem(regKey);

    let attempts = stored ? JSON.parse(stored) : [];

    // Add current attempt
    attempts.push(now);

    // Keep only last hour's attempts
    const oneHourAgo = now - 900;
    attempts = attempts.filter(time => time > oneHourAgo);

    // Check for suspicious activity
    if (attempts.length > 5) { // More than 5 registration attempts per hour
        alert('Suspicious activity detected: Multiple account creation attempts. Registration temporarily blocked for security reasons.');
        return false;
    }

    localStorage.setItem(regKey, JSON.stringify(attempts));
    return true;
}

// ===== ADMIN UNLOCK FUNCTIONALITY =====
function initAdminUnlock() {
    $('#unlock-form').submit(function(e) {
        e.preventDefault();
        if (monitorAdminAccess()) {
            unlockAccount();
        }
    });

    $('#status-form').submit(function(e) {
        e.preventDefault();
        if (monitorAdminAccess()) {
            checkAccountStatus();
        }
    });
}

// Security monitoring for admin operations
function monitorAdminAccess() {
    const now = Date.now();
    const adminKey = 'adminAccessAttempts';
    const stored = localStorage.getItem(adminKey);

    let attempts = stored ? JSON.parse(stored) : [];

    // Add current attempt
    attempts.push(now);

    // Keep only last hour's attempts
    const oneHourAgo = now - 3600000;
    attempts = attempts.filter(time => time > oneHourAgo);

    // Check for suspicious activity
    if (attempts.length > 10) { // More than 10 admin access attempts per hour
        alert('Security Alert: Excessive admin panel access detected. Access temporarily restricted.');
        return false;
    }

    localStorage.setItem(adminKey, JSON.stringify(attempts));
    return true;
}

function unlockAccount() {
    const accountNo = $('#account-no').val();
    const adminPassword = $('#admin-password').val();

    // Simulate admin authentication
    if (adminPassword !== 'admin123') {
        showResult('Invalid admin password', 'danger');
        // Log failed admin attempt
        logAdminAction('Failed unlock attempt for account ' + accountNo);
        return;
    }

    // Simulate unlocking account
    const success = simulateUnlock(accountNo);

    if (success) {
        showResult(`Account ${accountNo} has been unlocked successfully.`, 'success');
        logAdminAction('Successfully unlocked account ' + accountNo);
        $('#unlock-form')[0].reset();
    } else {
        showResult(`Failed to unlock account ${accountNo}.`, 'danger');
        logAdminAction('Failed unlock attempt for account ' + accountNo);
    }
}

function checkAccountStatus() {
    const accountNo = $('#check-account').val();

    // Log admin status check
    logAdminAction('Status check for account ' + accountNo);

    // Simulate checking status
    const status = simulateCheckStatus(accountNo);

    const statusHtml = `
        <div class="alert alert-${status.locked ? 'danger' : 'success'}">
            <strong>Account ${accountNo}</strong><br>
            Status: <span class="status-${status.locked ? 'locked' : 'active'}">${status.locked ? 'LOCKED' : 'ACTIVE'}</span><br>
            Failed Attempts: ${status.failedAttempts}<br>
            Last Activity: ${status.lastActivity}<br>
            Username: ${status.username || 'N/A'}<br>
            Balance: ₹${status.balance ? status.balance.toLocaleString('en-IN') : 'N/A'}<br>
            Device Bound ID: <span style="font-family: monospace;">${status.deviceBoundId}</span>
        </div>
    `;

    $('#status-result').html(statusHtml);
}

function logAdminAction(action) {
    const adminLogKey = 'adminActionLog';
    const stored = localStorage.getItem(adminLogKey);
    const logEntry = {
        action: action,
        timestamp: new Date().toISOString(),
        adminDeviceId: localStorage.getItem('neoBankDeviceId') || 'Unknown'
    };

    let log = stored ? JSON.parse(stored) : [];
    log.push(logEntry);

    // Keep only last 100 entries
    if (log.length > 100) {
        log = log.slice(-100);
    }

    localStorage.setItem(adminLogKey, JSON.stringify(log));
}

function showResult(message, type) {
    const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
    const resultHtml = `<div class="alert ${alertClass} mt-3">${message}</div>`;

    // Remove existing alerts
    $('.alert').not('#status-result .alert').remove();

    // Add new alert
    $('#unlock-form').after(resultHtml);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        $('.alert').fadeOut();
    }, 5000);
}

// ===== SUSPICIOUS ALERTS FUNCTIONALITY =====
function initSuspiciousAlerts() {
    loadAlerts();

    $('#refresh-btn').click(function() {
        monitorAlertsAccess();
        loadAlerts();
    });

    // Monitor initial page access
    monitorAlertsAccess();
}

function monitorAlertsAccess() {
    const now = Date.now();
    const alertsKey = 'alertsPageAccess';
    const stored = localStorage.getItem(alertsKey);

    let accessLog = stored ? JSON.parse(stored) : [];

    // Add current access
    accessLog.push(now);

    // Keep only last hour's accesses
    const oneHourAgo = now - 3600000;
    accessLog = accessLog.filter(time => time > oneHourAgo);

    // Check for suspicious activity
    if (accessLog.length > 20) { // More than 20 alerts page accesses per hour
        triggerSuspiciousAlert('warning', 'SYSTEM', 'Excessive alerts page access detected: ' + accessLog.length + ' views in last hour');
    }

    localStorage.setItem(alertsKey, JSON.stringify(accessLog));
}

// ===== HOMEPAGE FUNCTIONALITY =====
function initHomepage() {
    // Monitor homepage access
    monitorHomepageAccess();

    // Monitor clicks on sensitive links
    $('a[href="admin-unlock.html"]').click(function() {
        monitorAdminLinkAccess();
    });

    $('a[href="suspicious-alert.html"]').click(function() {
        monitorAlertsLinkAccess();
    });
}

function monitorHomepageAccess() {
    const now = Date.now();
    const homeKey = 'homepageAccess';
    const stored = localStorage.getItem(homeKey);

    let accessLog = stored ? JSON.parse(stored) : [];

    // Add current access
    accessLog.push(now);

    // Keep only last hour's accesses
    const oneHourAgo = now - 3600000;
    accessLog = accessLog.filter(time => time > oneHourAgo);

    // Check for suspicious activity
    if (accessLog.length > 30) { // More than 30 homepage accesses per hour
        triggerSuspiciousAlert('warning', 'SYSTEM', 'Excessive homepage access detected: ' + accessLog.length + ' visits in last hour');
    }

    localStorage.setItem(homeKey, JSON.stringify(accessLog));
}

function monitorAdminLinkAccess() {
    const now = Date.now();
    const adminLinkKey = 'adminLinkAccess';
    const stored = localStorage.getItem(adminLinkKey);

    let accessLog = stored ? JSON.parse(stored) : [];

    // Add current access
    accessLog.push(now);

    // Keep only last hour's accesses
    const oneHourAgo = now - 3600000;
    accessLog = accessLog.filter(time => time > oneHourAgo);

    // Check for suspicious activity
    if (accessLog.length > 5) { // More than 5 admin link clicks per hour
        triggerSuspiciousAlert('danger', 'SYSTEM', 'Multiple attempts to access admin panel: ' + accessLog.length + ' clicks in last hour');
    }

    localStorage.setItem(adminLinkKey, JSON.stringify(accessLog));
}

function monitorAlertsLinkAccess() {
    const now = Date.now();
    const alertsLinkKey = 'alertsLinkAccess';
    const stored = localStorage.getItem(alertsLinkKey);

    let accessLog = stored ? JSON.parse(stored) : [];

    // Add current access
    accessLog.push(now);

    // Keep only last hour's accesses
    const oneHourAgo = now - 3600000;
    accessLog = accessLog.filter(time => time > oneHourAgo);

    // Check for suspicious activity
    if (accessLog.length > 10) { // More than 10 alerts link clicks per hour
        triggerSuspiciousAlert('warning', 'SYSTEM', 'Frequent security alerts page access: ' + accessLog.length + ' clicks in last hour');
    }

    localStorage.setItem(alertsLinkKey, JSON.stringify(accessLog));
}

// ===== ADMIN UNLOCK FUNCTIONALITY =====
function initAdminUnlock() {
    $('#unlock-form').submit(function(e) {
        e.preventDefault();
        if (monitorAdminAccess()) {
            unlockAccount();
        }
    });

    $('#status-form').submit(function(e) {
        e.preventDefault();
        if (monitorAdminAccess()) {
            checkAccountStatus();
        }
    });
}

// Security monitoring for admin operations
function monitorAdminAccess() {
    const now = Date.now();
    const adminKey = 'adminAccessAttempts';
    const stored = localStorage.getItem(adminKey);

    let attempts = stored ? JSON.parse(stored) : [];

    // Add current attempt
    attempts.push(now);

    // Keep only last hour's attempts
    const oneHourAgo = now - 3600000;
    attempts = attempts.filter(time => time > oneHourAgo);

    // Check for suspicious activity
    if (attempts.length > 10) { // More than 10 admin access attempts per hour
        alert('Security Alert: Excessive admin panel access detected. Access temporarily restricted.');
        return false;
    }

    localStorage.setItem(adminKey, JSON.stringify(attempts));
    return true;
}

function unlockAccount() {
    const accountNo = $('#account-no').val();
    const adminPassword = $('#admin-password').val();

    // Simulate admin authentication
    if (adminPassword !== 'admin123') {
        showResult('Invalid admin password', 'danger');
        // Log failed admin attempt
        logAdminAction('Failed unlock attempt for account ' + accountNo);
        return;
    }

    // Simulate unlocking account
    const success = simulateUnlock(accountNo);

    if (success) {
        showResult(`Account ${accountNo} has been unlocked successfully.`, 'success');
        logAdminAction('Successfully unlocked account ' + accountNo);
        $('#unlock-form')[0].reset();
    } else {
        showResult(`Failed to unlock account ${accountNo}.`, 'danger');
        logAdminAction('Failed unlock attempt for account ' + accountNo);
    }
}

function checkAccountStatus() {
    const accountNo = $('#check-account').val();

    // Log admin status check
    logAdminAction('Status check for account ' + accountNo);

    // Simulate checking status
    const status = simulateCheckStatus(accountNo);

    const statusHtml = `
        <div class="alert alert-${status.locked ? 'danger' : 'success'}">
            <strong>Account ${accountNo}</strong><br>
            Status: <span class="status-${status.locked ? 'locked' : 'active'}">${status.locked ? 'LOCKED' : 'ACTIVE'}</span><br>
            Failed Attempts: ${status.failedAttempts}<br>
            Last Activity: ${status.lastActivity}<br>
            Username: ${status.username || 'N/A'}<br>
            Balance: ₹${status.balance ? status.balance.toLocaleString('en-IN') : 'N/A'}<br>
            Device Bound ID: <span style="font-family: monospace;">${status.deviceBoundId}</span>
        </div>
    `;

    $('#status-result').html(statusHtml);
}

function logAdminAction(action) {
    const adminLogKey = 'adminActionLog';
    const stored = localStorage.getItem(adminLogKey);
    const logEntry = {
        action: action,
        timestamp: new Date().toISOString(),
        adminDeviceId: localStorage.getItem('neoBankDeviceId') || 'Unknown'
    };

    let log = stored ? JSON.parse(stored) : [];
    log.push(logEntry);

    // Keep only last 100 entries
    if (log.length > 100) {
        log = log.slice(-100);
    }

    localStorage.setItem(adminLogKey, JSON.stringify(log));
}

// ===== SUSPICIOUS ALERTS FUNCTIONALITY =====
function initSuspiciousAlerts() {
    loadAlerts();

    $('#refresh-btn').click(function() {
        monitorAlertsAccess();
        loadAlerts();
    });

    // Monitor initial page access
    monitorAlertsAccess();
}

function monitorAlertsAccess() {
    const now = Date.now();
    const alertsKey = 'alertsPageAccess';
    const stored = localStorage.getItem(alertsKey);
    
    let accessLog = stored ? JSON.parse(stored) : [];
    
    // Add current access
    accessLog.push(now);
    
    // Keep only last hour's accesses
    const oneHourAgo = now - 3600000;
    accessLog = accessLog.filter(time => time > oneHourAgo);
    
    // Check for suspicious activity
    if (accessLog.length > 20) { // More than 20 alerts page accesses per hour
        triggerSuspiciousAlert('warning', 'SYSTEM', 'Excessive alerts page access detected: ' + accessLog.length + ' views in last hour');
    }
    
    localStorage.setItem(alertsKey, JSON.stringify(accessLog));
}


// ===== REGISTRATION SUCCESS FUNCTIONALITY =====
function initRegistrationSuccess() {
    loadRegistrationData();
}

// Load registration data from URL parameters or localStorage
function loadRegistrationData() {
    // Try to get data from URL parameters (passed from registration form)
    const urlParams = new URLSearchParams(window.location.search);

    const username = urlParams.get('username') || localStorage.getItem('regUsername');
    const accountNo = urlParams.get('accountNo') || localStorage.getItem('regAccountNo');
    const password = urlParams.get('password') || localStorage.getItem('regPassword');
    const deviceId = urlParams.get('deviceId') || localStorage.getItem('regDeviceId');

    if (username && accountNo && password && deviceId) {
        document.getElementById('username').textContent = username;
        document.getElementById('username').setAttribute('data-value', username);

        document.getElementById('accountNo').textContent = accountNo;
        document.getElementById('accountNo').setAttribute('data-value', accountNo);

        document.getElementById('password').textContent = password;
        document.getElementById('password').setAttribute('data-value', password);

        document.getElementById('deviceId').textContent = deviceId;
        document.getElementById('deviceId').setAttribute('data-value', deviceId);
    } else {
        // If no data found, redirect back to registration
        alert('Registration data not found. Please complete registration first.');
        window.location.href = 'registration.html';
    }
}

// Copy individual credential to clipboard
function copyToClipboard(element) {
    const value = element.getAttribute('data-value') || element.textContent;
    navigator.clipboard.writeText(value).then(function() {
        // Show temporary feedback
        const originalText = element.textContent;
        element.textContent = 'COPIED!';
        element.style.background = 'rgba(40, 167, 69, 0.2)';
        setTimeout(() => {
            element.textContent = originalText;
            element.style.background = '';
        }, 1000);
    }).catch(function(err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = value;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        const originalText = element.textContent;
        element.textContent = 'COPIED!';
        element.style.background = 'rgba(40, 167, 69, 0.2)';
        setTimeout(() => {
            element.textContent = originalText;
            element.style.background = '';
        }, 1000);
    });
}

// Copy all credentials at once
function copyAllCredentials() {
    const username = document.getElementById('username').getAttribute('data-value');
    const accountNo = document.getElementById('accountNo').getAttribute('data-value');
    const password = document.getElementById('password').getAttribute('data-value');
    const deviceId = document.getElementById('deviceId').getAttribute('data-value');

    const allCredentials = `Neo Bank Account Credentials:

👤 Username: ${username}
🔢 Account Number: ${accountNo}
🔑 Password: ${password}
💻 Device Bound ID: ${deviceId}
💰 Initial Balance: ₹1,000

⚠️  Save these credentials securely!`;

    navigator.clipboard.writeText(allCredentials).then(function() {
        alert('All credentials copied to clipboard!');
    }).catch(function(err) {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = allCredentials;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('All credentials copied to clipboard!');
    });
}
