<?php
// Make sure no output has been sent before this file is included
if (headers_sent()) {
    // Log the error but don't try to modify session settings
    error_log("Warning: Attempted to configure session after headers were sent");
} else {
    // Use a unique session name to avoid conflicts with WordPress
    session_name('CHESS_SESSION');

    // Configure session settings
    ini_set('session.cookie_lifetime', 3600); // 1 hour
    ini_set('session.gc_maxlifetime', 3600); // 1 hour

    // Set session cookie parameters
    session_set_cookie_params([
        'lifetime' => 3600, // 1 hour
        'path' => '/', // Use the root path if your app is not in a subdirectory
        'domain' => '',
        'secure' => isset($_SERVER['HTTPS']), // Secure if HTTPS
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    // Start the session
    session_start();
}
?> 