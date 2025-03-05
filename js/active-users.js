// Function to load active users
function loadActiveUsers() {
    console.log('loading active users');
    fetch('api/active_users.php')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const container = document.getElementById('active-users-container');
                
                if (!data.active_users || data.active_users.length === 0) {
                    container.innerHTML = '<p>No users currently online.</p>';
                    return;
                }
                
                // Create table
                let html = '<table class="stats-table">';
                html += '<thead><tr><th>Player</th><th>ELO</th><th>Action</th></tr></thead>';
                html += '<tbody>';
                
                data.active_users.forEach(user => {
                    // Check if this is the current user
                    const isCurrentUser = window.currentUserId && window.currentUserId == user.id;
                    
                    html += `<tr>
                        <td>${user.username}</td>
                        <td>${user.elo || 1000}</td>
                        <td>`;
                    
                    // Only show challenge button for other users
                    if (!isCurrentUser) {
                        // Remove the onclick attribute and just use data attributes
                        html += `<button class="challenge-btn" data-user-id="${user.id}" data-username="${user.username}">Challenge</button>`;
                    } else {
                        html += `<em>(You)</em>`;
                    }
                    
                    html += `</td></tr>`;
                });
                
                html += '</tbody></table>';
                container.innerHTML = html;
                
                // Add event listeners to all challenge buttons after they're added to the DOM
                document.querySelectorAll('.challenge-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        const userId = this.getAttribute('data-user-id');
                        const username = this.getAttribute('data-username');
                        challengeUser(userId, username);
                    });
                });
            } else {
                console.error('Failed to load active users:', data.message);
                document.getElementById('active-users-container').innerHTML = 
                    '<p>Unable to load online players.</p>';
            }
        })
        .catch(error => {
            console.error('Error loading active users:', error);
            document.getElementById('active-users-container').innerHTML = 
                '<p>Error loading online players.</p>';
        });
} 