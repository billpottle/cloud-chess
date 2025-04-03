# ☁️ Cloud Chess ♟️

A web-based chess game featuring unique rules and pieces, inspired by Katie Pottle's Cloud Shifters novels. Play against others, challenge the computer, and climb the ELO rankings!

You can find a deployed version at https://pottlebooks.com/cloud-chess You can face against other players and there are occasional tournaments.

## Overview

Cloud Chess expands on traditional chess with a larger board and custom pieces, bringing the strategic depth described in the Cloud Shifters series to life. This project implements the game with a focus on a playable web experience.


## ✨ Features

*   **Classic & Custom Gameplay:** Play standard chess or dive into the unique Cloud Chess rules.
*   **10x10 Board:** A larger battlefield for more complex strategies.
*   **Custom Pieces:**
    *   **Archer (♙⇡ / ♟⇣):** Moves like a pawn but can shoot arrows to capture diagonally forward without moving.
    *   **Wrath/Dragon (🐲):** Moves like a queen but limited to two squares. Can potentially capture two pieces in a line with a single move.
*   **Player vs. Player (PvP):** Challenge other users directly.
*   **Player vs. Computer (PvC):** Test your skills against an AI opponent (difficulty levels available).
*   **User Accounts & Authentication:** Register, log in, and maintain your profile.
*   **ELO Rating System:** Track your skill level and see how you rank against others.
*   **Challenge System:** Send and receive game challenges.
*   **Active Game List:** See ongoing public games.
*   **Game History:** Review your completed games.

## 🛠️ Technology Stack

*   **Backend:** PHP
*   **Database:** MySQL
*   **Frontend:** Vanilla JavaScript, HTML5, CSS3
*   **Testing:** Jest

## 🚀 Getting Started

### Prerequisites

*   A web server with PHP support (e.g., Apache, Nginx)
*   MySQL Database
*   Node.js (v14 or higher recommended) and npm

### Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/billpottle/cloud-chess.git
    cd cloud-chess
    ```
2.  **Database Setup:**
    *   Create a MySQL database for the application.
    *   Configure your database credentials in `api/db_connect.php`.
    *   Required tables (like `users`, `user_tokens`, `games`, etc.) should be created. Some scripts (e.g., `api/auth_token.php`) might attempt to create tables if they don't exist, but review `queries.sql` or manually create the schema for reliability.
3.  **Install Node.js Dependencies:**
    ```bash
    npm install
    ```

Note: This is an early 2025 'vibe coding' attempt using several different models. 

There isn't a back end (just database) to validate moves, so it's possible to send invalid game 
states as your move. If you care that much about winning Cloud Chess - I'd certainly like to meet 
you!

1.  Ensure your web server is configured to serve PHP files from the project directory.
2.  Access the application through your web browser (e.g., `http://localhost/cloud-chess/` or your configured virtual host).


1.  **Update Node.js:** Ensure you have Node.js v14 or higher installed (`node --version`). Optional chaining (`?.`) used by Jest requires it.
2.  **Configure Test Script:** Make sure the `test` script in `package.json` is set to `"jest"`:
    ```json
      "scripts": {
        "test": "jest"
      },
    ```
3.  **Run Tests:**
    ```bash
    npm test
    ```

Board is 10x10 instead of 8x8
New piece - Archer - moves and kills like a pawn, but moves without killing and kills without moving
New piece - Wrath (dragon) - Moves like a queen, but only 2 spaces. If opponents are lined up, can kill both pieces in 1 move. 

Distributed under the MIT License. See `LICENSE` for more information.


