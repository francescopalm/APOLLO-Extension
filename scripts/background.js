import { checkOAuth } from "./oauth.js";
import { startClassification } from "./batch.js";

// --- Constants ---
// Define application constants
const FLASK_SERVER_URL = "http://127.0.0.1:5000/analyze";
const GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/";

// A single listener for all runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.action === "checkServiceWorker") {
        console.log("Service Worker: INIT routine started for Gmail account:", message.data);
        
        // Save the active Gmail account
        chrome.storage.session.set({ gmailAccount: message.data });
        
        // Asynchronously check auth status and respond
        (async () => {
            const oauthStatus = await checkOAuth();
            chrome.storage.session.set({ oauth_status: oauthStatus });
            if (oauthStatus === "VALID TOKEN"){
                const silentMode = true;
                await startClassification(silentMode);
            }
            sendResponse({ status: oauthStatus });
        })();
        return true; // Indicates an asynchronous response
    }

    if (message.type === "TOKEN_READY") {
        // Save the new token to session storage
        chrome.storage.session.set({ google_auth_token: message.accessToken });
        
        (async () => {
            const oauthStatus = await checkOAuth();
            chrome.storage.session.set({ oauth_status: oauthStatus });
            if (oauthStatus === "VALID TOKEN"){
                const silentMode = true;
                await startClassification(silentMode);
            }
            sendResponse({ status: oauthStatus });
        })();
        return true; // Indicates an asynchronous response
    }

    if (message.type === "TOKEN_REMOVE") {
        (async () => {
            await chrome.storage.session.remove(["userInfo", "google_auth_token"]);
            sendResponse({ success: true });
        })();
        return true; // Indicates an asynchronous response
    }

    if (message.action === "getOAuthStatus") {
        (async () => {
            const result = await chrome.storage.session.get('oauth_status');
            sendResponse({ oauthStatus: result.oauth_status });
        })();
        return true; // Indicates an asynchronous response
    }

    if (message.action === "sendMessageID") {
        (async () => {
            try {
                // 1. Get the auth token STATelessly from storage
                const { google_auth_token } = await chrome.storage.session.get('google_auth_token');
                
                if (!google_auth_token) {
                    throw new Error("Authentication token is missing. Please log in.");
                }

                // --- 2. Fetch 1: Gmail API ---
                const gmailApiUrl = `${GMAIL_API_BASE_URL}${message.data}?format=raw`;
                const gmailResponse = await fetch(gmailApiUrl, {
                    headers: { Authorization: "Bearer " + google_auth_token }
                });


                // Error handling for the fetch response
                if (!gmailResponse.ok) {
                    throw new Error(`Gmail API Error: ${gmailResponse.status} ${gmailResponse.statusText}`);
                }
                const data = await gmailResponse.json();

                // --- 3. Fetch 2: Flask Analysis API ---
                const analysisResponse = await fetch(FLASK_SERVER_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data.raw)
                });

                if (!analysisResponse.ok) {
                    throw new Error(`Flask Server Error: ${analysisResponse.status} ${analysisResponse.statusText}`);
                }
                const result = await analysisResponse.json();

                // 4. Save result to local storage
                const responseData = {
                    classification_result: result.label,
                    feature_explain: result.explanation[0],
                    phishing_probability: result.phishing_probability,
                    created_at: Date.now()
                };

                await chrome.storage.local.set({ [message.data]: responseData });
                
                // 5. Send response back to Content Script
                sendResponse({ result: responseData });

            } catch (error) {
                console.error("Error during email analysis:", error);
                sendResponse({ error: error.message });
            }
        })();
        return true; // Indicates an asynchronous response
    }

    // If no action matches, return false or nothing
    return false;
});

// Listener for tab activation (e.g., switching tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);

        // 1. Check if the activated tab is Gmail
        if (tab.url && tab.url.startsWith('https://mail.google.com/')) {
            
            // 2. Send message to the content script to get the active account
            const response = await chrome.tabs.sendMessage(tab.id, { action: "getGmailAccount" });

            if (response && response.gmailAccount) {
                // 3. Update session storage with the current Gmail account
                await chrome.storage.session.set({ gmailAccount: response.gmailAccount });
                
                const { userInfo } = await chrome.storage.session.get('userInfo');
                
                // 4. Update the auth status based on account match
                if (userInfo && response.gmailAccount === userInfo) {
                    await chrome.storage.session.set({ oauth_status: "VALID TOKEN" });
                } else if (userInfo) {
                    // Logged in, but mismatch
                    await chrome.storage.session.set({ oauth_status: "MAIL ACCOUNT MISMATCH" });
                }
                // If userInfo is undefined, checkOAuth() will handle it on next load
            }

        }
    } catch (error) {
        // This error often happens if the content script isn't ready (e.g., tab reloading)
        // It is generally safe to ignore, but we log it for debugging.
        console.warn("Could not communicate with content script on tab activation:", error.message);
    }
});