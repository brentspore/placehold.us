<?php
// Serve the AauxOffice font file with proper caching headers
$font_file = __DIR__ . '/AauxOffice-Bold.ttf';

if (file_exists($font_file)) {
    // Set headers for font delivery
    header("Content-Type: font/ttf");
    header("Cache-Control: public, max-age=31536000"); // Cache for 1 year
    header("Access-Control-Allow-Origin: *"); // Allow cross-origin requests for fonts
    
    // Optional: Set Last-Modified header
    $mtime = filemtime($font_file);
    header("Last-Modified: " . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
    
    // Check if client has cached version
    if (isset($_SERVER['HTTP_IF_MODIFIED_SINCE']) && 
        strtotime($_SERVER['HTTP_IF_MODIFIED_SINCE']) >= $mtime) {
        header("HTTP/1.0 304 Not Modified");
        exit;
    }
    
    readfile($font_file);
} else {
    header("HTTP/1.0 404 Not Found");
    echo "Font file not found";
}
?>
