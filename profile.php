document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('chessUsername');
    if (!username) {
        // Handle case where user is not logged in, maybe redirect or show login message
        console.error("Username not found. Cannot load profile.");
        // Potentially redirect: window.location.href = 'login.php';
        return;
    }

    const profileTitle = document.getElementById('profile-title');
    if (profileTitle) profileTitle.textContent = `${username}'s Profile`;
    else console.error("Element with ID 'profile-title' not found.");

    // --- Start Commenting Out ---
    // loadProfileStats(username); 
    // initializeEloGraph(username);
    // loadCompletedGames(username); 
    // loadChallenges(username); 
    // initializeTabs(); // <-- START BY COMMENTING THIS ONE OUT
    // --- End Commenting Out ---

    // Event Delegation (Keep this part active for now)
    const pendingList = document.getElementById('pending-challenges');
    const outgoingList = document.getElementById('outgoing-challenges');

    if (pendingList) {
        pendingList.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('accept-challenge')) {
                handleChallengeAction(target.dataset.id, 'accept');
            } else if (target.classList.contains('decline-challenge')) {
                handleChallengeAction(target.dataset.id, 'decline');
            }
        });
    } else {
        console.error("Could not find 'pending-challenges' list to attach listener.");
    }

    if (outgoingList) {
        outgoingList.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('cancel-challenge')) {
                handleChallengeAction(target.dataset.id, 'cancel');
            }
        });
    } else {
         console.error("Could not find 'outgoing-challenges' list to attach listener.");
    }
});

// Make sure the loadChallenges function itself exists
async function loadChallenges(username) {
    console.log("Attempting to load challenges for profile page using challenge_api.php:", username); 
    const pendingList = document.getElementById('pending-challenges');
    const outgoingList = document.getElementById('outgoing-challenges');

    if (!pendingList || !outgoingList) {
        console.error("Could not find 'pending-challenges' or 'outgoing-challenges' list elements on the page.");
        if (pendingList) pendingList.innerHTML = '<li>Error: UI element missing.</li>';
        if (outgoingList) outgoingList.innerHTML = '<li>Error: UI element missing.</li>';
        return;
    }

    pendingList.innerHTML = '<li>Loading pending...</li>';
    outgoingList.innerHTML = '<li>Loading outgoing...</li>';

    try {
        // Fetch Pending Challenges
        const pendingResponse = await fetch(`api/challenge_api.php?action=pending&username=${encodeURIComponent(username)}`);
        if (!pendingResponse.ok) {
            throw new Error(`HTTP error! status: ${pendingResponse.status}`);
        }
        const pendingData = await pendingResponse.json();
        console.log("Received pending challenges data (profile):", pendingData);

        pendingList.innerHTML = ''; // Clear loading message
        if (pendingData.success && pendingData.challenges && pendingData.challenges.length > 0) {
            pendingData.challenges.forEach(challenge => {
                const li = document.createElement('li');
                // Use field names from challenge_api.php response
                li.innerHTML = `
                    <span>From: ${challenge.challenger} (ELO: ${challenge.elo || 'N/A'})</span> 
                    <small>Expires in: ${challenge.expires_in_minutes} min</small>
                    <div class="challenge-actions">
                       <button class="accept-challenge" data-id="${challenge.id}">Accept</button>
                       <button class="decline-challenge" data-id="${challenge.id}">Decline</button>
                    </div>
                `;
                pendingList.appendChild(li);
            });
        } else if (!pendingData.success) {
             pendingList.innerHTML = `<li>Error loading pending: ${pendingData.message || 'Unknown error'}</li>`;
        } else {
            pendingList.innerHTML = '<li>No pending challenges.</li>';
        }

        // Fetch Outgoing Challenges
        const outgoingResponse = await fetch(`api/challenge_api.php?action=outgoing&username=${encodeURIComponent(username)}`);
        if (!outgoingResponse.ok) {
            throw new Error(`HTTP error! status: ${outgoingResponse.status}`);
        }
        const outgoingData = await outgoingResponse.json();
         console.log("Received outgoing challenges data (profile):", outgoingData);

        outgoingList.innerHTML = ''; // Clear loading message
        if (outgoingData.success && outgoingData.challenges && outgoingData.challenges.length > 0) {
            outgoingData.challenges.forEach(challenge => {
                const li = document.createElement('li');
                 // Use field names from challenge_api.php response
               li.innerHTML = `
                    <span>To: ${challenge.player_being_challenged} (ELO: ${challenge.elo || 'N/A'})</span>
                    <small>Expires in: ${challenge.expires_in_minutes} min</small>
                    <div class="challenge-actions">
                       <button class="cancel-challenge" data-id="${challenge.id}">Cancel</button>
                    </div>
                `;
                outgoingList.appendChild(li);
            });
        } else if (!outgoingData.success) {
             outgoingList.innerHTML = `<li>Error loading outgoing: ${outgoingData.message || 'Unknown error'}</li>`;
        } else {
            outgoingList.innerHTML = '<li>No outgoing challenges.</li>';
        }

        // Note: Event listeners are now handled by delegation, so no call to addChallengeButtonListeners needed here.

    } catch (error) {
        console.error('Error fetching or processing challenges (profile):', error);
        // Display error in both lists as we don't know which fetch failed
        if (pendingList.innerHTML.includes('Loading')) {
             pendingList.innerHTML = '<li>Error loading challenges (network/script error).</li>';
        }
         if (outgoingList.innerHTML.includes('Loading')) {
             outgoingList.innerHTML = '<li>Error loading challenges (network/script error).</li>';
        }
    }
}

