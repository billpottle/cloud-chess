// Define showChallengeModal in the global scope
window.showChallengeModal = function() {
    console.log('Showing challenge modal');
    const modal = document.getElementById('challenge-modal');
    if (modal) {
        modal.style.display = 'block';
        
        // Load both types of challenges when opening the modal
        loadChallenges('pending');
        loadChallenges('outgoing');
    } else {
        console.error('Challenge modal element not found');
    }
};

// Function to hide the challenge modal
function hideChallengeModal() {
    document.getElementById('challenge-modal').style.display = 'none';
}

function getActiveUsername() {
    return window.currentUsername || localStorage.getItem('chessUsername');
}

// Function to challenge a user
function challengeUser(userId, username) {
    console.log(`Challenging user: ${username} (ID: ${userId})`);
    
    if (!window.currentUserId) {
        alert('You must be logged in to challenge other players.');
        return;
    }
    
    if (userId === window.currentUserId) {
        alert('You cannot challenge yourself.');
        return;
    }
    
    const confirmChallenge = confirm(`Are you sure you want to challenge ${username}?`);
    if (confirmChallenge) {
        const challenger = getActiveUsername();
        if (!challenger) {
            alert('Unable to determine your username. Please log in again.');
            return;
        }

        // Send challenge request
        fetch(`api/challenge_api.php?action=create&username=${encodeURIComponent(challenger)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                challenged_username: username
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(`Challenge sent to ${username}!`);
                // Reload active users to update UI
                loadActiveUsers();
            } else {
                alert(data.message || 'Failed to send challenge');
            }
        })
        .catch(error => {
            console.error('Error sending challenge:', error);
            alert('An error occurred while sending the challenge');
        });
    }
}

// Function to check for pending challenges
function checkPendingChallenges() {
    if (!window.currentUserId) {
        return;
    }
    
    // Get the current username
    const username = getActiveUsername();
    if (!username) {
        console.error('Username not found for pending challenges check');
        return;
    }
    
    console.log('Checking for pending challenges...', username);
    fetch(`api/challenge_api.php?action=pending&username=${encodeURIComponent(username)}`)
        .then(response => response.json())
        .then(data => {
            console.log('Pending challenges response:', data);
            if (data.success && data.challenges && data.challenges.length > 0) {
                // Show the first pending challenge
                const challenge = data.challenges[0];
                
                // Update notification content
                const notification = document.getElementById('challenge-notification');
                
                // Add close button if it doesn't exist
                if (!notification.querySelector('.close-notification')) {
                    const closeButton = document.createElement('span');
                    closeButton.className = 'close-notification';
                    closeButton.innerHTML = '&times;';
                    closeButton.style.position = 'absolute';
                    closeButton.style.top = '10px';
                    closeButton.style.right = '10px';
                    closeButton.style.fontSize = '24px';
                    closeButton.style.fontWeight = 'bold';
                    closeButton.style.cursor = 'pointer';
                    closeButton.onclick = hideNotification;
                    
                    // Insert as first child of notification
                    notification.insertBefore(closeButton, notification.firstChild);
                }
                
                notification.querySelector('h4').textContent = `Challenge from ${challenge.challenger}`;
                notification.querySelector('p').textContent = `Player with ELO ${challenge.elo} has challenged you to a game!`;
                
                // Set challenge ID for the buttons
                document.getElementById('accept-challenge-btn').setAttribute('data-challenge-id', challenge.id);
                document.getElementById('decline-challenge-btn').setAttribute('data-challenge-id', challenge.id);
                
                // Show notification
                notification.style.display = 'block';
                
                // Add click outside listener
                document.addEventListener('click', handleOutsideClick);
            }
        })
        .catch(error => {
            console.error('Error checking for challenges:', error);
        });
}

// Function to hide the notification
function hideNotification() {
    const notification = document.getElementById('challenge-notification');
    if (notification) {
        notification.style.display = 'none';
        
        // Remove the click outside listener
        document.removeEventListener('click', handleOutsideClick);
    }
}

// Function to handle clicks outside the notification
function handleOutsideClick(event) {
    const notification = document.getElementById('challenge-notification');
    
    // If the click is outside the notification, hide it
    if (notification && !notification.contains(event.target)) {
        hideNotification();
    }
}

// Function to accept a challenge
function acceptChallenge(challengeId) {
    fetch('api/challenge_api.php?action=accept', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            challenge_id: parseInt(challengeId, 10)
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Hide the notification
            hideNotification();
            
            // Hide the modal if it's open
            hideChallengeModal();
            
            // Redirect to the game
            if (data.game_id) {
                window.location.href = 'game.php?id=' + data.game_id;
            } else {
                alert('Challenge accepted! The game will appear in your active games.');
                // Reload user games
                loadUserGames();
                loadChallenges('pending');
                loadChallenges('outgoing');
            }
        } else {
            alert(data.message || 'Failed to accept challenge');
        }
    })
    .catch(error => {
        console.error('Error accepting challenge:', error);
        alert('An error occurred while accepting the challenge');
    });
}

// Function to decline a challenge
function declineChallenge(challengeId) {
    const username = getActiveUsername();
    if (!username) {
        alert('Unable to determine your username. Please log in again.');
        return;
    }

    fetch(`api/challenge_api.php?action=decline&username=${encodeURIComponent(username)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            challenge_id: challengeId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Hide the notification
            hideNotification();
            
            // Reload challenges if the modal is open
            loadChallenges('pending');
            loadChallenges('outgoing');
        } else {
            alert(data.message || 'Failed to decline challenge');
        }
    })
    .catch(error => {
        console.error('Error declining challenge:', error);
        alert('An error occurred while declining the challenge');
    });
}

