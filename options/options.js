/**
 * APOLLO Options Page
 * Handles API configuration, classification settings, and cache management
 */

// Configuration constants
const STATUS_DISPLAY_DURATION = 5000;
const BACKEND_URL = 'http://127.0.0.1:5000';

// Default values
const DEFAULTS = {
    timeWindow: '1',
    maxResults: '10'
};

/**
 * DOM element references
 */
const elements = {
    // API Keys
    openaiKey: null,
    virusTotalKey: null,
    bigDataKey: null,
    sendButton: null,
    apiStatus: null,
    
    // Settings
    timeWindow: null,
    maxResults: null,
    saveButton: null,
    settingsStatus: null,
    
    // Cache
    clearCacheButton: null,
    cacheStatus: null
};

/**
 * Initialize the options page
 */
async function initializeOptions() {
    // Get DOM element references
    getElementReferences();
    
    // Attach event listeners
    attachEventListeners();
    
    // Restore saved settings
    await restoreOptions();
}

/**
 * Get references to all DOM elements
 */
function getElementReferences() {
    // API Keys section
    elements.openaiKey = document.getElementById('openai-apikey');
    elements.virusTotalKey = document.getElementById('vt-apikey');
    elements.bigDataKey = document.getElementById('bd-apikey');
    elements.sendButton = document.getElementById('send');
    elements.apiStatus = document.getElementById('api-status');
    
    // Settings section
    elements.timeWindow = document.getElementById('time-window');
    elements.maxResults = document.getElementById('max-results');
    elements.saveButton = document.getElementById('save');
    elements.settingsStatus = document.getElementById('settings-status');
    
    // Cache section
    elements.clearCacheButton = document.getElementById('clear-cache');
    elements.cacheStatus = document.getElementById('cache-status');
}

/**
 * Attach event listeners to interactive elements
 */
function attachEventListeners() {
    if (elements.sendButton) {
        elements.sendButton.addEventListener('click', handleSaveApiKeys);
    }
    
    if (elements.saveButton) {
        elements.saveButton.addEventListener('click', handleSaveSettings);
    }
    
    if (elements.clearCacheButton) {
        elements.clearCacheButton.addEventListener('click', handleClearCache);
    }
}

/**
 * Handle saving API keys
 */
async function handleSaveApiKeys() {
    const openaiKey = elements.openaiKey.value.trim();
    const virusTotalKey = elements.virusTotalKey.value.trim();
    const bigDataKey = elements.bigDataKey.value.trim();

    // Validation - only OpenAI is required
    if (!openaiKey) {
        showStatus(elements.apiStatus, 'OpenAI API key is required.', 'error');
        return;
    }

    try {
        // Set loading state
        setButtonLoading(elements.sendButton, true);

        // Save to Chrome storage
        await chrome.storage.sync.set({
            openaiApiKey: openaiKey,
            virusTotalApiKey: virusTotalKey,
            bigDataApiKey: bigDataKey
        });

        // Send to backend
        const apiKeys = {
            "OPENAI_API_KEY": openaiKey,
            "VT_API": virusTotalKey,
            "DNS_API": bigDataKey
        };

        const response = await fetch(`${BACKEND_URL}/setapikey`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(apiKeys)
        });

        if (!response.ok) {
            throw new Error(`Backend responded with status ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            showStatus(elements.apiStatus, 'API keys saved and validated successfully!', 'success');
        } else {
            showStatus(elements.apiStatus, 'API keys saved but validation failed.', 'error');
        }

    } catch (error) {
        console.error('Error saving API keys:', error);
        showStatus(
            elements.apiStatus,
            `Failed to save API keys: ${error.message}`,
            'error'
        );
    } finally {
        setButtonLoading(elements.sendButton, false);
    }
}

/**
 * Handle saving classification settings
 */
async function handleSaveSettings() {
    const timeWindow = elements.timeWindow.value;
    const maxResults = elements.maxResults.value;

    try {
        await chrome.storage.sync.set({
            timeWindow: timeWindow,
            maxResults: maxResults
        });

        showStatus(elements.settingsStatus, 'Classification settings saved successfully!', 'success');

    } catch (error) {
        console.error('Error saving settings:', error);
        showStatus(
            elements.settingsStatus,
            `Failed to save settings: ${error.message}`,
            'error'
        );
    }
}

/**
 * Handle clearing cache
 */
async function handleClearCache() {
    const confirmed = confirm(
        'Are you sure you want to clear all cached email classifications? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
        await chrome.storage.local.clear();
        showStatus(elements.cacheStatus, 'Cache cleared successfully!', 'success');

    } catch (error) {
        console.error('Error clearing cache:', error);
        showStatus(
            elements.cacheStatus,
            `Failed to clear cache: ${error.message}`,
            'error'
        );
    }
}

/**
 * Restore saved options from storage
 */
async function restoreOptions() {
    try {
        const items = await chrome.storage.sync.get([
            'openaiApiKey',
            'virusTotalApiKey',
            'bigDataApiKey',
            'timeWindow',
            'maxResults'
        ]);

        // Restore API keys
        if (elements.openaiKey) {
            elements.openaiKey.value = items.openaiApiKey || '';
        }
        if (elements.virusTotalKey) {
            elements.virusTotalKey.value = items.virusTotalApiKey || '';
        }
        if (elements.bigDataKey) {
            elements.bigDataKey.value = items.bigDataApiKey || '';
        }

        // Restore settings
        if (elements.timeWindow) {
            elements.timeWindow.value = items.timeWindow || DEFAULTS.timeWindow;
        }
        if (elements.maxResults) {
            elements.maxResults.value = items.maxResults || DEFAULTS.maxResults;
        }

    } catch (error) {
        console.error('Error restoring options:', error);
    }
}

/**
 * Show status message
 * @param {HTMLElement} element - Status element to update
 * @param {string} message - Message to display
 * @param {string} type - Type of message ('success', 'error', 'info')
 */
function showStatus(element, message, type = 'info') {
    if (!element) return;

    element.textContent = message;
    element.className = `status-message show ${type}`;

    setTimeout(() => {
        element.classList.remove('show');
    }, STATUS_DISPLAY_DURATION);
}

/**
 * Set button loading state
 * @param {HTMLElement} button - Button element
 * @param {boolean} isLoading - Whether button is loading
 */
function setButtonLoading(button, isLoading) {
    if (!button) return;

    button.disabled = isLoading;
    
    if (isLoading) {
        button.classList.add('loading');
    } else {
        button.classList.remove('loading');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeOptions);