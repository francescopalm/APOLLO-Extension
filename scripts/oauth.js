  export async function checkOAuth() {
  const { google_auth_token } = await chrome.storage.session.get('google_auth_token');

  if (!google_auth_token) {
    // 1. Non ho nessun token. Attendo che l'utente effettui il login intenzionalmente.
    console.log("Nessun token presente");
    return "NO TOKEN";
  }

  // 2. Ho un token, devo validarlo.
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': `Bearer ${google_auth_token}` }
    });

    if (response.ok) {
      // 3. Il token esiste. Controllo la validità.
      // Controllo che l'account con cui si è autorizzata l'estensione
      // corrisponda all'account di Gmail attivo
      const userInfo = await response.json();
      const {gmailAccount} = await chrome.storage.session.get('gmailAccount');
      chrome.storage.session.set({ userInfo: userInfo.email });
      console.log(gmailAccount +" - "+ userInfo.email);

      if (gmailAccount === userInfo.email) {
        //document.querySelector('#account').textContent = userInfo.email;
        return "VALID TOKEN";
        // Non fare nient'altro! Il token è valido.
      }
      else {
        console.log("L'account utilizzato per l'estensione non coincide con quello utilizzato in Gmail. Riprova");
        //getAuthToken(userMail.gmailAccount);
        return "MAIL ACCOUNT MISMATCH";
      }
    } else {
      // 4. Il token NON è valido (scaduto, revocato).
      console.log("Token non valido (", response.status, "), richiedo un nuovo token.");
      // Refresh token
      if(getAuthToken(null, true)){
        return "VALID TOKEN"
      } else {
        return "TOKEN EXPIRED";
      }
      
    }
  } catch (error) {
    console.error("Errore di rete validazione token:", error);
  }
}

export function getAuthToken(userInfo, refreshToken = false) {
  const CLIENT_ID = chrome.runtime.getManifest().oauth2.client_id;
  const SCOPES = chrome.runtime.getManifest().oauth2.scopes.join(" ");
  const REDIRECT_URL = chrome.identity.getRedirectURL();
  let authUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  authUrl += `?client_id=${CLIENT_ID}`;
  authUrl += `&response_type=token`;
  authUrl += `&redirect_uri=${encodeURIComponent(REDIRECT_URL)}`;
  authUrl += `&scope=${encodeURIComponent(SCOPES)}`;
  if(!refreshToken){
    authUrl += `&prompt=select_account`;
  }
  if(userInfo){
    authUrl += `&login_hint=${encodeURIComponent(userInfo)}`;
  }

  chrome.identity.launchWebAuthFlow(
    {
      url: authUrl,
      interactive: !refreshToken // 'true' se l'utente non è affatto loggato. 'false' in caso di refresh token
    },
    (redirect_url_string) => {
      
      const url = new URL(redirect_url_string);
      const params = new URLSearchParams(url.hash.substring(1));
      const accessToken = params.get("access_token");

      if (accessToken) {
        console.log("Token ottenuto");
        chrome.runtime.sendMessage({ type: "TOKEN_READY", accessToken });
        return true;
      }
    }
  );


  

/*
  chrome.identity.getAuthToken({ interactive: true }, function (token) {
    console.log("Token: " + token);
    chrome.runtime.sendMessage({ type: "TOKEN_READY", token });

    // Chiamata alle API userinfo
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(res => res.json())
      .then(profile => {
        // Controllo che l'account con cui si è autorizzata l'estensione
        // corrisponda all'account di Gmail attivo
        chrome.storage.session.get('gmailAccount', function (result) {
          if (result.gmailAccount === profile.email) {
            console.log(profile);
            document.querySelector('#account').textContent = profile.email;
            chrome.storage.session.set({ userInfo: profile.email });
            //document.getElementById('email').textContent = "Email: " + profile.email;
          }
          else {
            console.log("L'account utilizzato per l'estensione non coincide con quello utilizzato in Gmail. Riprova");
            signout();
            console.log("INIZIO ROUTINE CAMBIO ACCOUNT");
            chrome.runtime.sendMessage({ action: "changeAccount", data: result.gmailAccount });
          }
        });

      })
    //.catch(err => console.error('Errore userinfo:', err));
  });
  //});

  // LOGOUT
  document.querySelector('#signout').addEventListener('click', signout);

}


function signout() {
  chrome.identity.getAuthToken({ interactive: false }, function (token) {
    if (chrome.runtime.lastError) {
      console.warn("Nessun token trovato o già disconnesso");
      return;
    }
    chrome.identity.removeCachedAuthToken({ token }, function () {
      chrome.runtime.sendMessage({ type: "TOKEN_REMOVE", token });
      document.querySelector('#account').textContent = "Not logged";
      console.log("Token rimosso dalla cache estensione");
    });
  });
}
  */
}

export async function logout() {
    
    console.log("Starting Logout procedure...");

    // 1. Retrieve the token and oauth status from storage
    const { google_auth_token, oauth_status, userInfo } = await chrome.storage.session.get(['google_auth_token', 'oauth_status', 'userInfo']);

    if (google_auth_token) {
        
        // --- Step 1: Revoke Token on Google's Server (Crucial Security Step) ---
        try {
            const revokeUrl = 'https://oauth2.googleapis.com/revoke?token=' + google_auth_token;
            await fetch(revokeUrl, {
                method: 'POST',
                headers: {
                    'Content-type': 'application/x-www-form-urlencoded'
                }
            });
            console.log("Token successfully revoked from Google server.");
        } catch (error) {
            // Log a warning but proceed with local cleanup
            console.warn("WARNING: Failed to remotely revoke token. Proceeding with local cleanup.", error);
        }

        // --- Step 2: Local Cleanup (Storage) ---
        try {
            // Remove the token and the authentication status key
            await chrome.storage.session.remove(['google_auth_token', 'userInfo']);
            console.log("Authentication data removed from chrome.storage.local.");
        } catch (e) {
            console.error("Error during local storage removal:", e);
        }
    } else {
        console.log("No token found in storage. Performing local cleanup only.");
    }

    // Ensure oauth_status is also set to "NO TOKEN"
    if (oauth_status) {
          await chrome.storage.session.set({ oauth_status: "NO TOKEN" });
    }
    
    
    console.log("Logout completed.");
}