// Function to load challenges in the modal
function loadChallenges(type) {
    console.log(`Loading ${type} challenges...`);
    const listElement = document.getElementById(`${type}-challenge-list`);
    if (!listElement) {
        console.error(`Element with ID "${type}-challenge-list" not found`);
        return;
    }
    
    // Get the current username
    const username = getActiveUsername();
    if (!username) {
        listElement.innerHTML = '<p>Please log in to view challenges.</p>';
        return;
    }
    
    listElement.innerHTML = '<p>Loading challenges...</p>';
    
    fetch(`api/challenge_api.php?action=${type}&username=${encodeURIComponent(username)}`)
        .then(response => response.json())
        .then(data => {
            console.log(`${type} challenges response:`, data);
            if (data.success) {
                if (!data.challenges || data.challenges.length === 0) {
                    listElement.innerHTML = '<p>No challenges found.</p>';
                    return;
                }
                
                let html = '';
                data.challenges.forEach(challenge => {
                    if (type === 'pending') {
                        html += `
                            <div class="challenge-item">
                                <div class="challenge-info">
                                    <strong>${challenge.challenger}</strong> (ELO: ${challenge.elo})<br>
                                    <small>Received: ${challenge.challenge_date}</small><br>
                                    <small>Expires in: ${challenge.expires_in_minutes} minutes</small>
                                </div>
                                <div class="challenge-actions">
                                    <button class="accept-btn" data-challenge-id="${challenge.id}">Accept</button>
                                    <button class="decline-btn" data-challenge-id="${challenge.id}">Decline</button>
                                </div>
                            </div>
                        `;
                    } else {
                        html += `
                            <div class="challenge-item">
                                <div class="challenge-info">
                                    <strong>${challenge.player_being_challenged}</strong> (ELO: ${challenge.elo})<br>
                                    <small>Sent: ${challenge.challenge_date}</small><br>
                                    <small>Expires in: ${challenge.expires_in_minutes} minutes</small>
                                </div>
                                <div class="challenge-actions">
                                    <button class="decline-btn" data-challenge-id="${challenge.id}">Cancel</button>
                                </div>
                            </div>
                        `;
                    }
                });
                
                listElement.innerHTML = html;
                
                // Add event listeners to buttons
                if (type === 'pending') {
                    listElement.querySelectorAll('.accept-btn').forEach(button => {
                        button.addEventListener('click', function() {
                            const challengeId = this.getAttribute('data-challenge-id');
                            acceptChallenge(challengeId);
                        });
                    });
                    
                    listElement.querySelectorAll('.decline-btn').forEach(button => {
                        button.addEventListener('click', function() {
                            const challengeId = this.getAttribute('data-challenge-id');
                            declineChallenge(challengeId);
                        });
                    });
                } else {
                    listElement.querySelectorAll('.decline-btn').forEach(button => {
                        button.addEventListener('click', function() {
                            const challengeId = this.getAttribute('data-challenge-id');
                            cancelChallenge(challengeId);
                        });
                    });
                }
            } else {
                listElement.innerHTML = '<p>Error loading challenges.</p>';
            }
        })
        .catch(error => {
            console.error(`Error loading ${type} challenges:`, error);
            listElement.innerHTML = '<p>Error loading challenges.</p>';
        });
}

// Function to cancel an outgoing challenge
function cancelChallenge(challengeId) {
    fetch('api/challenge_api.php?action=cancel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            challenge_id: challengeId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Reload the outgoing challenges list
            loadChallenges('outgoing');
            loadChallenges('pending');
        } else {
            alert(data.message || 'Failed to cancel challenge');
        }
    })
    .catch(error => {
        console.error('Error cancelling challenge:', error);
        alert('An error occurred while cancelling the challenge');
    });
}

// Set up challenge-related event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Set up challenge notification buttons
    const acceptBtn = document.getElementById('accept-challenge-btn');
    if (acceptBtn) {
        acceptBtn.addEventListener('click', function() {
            const challengeId = this.getAttribute('data-challenge-id');
            acceptChallenge(challengeId);
        });
    }
    
    const declineBtn = document.getElementById('decline-challenge-btn');
    if (declineBtn) {
        declineBtn.addEventListener('click', function() {
            const challengeId = this.getAttribute('data-challenge-id');
            declineChallenge(challengeId);
        });
    }
    
    // Set up challenge modal
    const closeModalBtn = document.getElementById('close-challenge-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', hideChallengeModal);
    }
    
    // Set up tab switching in the challenge modal
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons and content
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            this.classList.add('active');
            const tabName = this.getAttribute('data-tab');
            document.getElementById(`${tabName}-challenges`).classList.add('active');
            
            // Load the challenges for this tab
            loadChallenges(tabName);
        });
    });
    
    // Set up the challenges link click event
    const challengesLink = document.getElementById('challenges-link');
    if (challengesLink) {
        challengesLink.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Challenges link clicked');
            showChallengeModal();
        });
    }
}); 
