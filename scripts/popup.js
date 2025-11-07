import { getAuthToken } from './oauth.js';
import { logout } from './oauth.js';

document.querySelector('#login').addEventListener('click', getAuthToken);
document.querySelector('#signout').addEventListener('click', logout);

document.querySelector('#options').addEventListener('click', function() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('./options/options.html'));
  }
});



chrome.storage.session.get('userInfo', function (result) {
    const accountLabel = document.querySelector('#account');
    accountLabel.textContent = result.userInfo || "Not logged in";
})

chrome.storage.session.get('oauth_status', function (result) {
    const accountLabel = document.querySelector('#account');
    const tooltip = document.querySelector('#details');
    switch(result.oauth_status){
        case "VALID TOKEN":
            accountLabel.style.background = "#ecfcca";
            accountLabel.style.borderColor = "#ecfcca";
            accountLabel.style.color = "#35530e";
            tooltip.style.textAlign = "center";
            tooltip.style.color = "#35530e";
            tooltip.textContent = "Apollo is running.";
            document.querySelector('#login').style.display = "none";
            break;

        case "MAIL ACCOUNT MISMATCH":
            accountLabel.style.background = "#fef3c6";
            accountLabel.style.borderColor = "#fef3c6";
            accountLabel.style.color = "#7b3306";
            tooltip.style.textAlign = "center";
            tooltip.style.color = "#7b3306";
            tooltip.textContent = "Mail account mismatch. You have to login with Gmail corresponding account in order to use Apollo.";
            document.querySelector('#classification').style.display = "none";
            break;

        default:
            accountLabel.style.background = "#ffc9c9";
            accountLabel.style.borderColor = "#ffc9c9";
            accountLabel.style.color = "#82181a";
            tooltip.style.textAlign = "center";
            tooltip.style.color = "#82181a";
            tooltip.textContent = "You have to login with your Google account in order to use Apollo.";
            document.querySelector('#signout').style.display = "none";
            document.querySelector('#classification').style.display = "none";
            break;

    }

})

