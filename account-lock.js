// account-lock.js - Handles account lock/unlock functionality

$(document).ready(function() {
    $('#unlock-form').submit(function(e) {
        e.preventDefault();
        unlockAccount();
    });
    
    $('#status-form').submit(function(e) {
        e.preventDefault();
        checkAccountStatus();
    });
});

function unlockAccount() {
    const accountNo = $('#account-no').val();
    const adminPassword = $('#admin-password').val();
    
    // Simulate admin authentication
    if (adminPassword !== 'admin123') {
        showResult('Invalid admin password', 'danger');
        return;
    }
    
    // Simulate unlocking account
    const success = simulateUnlock(accountNo);
    
    if (success) {
        showResult(`Account ${accountNo} has been unlocked successfully.`, 'success');
        $('#unlock-form')[0].reset();
    } else {
        showResult(`Failed to unlock account ${accountNo}.`, 'danger');
    }
}

function checkAccountStatus() {
    const accountNo = $('#check-account').val();
    
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

function simulateUnlock(accountNo) {
    // Get accounts from localStorage
    const accounts = getAccounts();
    const account = accounts[accountNo];
    
    if (account && account.status === 'LOCKED') {
        account.status = 'ACTIVE';
        account.failedAttempts = 0;
        saveAccounts(accounts);
        return true;
    }
    return false;
}

function simulateCheckStatus(accountNo) {
    const accounts = getAccounts();
    const account = accounts[accountNo];
    
    if (!account) {
        return {
            locked: false,
            failedAttempts: 0,
            lastActivity: 'Account not found'
        };
    }
    
    return {
        locked: account.status === 'LOCKED',
        failedAttempts: account.failedAttempts || 0,
        lastActivity: account.lastActivity || 'Never',
        deviceBoundId: account.deviceBoundId || 'Not bound',
        username: account.username,
        balance: account.balance
    };
}

function getAccounts() {
    const stored = localStorage.getItem('neoBankAccounts');
    if (stored) {
        return JSON.parse(stored);
    }
    
    // Initialize with sample accounts
    const accounts = {
        '10234': { username: 'user1', password: 'pass123', balance: 45000, status: 'ACTIVE', failedAttempts: 0, lastActivity: new Date().toLocaleString() },
        '10235': { username: 'user2', password: 'pass456', balance: 25000, status: 'ACTIVE', failedAttempts: 0, lastActivity: new Date().toLocaleString() },
        '10236': { username: 'user3', password: 'pass789', balance: 100000, status: 'ACTIVE', failedAttempts: 0, lastActivity: new Date().toLocaleString() }
    };
    saveAccounts(accounts);
    return accounts;
}

function saveAccounts(accounts) {
    localStorage.setItem('neoBankAccounts', JSON.stringify(accounts));
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

// Function to lock account (can be called from login page)
function lockAccount(accountNo, reason) {
    const accounts = getAccounts();
    const account = accounts[accountNo];
    
    if (account) {
        account.status = 'LOCKED';
        account.lockedUntil = Date.now() + (24 * 60 * 60 * 1000); // 24 hours freeze
        saveAccounts(accounts);
        
        if (typeof triggerSuspiciousAlert === 'function') {
            triggerSuspiciousAlert('danger', accountNo, reason);
        }
    }
}


// Function to check if account is locked
function isAccountLocked(accountNo) {
    const accounts = getAccounts();
    const account = accounts[accountNo];
    
    if (!account) return false;

    if (account.status === 'LOCKED') {
        if (account.lockedUntil && Date.now() < account.lockedUntil) {
            return true; // Still frozen
        } else {
            // Unlock automatically after 24 hrs
            account.status = 'ACTIVE';
            account.failedAttempts = 0;
            delete account.lockedUntil;
            saveAccounts(accounts);
            return false;
        }
    }
    return false;
}

// Function to record failed login attempt
function recordFailedAttempt(accountNo) {
    const accounts = getAccounts(); // Retrieve current accounts from storage
    const account = accounts[accountNo];
    
    if (account) {
        // Increment attempts (ensure it starts at 0 if undefined)
        account.failedAttempts = (account.failedAttempts || 0) + 1;
        
        // 🚨 LOCK TRIGGER: Change status if threshold is met
        if (account.failedAttempts >= 3) {
            account.status = 'LOCKED';
            
            // Check if the alert function exists before calling
            if (typeof triggerSuspiciousAlert === 'function') {
                triggerSuspiciousAlert('danger', accountNo, 'Account locked due to 3 failed login attempts');
            }
        }
        
        // CRITICAL: Save the updated account object back to localStorage
        saveAccounts(accounts);
    }
}

// Function to authenticate user
function authenticateUser(username, password) {
    const accounts = getAccounts();
    const currentDeviceId = localStorage.getItem('neoBankDeviceId');
    
    for (const [accountNo, account] of Object.entries(accounts)) {
        if (account.username === username) {
            
            // 🚨 1. CHECK LOCK STATUS FIRST
            // If status is LOCKED or attempts are already 3+, block login
            if (account.status === 'LOCKED' || (account.failedAttempts >= 3)) {
                return { 
                    success: false, 
                    message: 'Account is frozen due to multiple failed attempts. Try again after 24 hours.' 
                };
            }

            // 2. DEVICE BINDING CHECK (Lenient - Allow login with or without device match)
            // Only enforce device binding if a device ID is explicitly provided
            if (currentDeviceId && account.deviceBoundId && account.deviceBoundId !== currentDeviceId) {
                // Device ID mismatch warning, but allow login
                console.warn('Device mismatch warning for account ' + accountNo);
            }

            // 3. PASSWORD CHECK
            if (account.password === password) {
                // Success: Reset the counters
                account.failedAttempts = 0;
                account.status = 'ACTIVE';
                account.lastActivity = new Date().toLocaleString();
                
                // Update device binding if a new device ID is provided
                if (currentDeviceId && (!account.deviceBoundId || account.deviceBoundId === currentDeviceId)) {
                    account.deviceBoundId = currentDeviceId;
                }
                
                saveAccounts(accounts);
                return { success: true, accountNo: accountNo };
            } else {
                // Failure: Record attempt (this calls the function above)
                recordFailedAttempt(accountNo);
                
                // Get the updated count to show the user
                const updatedCount = getAccounts()[accountNo].failedAttempts;
                const remaining = 3 - updatedCount;
                
                return { 
                    success: false, 
                    message: updatedCount >= 3 
                        ? 'Account locked due to 3 failed attempts.' 
                        : `Invalid password. ${remaining} attempts remaining.` 
                };
            }
        }
    }
    
    return { success: false, message: 'User not found' };
}



// Function to clear all data (for testing)
function clearAllData() {
    if (confirm('Are you sure you want to clear ALL data? This will delete all accounts, transactions, and alerts.')) {
        localStorage.removeItem('neoBankAccounts');
        localStorage.removeItem('neoBankTransactions');
        localStorage.removeItem('suspiciousAlerts');
        localStorage.removeItem('neoBankDeviceId');
        localStorage.removeItem('currentAccount');
        alert('All data cleared!');
        location.reload();
    }
}