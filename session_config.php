<?php
// Make sure no output has been sent before this file is included
if (headers_sent()) {
    // Log the error but don't try to modify session settings
    error_log("Warning: Attempted to configure session after headers were sent");
} else {
    // Use a unique session name to avoid conflicts with WordPress
    session_name('CHESS_SESSION');

    // Configure session settings
    ini_set('session.cookie_lifetime', 86400); // 1 day
    ini_set('session.gc_maxlifetime', 86400); // 1 day

    // Set session cookie parameters
    session_set_cookie_params([
        'lifetime' => 86400, // 1 day
        'path' => '/cloud-chess/', // Restrict to the chess subdirectory
        'domain' => '',
        'secure' => isset($_SERVER['HTTPS']), // Secure if HTTPS
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    // Start the session
    session_start();
}
?> 