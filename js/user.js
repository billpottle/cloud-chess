// Global variables
window.currentUserId = null;
window.currentUsername = null;

// Function to check if user is logged in
function checkUserSession() {
    return fetch('api/check_session.php')
        .then(response => response.json())
        .then(data => {
            console.log('Session check response:', data);
            if (data.logged_in) {
                // User is logged in
                document.getElementById('auth-section').style.display = 'none';
                document.getElementById('user-section').style.display = 'inline';
                
                // Store user info globally FIRST
                window.currentUserId = data.user_id;
                window.currentUsername = data.username;
                
                // THEN show the my games section and load games
                const myGamesSection = document.getElementById('my-games-section');
                if (myGamesSection) {
                    myGamesSection.style.display = 'block';
                    // Now that we have the user ID, load the games
                    console.log('Calling loadUserGames with userId:', window.currentUserId);
                    loadUserGames();
                }
                
                // Get user ELO and display welcome message
                return getUserInfo(data.user_id)
                    .then(userData => {
                        if (userData && userData.success) {
                            displayUserWelcome(data.username, userData);
                        }
                        return data;
                    })
                    .catch(error => {
                        console.error('Error getting user info:', error);
                        // Fallback to basic welcome
                        document.getElementById('user-welcome').textContent = 
                            'Welcome, ' + data.username;
                        return data;
                    });
            }
            return data;
        })
        .catch(error => {
            console.error('Error checking session:', error);
            return { logged_in: false };
        });
}

// Function to get user information
function getUserInfo(userId) {
    return fetch('api/get_user_info.php?user_id=' + userId)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.status);
            }
            if (response.headers.get('content-length') === '0') {
                throw new Error('Empty response received');
            }
            return response.json();
        })
        .catch(error => {
            console.error('Error fetching user data:', error);
            console.log('Trying fallback API endpoint...');
            // Try the simplified endpoint
            return fetch('api/get_user_basic.php?user_id=' + userId)
                .then(response => response.json());
        });
}

// Function to display user welcome message
function displayUserWelcome(username, userData) {
    // Convert ELO to number and format it
    const elo = parseInt(userData.elo) || 1000;
    let welcomeMsg = 'Welcome, ' + username + ' (ELO: ' + elo;
    
    // Add ranking information if available
    if (userData.ranking && userData.total_users) {
        welcomeMsg += ' | Rank: ' + userData.ranking + '/' + userData.total_users;
    }
    
    welcomeMsg += ')';
    document.getElementById('user-welcome').textContent = welcomeMsg;
}

// Function to handle logout
document.addEventListener('DOMContentLoaded', function() {
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
            e.preventDefault();
            fetch('api/logout.php')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        window.location.reload();
                    }
                });
        });
    }
});

// Function to update user activity
function updateUserActivity() {
    if (!window.currentUserId) {
        return; // Don't update if user is not logged in
    }
    
    fetch('api/active_users.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'update'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('User activity updated');
        }
    })
    .catch(error => {
        console.error('Error updating user activity:', error);
    });
}

// Function to load user's active games
function loadUserGames() {
    console.log('loadUserGames called, currentUserId:', window.currentUserId);
    
    if (!window.currentUserId) {
        console.log('No user ID, not loading games');
        return;
    }
    
    // Check if the container exists
    const container = document.getElementById('my-games-container');
    console.log('my-games-container element:', container);
    
    const url = 'api/get_user_games.php?user_id=' + window.currentUserId;
    console.log('Fetching games from:', url);
    
    fetch(url)
        .then(response => {
            console.log('Response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Games data received:', data);
            
            if (data.success) {
                if (!container) {
                    console.error('my-games-container not found in the DOM');
                    return;
                }
                
                if (!data.games || data.games.length === 0) {
                    container.innerHTML = '<p>You have no active games.</p>';
                    return;
                }
                
                // Create table
                let html = '<table class="stats-table">';
                html += '<thead><tr><th>Opponent</th><th>Status</th><th>Last Move</th><th>Action</th></tr></thead>';
                html += '<tbody>';
                
                data.games.forEach(game => {
                    const isUserTurn = game.current_turn_user_id == window.currentUserId;
                    const statusClass = isUserTurn ? 'your-turn' : 'waiting';
                    const statusText = isUserTurn ? 'Your turn' : 'Waiting for opponent';
                    
                    html += `<tr>
                        <td>${game.opponent_username}</td>
                        <td class="${statusClass}">${statusText}</td>
                        <td>${game.last_move_date || 'N/A'}</td>
                        <td><button class="resume-btn" data-game-id="${game.id}">Resume</button></td>
                    </tr>`;
                });
                
                html += '</tbody></table>';
                container.innerHTML = html;
                
                // Add event listeners to resume buttons
                container.querySelectorAll('.resume-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        const gameId = this.getAttribute('data-game-id');
                        window.location.href = 'game.php?id=' + gameId;
                    });
                });
            } else {
                document.getElementById('my-games-container').innerHTML = 
                    '<p>Unable to load your games.</p>';
            }
        })
        .catch(error => {
            console.error('Error loading user games:', error);
            if (container) {
                container.innerHTML = '<p>Error loading your games.</p>';
            }
        });
}

// Function to update game usage statistics
function updateGameStats(gameType) {
    const formData = new FormData();
    formData.append('game_type', gameType);
    
    fetch('api/update_game_stats.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Game usage updated:', data);
        } else {
            console.error('Failed to update game usage:', data.message);
        }
    })
    .catch(error => {
        console.error('Error updating game usage:', error);
    });
} 