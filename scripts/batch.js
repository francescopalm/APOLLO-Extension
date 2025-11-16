// --- Constants ---
const FLASK_SERVER_URL = "http://127.0.0.1:5000/analyze";
const GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/";

/**
 * Main function to perform batch classification.
 */
export async function startClassification(silentMode) {
    try {
        // Get user preferences (using default values as fallback)
        const { time_window = 1, max_results = 10 } = await chrome.storage.sync.get(['time_window', 'max_results']);
        const query = `q=newer_than:${time_window}d&maxResults=${max_results}`;

        // Get the authentication token from the session
        const { google_auth_token } = await chrome.storage.session.get('google_auth_token');
        if (!google_auth_token) {
            throw new Error("Authentication token not found. Please log in.");
        }

        // Fetch the list of messages from Gmail API
        const listUrl = `${GMAIL_API_BASE_URL}?${query}`;
        const response = await fetch(listUrl, {
            headers: { Authorization: "Bearer " + google_auth_token }
        });

        // Error handling
        if (!response.ok) {
            throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.messages || data.messages.length === 0) {
            console.log("No recent messages found matching the criteria.");
            alert("Batch classification complete: No new messages found.");
            return;
        }

        console.log(`Found ${data.messages.length} recent messages. Checking cache...`);

        // Process all messages in parallel.
        // If silentMode=true, call analyzeMessage function because the background script cannot message itself.
        const classificationTasks = data.messages.map(msg => {
            if(silentMode) {
                analyzeMessage(msg.id, google_auth_token)
            } else{
                processMessage(msg.id)
            }
        });
         
        // Wait for all classifications to complete
        const results = await Promise.allSettled(classificationTasks);

        let classifiedCount = 0;
        results.forEach(res => {
            if (res.status === 'fulfilled' && res.value === 'classified') {
                classifiedCount++;
            }
        });

        console.log("Batch classification complete.");
        !silentMode && alert(`Batch classification finished. ${classifiedCount} new emails were analyzed and cached.`); // Short-circuiting

    } catch (error) {
        console.error("Error during batch classification:", error.message);
        !silentMode && alert(`An error occurred: ${error.message}`);
    }
}

/**
 * Processes a single message ID.
 * Checks cache first, then sends to background script if not found.
 * @param {string} messageId The ID of the Gmail message.
 * @returns {Promise<string>} A status ('cached' or 'classified').
 */
async function processMessage(messageId) {
    const cacheEntry = await chrome.storage.local.get(messageId);
    
    if (cacheEntry[messageId]) {
        // This message is already in our local cache
        return 'cached';
    } else {
        // Not in cache, send to background for analysis
        // We wrap sendMessage in a Promise for await compatibility
        await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: "sendMessageID", data: messageId }, (response) => {
                console.log(response);
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                if (response.error) {
                    return reject(new Error(response.error));
                }
                resolve(response.result);
            });
        });
        return 'classified';
    }
}

/**
 * Executes the entire single-message analysis workflow.
 * It is necessary for the extension to classify emails silently when it starts.
 * The same logic is located into background.js
 */
async function analyzeMessage(messageId, googleAuthToken) {
    try {
        if (!googleAuthToken) {
            throw new Error("Authentication token is missing. Please log in.");
        }

        // 2. Fetch 1: Gmail API
        const gmailApiUrl = `${GMAIL_API_BASE_URL}${messageId}?format=raw`;
        const gmailResponse = await fetch(gmailApiUrl, {
            headers: { Authorization: "Bearer " + googleAuthToken }
        });

        // Error handling for the fetch response
        if (!gmailResponse.ok) {
            throw new Error(`Gmail API Error: ${gmailResponse.status} ${gmailResponse.statusText}`);
        }
        const data = await gmailResponse.json();

        // 3. Fetch 2: Flask Analysis API
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

        await chrome.storage.local.set({ [messageId]: responseData });

        return responseData; // Return the result instead of sending a response
        
    } catch (error) {
        console.error(`Error analyzing message ${messageId}:`, error);
        throw error; // Propagate the error up
    }
}