// Ensure the handler function exists and uses the correct API
async function handleChallengeAction(challengeId, action) {
    const username = localStorage.getItem('chessUsername');
    if (!username) {
        alert("Error: Cannot perform action. Not logged in.");
        return;
    }
    if (!challengeId) {
        console.error("Challenge ID missing for action:", action);
        alert("Error: Could not perform action, challenge ID missing.");
        return;
    }

    console.log(`Handling action '${action}' for challenge ID ${challengeId} via challenge_api.php`); 

    // Construct payload based on challenge_api.php expectations
    const payload = {
        challenge_id: parseInt(challengeId, 10) 
        // Add username if required by specific actions in your API logic
        // username: username 
    };
    
    // Use GET parameters for username if needed (e.g., for decline/cancel authorization)
    let apiUrl = `api/challenge_api.php?action=${action}`;
    if (action === 'decline' || action === 'cancel') {
         apiUrl += `&username=${encodeURIComponent(username)}`;
    }


    try {
        const response = await fetch(apiUrl, { 
            method: 'POST', // Actions are POST in challenge_api.php
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) 
        });

        if (!response.ok) {
            // Try to get more details from the response body for non-OK status
            let errorMsg = `HTTP error! Status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || errorMsg;
            } catch (e) { /* Ignore if response is not JSON */ }
             throw new Error(errorMsg);
        }

        const result = await response.json();
        console.log("Response from challenge action:", result); // Log the result

        if (result.success) {
            console.log(`Challenge action '${action}' successful (profile).`); 
            // Reload challenges on the profile page to reflect the change
            loadChallenges(username); 
            if (action === 'accept' && result.game_id) {
                 window.location.href = `game.php?id=${result.game_id}`;
            }
        } else {
            console.error(`Challenge action '${action}' failed (profile):`, result.message); 
            alert(`Failed to ${action} challenge: ${result.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error(`Error during challenge action '${action}' (profile):`, error); 
        alert(`An error occurred while trying to ${action} the challenge: ${error.message}`);
    }
}

// ... other functions like loadProfileStats, initializeEloGraph, etc. ... 

// Hypothetical fix inside initializeTabs function
function initializeTabs() {
    console.log("Initializing tabs...");
    const tabButtons = document.querySelectorAll('.tab-button'); // Example selector
    
    tabButtons.forEach(button => {
        // --- Add Check ---
        if (!button) {
             console.error("Found a null tab button during initialization.");
             return; // Skip this null button
        }
        // --- End Check ---
        
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab; // Example dataset attribute
            const tabContent = document.getElementById(tabId); // Example getting content pane

            // Remove active classes...
            document.querySelectorAll('.tab-button.active').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content.active').forEach(c => c.classList.remove('active'));

            // Add active class to clicked button
            button.classList.add('active');

            // --- Add Check for Content Pane ---
            if (tabContent) {
                tabContent.classList.add('active');
            } else {
                console.error(`Tab content with ID '${tabId}' not found.`);
            }
            // --- End Check ---
        });
    });
    
     // Maybe activate the first tab by default
     const firstTabButton = document.querySelector('.tab-button');
     if (firstTabButton) {
         firstTabButton.click(); // Simulate click to show first tab
     } else {
         console.error("Could not find the first tab button to activate.");
     }
}

// Make sure you also have the corresponding HTML structure, e.g.:
/*
<div class="tab-container">
    <div class="tab-buttons">
        <button class="tab-button" data-tab="pending-challenges-content">Pending</button>
        <button class="tab-button" data-tab="outgoing-challenges-content">Outgoing</button>
        <button class="tab-button" data-tab="completed-games-content">History</button>
    </div>
    <div class="tab-content-container">
        <div id="pending-challenges-content" class="tab-content">
             <ul id="pending-challenges"></ul>  <-- Your list goes here -->
        </div>
         <div id="outgoing-challenges-content" class="tab-content">
             <ul id="outgoing-challenges"></ul> <-- Your list goes here -->
        </div>
        <div id="completed-games-content" class="tab-content">
             <ul id="completed-games-list"></ul> <-- Example -->
        </div>
    </div>
</div>
*/ 