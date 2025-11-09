/**
 * Main function to perform batch classification.
 */
export async function startClassification(silentMode) {
    try {
        // 1. Get user preferences (using default values as fallback)
        const { time_window = 1, max_results = 10 } = await chrome.storage.sync.get(['time_window', 'max_results']);
        const query = `q=newer_than:${time_window}d&maxResults=${max_results}`;

        // 2. Get the authentication token from the session
        const { google_auth_token } = await chrome.storage.session.get('google_auth_token');
        if (!google_auth_token) {
            throw new Error("Authentication token not found. Please log in.");
        }

        // 3. Fetch the list of messages from Gmail API
        const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${query}`;
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

        // 4. Process all messages in parallel
        const classificationTasks = data.messages.map(msg => 
            processMessage(msg.id)
        );
        
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