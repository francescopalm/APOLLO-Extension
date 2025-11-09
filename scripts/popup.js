import { getAuthToken } from './oauth.js';
import { logout } from './oauth.js';
import { startClassification } from './batch.js';

/**
 * Main function to initialize the popup UI and event listeners.
 * This ensures the DOM is fully loaded before selecting elements.
 */
async function initializePopup() {

    // --- 1. Get references to all UI elements ---
    const loginButton = document.getElementById('login');
    const signoutButton = document.getElementById('signout');
    const optionsButton = document.getElementById('options');
    const classificationButton = document.getElementById('classification');
    const buttonText = classificationButton ? classificationButton.querySelector('.button-text') : null;
    const spinner = classificationButton ? classificationButton.querySelector('.spinner') : null;
    const accountLabel = document.getElementById('account');
    const detailsLabel = document.getElementById('details');

    // --- 2. Attach Event Listeners ---

    if (loginButton) {
        loginButton.addEventListener('click', () => {
            // Call the auth function
            getAuthToken().then(() => {
                window.close(); // Close popup after auth flow
            }); 
        });
    }

    if (signoutButton) {
        signoutButton.addEventListener('click', async () => {
            // Add confirmation dialog before logging out
            const confirmLogout = confirm(
                "Are you sure you want to sign out? You will need to log in again to use the extension."
            );

            if (confirmLogout) {
                await logout();
                alert("You have been logged out.");
                window.close();
            }
            // If user cancels, do nothing.
        });
    }

    if (optionsButton) {
        optionsButton.addEventListener('click', () => {
            if (chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                window.open(chrome.runtime.getURL('./options/options.html'));
            }
            window.close();
        });
    }

    if (classificationButton) {
        classificationButton.addEventListener('click', () => {
            console.log("Batch classification process initiated.");
            // Disable button to prevent multiple clicks
            classificationButton.disabled = true;
            buttonText.textContent = "Classifying...";
            spinner.style.display = "inline-block";
            
            startClassification().finally(() => {
                // Re-enable button when done
                classificationButton.disabled = false;
                buttonText.textContent = "Start batch classification";
                spinner.style.display = "none";
            });
        });
    }


    // --- 3. Update UI based on stored session state ---

    // Fetch both status and user info in one call
    const { oauth_status, userInfo } = await chrome.storage.session.get(['oauth_status', 'userInfo']);

    // Set the user email label (if available)
    accountLabel.textContent = userInfo || "Not logged in";

    // Update UI colors and text based on the auth status
    switch (oauth_status) {
        case "VALID TOKEN":
            accountLabel.style.background = "#ecfcca";
            accountLabel.style.borderColor = "#ecfcca";
            accountLabel.style.color = "#35530e";
            detailsLabel.textContent = "Apollo is running.";
            if (loginButton) loginButton.style.display = "none";
            break;

        case "MAIL ACCOUNT MISMATCH":
            accountLabel.style.background = "#fef3c6";
            accountLabel.style.borderColor = "#fef3c6";
            accountLabel.style.color = "#7b3306";
            detailsLabel.textContent = "Mail account mismatch. Please log in with the correct Gmail account to use Apollo.";
            if (classificationButton) classificationButton.style.display = "none";
            break;

        case "TOKEN EXPIRED":
        case "NO TOKEN":
        default:
            accountLabel.style.background = "#ffc9c9";
            accountLabel.style.borderColor = "#ffc9c9";
            accountLabel.style.color = "#82181a";
            detailsLabel.textContent = "You must log in with your Google account to use Apollo.";
            if (signoutButton) signoutButton.style.display = "none";
            if (classificationButton) classificationButton.style.display = "none";
            break;
    }
}

// Wait for the DOM to be fully loaded before running the initialization
document.addEventListener('DOMContentLoaded', initializePopup);