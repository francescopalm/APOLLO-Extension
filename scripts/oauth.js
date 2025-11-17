/**
 * Checks the validity of the current auth token and its alignment with the active Gmail account.
 *
 * @returns {Promise<string>} A status string: "VALID TOKEN", "NO TOKEN", "TOKEN_EXPIRED", "MAIL ACCOUNT MISMATCH".
 */
export async function checkOAuth() {
    const { google_auth_token } = await chrome.storage.session.get('google_auth_token');

    if (!google_auth_token) {
        return "NO TOKEN";
    }

    // 2. We have a token; validate it.
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${google_auth_token}` }
        });

        if (response.ok) {
            // 3. Token is valid.
            // Check if it matches the active Gmail account and if the OPENAI API KEY is set.
            const userInfo = await response.json();
            const { gmailAccount } = await chrome.storage.session.get('gmailAccount');
            const { openaiApiKey } = await chrome.storage.sync.get('openaiApiKey');
            
            // Store the user info email for reference (e.g., for tab switching logic)
            chrome.storage.session.set({ userInfo: userInfo.email });

            if (gmailAccount === userInfo.email) {
                if(openaiApiKey) {
                    return "VALID TOKEN";
                } else {
                    return "API KEY MISSING";
                }
            } else {
                console.warn("Token account does not match active Gmail account.");
                return "MAIL ACCOUNT MISMATCH";
            }
        } else {
            // 4. Token is not valid (expired, revoked).
            // We return "TOKEN_EXPIRED" and let the UI (popup) handle the re-login prompt.
            console.warn("Token validation failed (expired or revoked). Status:", response.status);
            return "TOKEN EXPIRED";
        }
    } catch (error) {
        console.error("Network error during token validation:", error);
        // If validation fails due to network, we can't be sure of the state.
        return "TOKEN EXPIRED"; 
    }
}

/**
 * Initiates the authentication flow.
 * @param {string} userInfo - The email address to use as a login_hint (optional).
 * @param {boolean} refreshToken - If true, runs non-interactively (currently not used by checkOAuth).
 */
export function getAuthToken(userInfo, refreshToken = false) {
    return new Promise((resolve, reject) => {
    // Use manifest values for configuration
        const CLIENT_ID = chrome.runtime.getManifest().oauth2.client_id;
        const SCOPES = chrome.runtime.getManifest().oauth2.scopes.join(" ");
        const REDIRECT_URL = chrome.identity.getRedirectURL();

        // Use Template Literal for cleaner URL construction
        let authUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
                    `?client_id=${CLIENT_ID}` +
                    `&response_type=token` +
                    `&redirect_uri=${encodeURIComponent(REDIRECT_URL)}` +
                    `&scope=${encodeURIComponent(SCOPES)}`;

        if (!refreshToken) {
            authUrl += `&prompt=select_account`;
        }
        if (userInfo) {
            authUrl += `&login_hint=${encodeURIComponent(userInfo)}`;
        }

        chrome.identity.launchWebAuthFlow(
            {
                url: authUrl,
                interactive: !refreshToken 
            },
            (redirectUrlString) => {
                // Handle errors (e.g., user closes the auth window)
                if (chrome.runtime.lastError || !redirectUrlString) {
                    console.error("OAuth flow failed:", chrome.runtime.lastError ? chrome.runtime.lastError.message : "User canceled or invalid redirect.");
                    // We cannot send a token, so we do nothing.
                    reject(chrome.runtime.lastError);
                    return;
                }

                try {
                    const url = new URL(redirectUrlString);
                    const params = new URLSearchParams(url.hash.substring(1)); // Remove the '#'
                    const accessToken = params.get("access_token");

                    if (accessToken) {
                        // Send the token to the background script to update the session
                        chrome.runtime.sendMessage({ type: "TOKEN_READY", accessToken });
                        resolve(true);
                    } else {
                        console.error("Failed to extract access_token from redirect URL.");
                    }
                } catch (error) {
                    console.error("Error parsing redirect URL:", error);
                }
            }
        );

    })
    
}

/**
 * Revokes the current token on Google's servers and clears local storage.
 */
export async function logout() {
    console.log("Starting Logout procedure...");

    // 1. Retrieve the token
    const { google_auth_token, oauth_status } = await chrome.storage.session.get(['google_auth_token', 'oauth_status']);

    if (google_auth_token) {
        // --- Step 1: Revoke Token on Google's Server ---
        try {
            const revokeUrl = 'https://oauth2.googleapis.com/revoke?token=' + google_auth_token;
            await fetch(revokeUrl, {
                method: 'POST',
                headers: { 'Content-type': 'application/x-www-form-urlencoded' }
            });
            console.log("Token successfully revoked from Google server.");
        } catch (error) {
            console.warn("WARNING: Failed to remotely revoke token. Proceeding with local cleanup.", error);
        }

        // --- Step 2: Local Cleanup (Storage) ---
        try {
            await chrome.storage.session.remove(['google_auth_token', 'userInfo']);
        } catch (e) {
            console.error("Error during local storage removal:", e);
        }
    } else {
        console.log("No token found in storage. Performing local cleanup only.");
    }

    // 3. Ensure auth status is reset
    if (oauth_status !== "NO TOKEN") {
          await chrome.storage.session.set({ oauth_status: "NO TOKEN" });
    }
    
    console.log("Logout completed.");
}