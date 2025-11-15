import { getAuthToken, logout } from './oauth.js';
import { startClassification } from './batch.js';

/**
 * OAuth status constants
 */
const OAUTH_STATUS = {
    VALID_TOKEN: "VALID TOKEN",
    MAIL_MISMATCH: "MAIL ACCOUNT MISMATCH",
    TOKEN_EXPIRED: "TOKEN EXPIRED",
    NO_TOKEN: "NO TOKEN"
};

/**
 * UI state configuration for different OAuth statuses
 */
const UI_STATES = {
    [OAUTH_STATUS.VALID_TOKEN]: {
        statusDot: 'active',
        message: 'APOLLO is running and protecting your inbox.',
        hideElements: ['login'],
        showElements: ['signout', 'classification']
    },
    [OAUTH_STATUS.MAIL_MISMATCH]: {
        statusDot: 'warning',
        message: 'Account mismatch detected. Please sign in with the Gmail account you are currently using.',
        hideElements: ['classification', 'signout'],
        showElements: ['login']
    },
    [OAUTH_STATUS.TOKEN_EXPIRED]: {
        statusDot: 'error',
        message: 'Your session has expired. Please sign in again to continue using APOLLO.',
        hideElements: ['classification', 'signout'],
        showElements: ['login']
    },
    [OAUTH_STATUS.NO_TOKEN]: {
        statusDot: 'error',
        message: 'Sign in with your Google account to start protecting your inbox.',
        hideElements: ['classification', 'signout'],
        showElements: ['login']
    }
};

/**
 * DOM element references
 */
const elements = {
    login: null,
    signout: null,
    options: null,
    classification: null,
    account: null,
    details: null,
    statusDot: null
};

/**
 * Initialize popup UI and attach event listeners
 */
async function initializePopup() {
    // Get all DOM element references
    getElementReferences();

    // Attach event listeners
    attachEventListeners();

    // Update UI based on current OAuth status
    await updateUIState();
}

/**
 * Get references to all DOM elements
 */
function getElementReferences() {
    elements.login = document.getElementById('login');
    elements.signout = document.getElementById('signout');
    elements.options = document.getElementById('options');
    elements.classification = document.getElementById('classification');
    elements.account = document.getElementById('account');
    elements.details = document.getElementById('details');
    elements.statusDot = document.getElementById('status-dot');
}

/**
 * Attach event listeners to interactive elements
 */
function attachEventListeners() {
    // Login button
    if (elements.login) {
        elements.login.addEventListener('click', handleLogin);
    }

    // Sign out button
    if (elements.signout) {
        elements.signout.addEventListener('click', handleSignOut);
    }

    // Options button
    if (elements.options) {
        elements.options.addEventListener('click', handleOptions);
    }

    // Classification button
    if (elements.classification) {
        elements.classification.addEventListener('click', handleClassification);
    }
}

/**
 * Handle login button click
 */
async function handleLogin() {
    try {
        elements.login.disabled = true;
        await getAuthToken();
        
        // Wait a moment for storage to update, then refresh UI
        setTimeout(async () => {
            await updateUIState();
        }, 500);
        
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Login failed. Please try again.', 'error');
    } finally {
        elements.login.disabled = false;
    }
}

/**
 * Handle sign out button click
 */
async function handleSignOut() {
    const confirmed = confirm(
        'Are you sure you want to sign out? You will need to log in again to use APOLLO.'
    );

    if (!confirmed) return;

    try {
        elements.signout.disabled = true;
        await logout();
        
        // Update UI to reflect logged out state
        await updateUIState();
        showNotification('You have been signed out successfully.', 'success');
        
    } catch (error) {
        console.error('Sign out error:', error);
        showNotification('Sign out failed. Please try again.', 'error');
    } finally {
        elements.signout.disabled = false;
    }
}

/**
 * Handle options button click
 */
function handleOptions() {
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        window.open(chrome.runtime.getURL('./options/options.html'));
    }
}

/**
 * Handle classification button click
 */
async function handleClassification() {
    try {
        // Set loading state
        setClassificationLoading(true);
        
        // Start classification
        await startClassification();
        
        showNotification('Classification completed successfully!', 'success');
        
    } catch (error) {
        console.error('Classification error:', error);
        showNotification('Classification failed. Please try again.', 'error');
    } finally {
        // Remove loading state
        setClassificationLoading(false);
    }
}

/**
 * Set loading state for classification button
 * @param {boolean} isLoading - Whether classification is in progress
 */
function setClassificationLoading(isLoading) {
    if (!elements.classification) return;

    elements.classification.disabled = isLoading;
    
    if (isLoading) {
        elements.classification.classList.add('loading');
    } else {
        elements.classification.classList.remove('loading');
    }
}

/**
 * Update UI state based on OAuth status
 */
async function updateUIState() {
    try {
        // Fetch OAuth status and user info from storage
        const { oauth_status, userInfo } = await chrome.storage.session.get([
            'oauth_status',
            'userInfo'
        ]);

        // Determine current state (default to NO_TOKEN if undefined)
        const currentStatus = oauth_status || OAUTH_STATUS.NO_TOKEN;
        const state = UI_STATES[currentStatus] || UI_STATES[OAUTH_STATUS.NO_TOKEN];

        // Update account label
        if (elements.account) {
            elements.account.textContent = userInfo || 'Not logged in';
        }

        // Update status dot
        if (elements.statusDot) {
            elements.statusDot.className = `status-dot ${state.statusDot}`;
        }

        // Update details message
        if (elements.details) {
            elements.details.textContent = state.message;
        }

        // Show/hide elements based on state
        hideElements(state.hideElements);
        showElements(state.showElements);

    } catch (error) {
        console.error('Error updating UI state:', error);
    }
}

/**
 * Hide specified elements
 * @param {string[]} elementIds - Array of element IDs to hide
 */
function hideElements(elementIds) {
    elementIds.forEach(id => {
        const element = elements[id];
        if (element) {
            element.classList.remove('show');
        }
    });
}

/**
 * Show specified elements
 * @param {string[]} elementIds - Array of element IDs to show
 */
function showElements(elementIds) {
    elementIds.forEach(id => {
        const element = elements[id];
        if (element) {
            element.classList.add('show');
        }
    });
}

/**
 * Show a notification message to the user
 * @param {string} message - Message to display
 * @param {string} type - Notification type ('success', 'error', 'info')
 */
function showNotification(message, type = 'info') {
    if (type === 'error') {
        console.error(message);
    }
}

/**
 * Listen for storage changes to update UI reactively
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'session') {
        // If oauth_status or userInfo changes, update the UI
        if (changes.oauth_status || changes.userInfo) {
            updateUIState();
        }
    }
});

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', initializePopup);