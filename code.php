<?php
// Basic rate limiting - prevent abuse
$rate_limit_file = __DIR__ . '/cache/rate_limit_' . md5($_SERVER['REMOTE_ADDR']);
$max_requests = 100; // Max requests per IP
$time_window = 60; // Per 60 seconds

if (file_exists($rate_limit_file)) {
	$data = json_decode(file_get_contents($rate_limit_file), true);
	if (time() - $data['start'] < $time_window) {
		if ($data['count'] >= $max_requests) {
			header('HTTP/1.1 429 Too Many Requests');
			header('Retry-After: 60');
			die('Rate limit exceeded. Please try again later.');
		}
		$data['count']++;
	} else {
		$data = ['start' => time(), 'count' => 1];
	}
} else {
	$data = ['start' => time(), 'count' => 1];
}
file_put_contents($rate_limit_file, json_encode($data));

$x = strtolower($_GET["x"]);
$expires = 2592000;

// Font configuration - make sure this file exists in the same directory
$font_file = __DIR__ . '/AauxOffice-Bold.ttf';

// Google Analytics 4 Measurement Protocol
function trackImageGeneration($dimensions, $format, $bg, $fg, $text) {
	$measurement_id = 'G-73WR5GHTDB'; // Your GA4 Measurement ID
	$api_secret = '80RE9JSyS0OYWJtIZqSuRw'; // Your API secret
	
	// Generate a client ID (use IP + User Agent as unique identifier)
	$client_id = md5($_SERVER['REMOTE_ADDR'] . $_SERVER['HTTP_USER_AGENT']);
	
	$data = [
		'client_id' => $client_id,
		'events' => [[
			'name' => 'image_generated',
			'params' => [
				'dimensions' => $dimensions,
				'format' => $format,
				'background_color' => $bg,
				'text_color' => $fg,
				'custom_text' => $text ? 'yes' : 'no',
				'engagement_time_msec' => 100
			]
		]]
	];
	
	// Send to GA4 production endpoint
	$url = "https://www.google-analytics.com/mp/collect?measurement_id={$measurement_id}&api_secret={$api_secret}";
	
	$json = json_encode($data);
	$ch = curl_init($url);
	curl_setopt($ch, CURLOPT_POST, 1);
	curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
	curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_TIMEOUT, 1);
	$response = curl_exec($ch);
	$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	curl_close($ch);
	
	// Debug logging - uncomment to troubleshoot
	// error_log("GA4 Tracking: {$dimensions}, {$format} - HTTP Code: {$http_code}");
	// error_log("GA4 Response: " . $response);
}

// Detect format - default to SVG, support PNG, JPG, JPEG, and GIF
$format = 'svg';
if (preg_match('/(png|gif|jpe?g)/', $x, $m)) {
	$format = $m[1];
	// Normalize jpeg to jpg for consistency
	if ($format === 'jpeg') $format = 'jpg';
}

// Cache setup
$cache_dir = __DIR__ . '/cache';
if (!file_exists($cache_dir)) mkdir($cache_dir, 0755, true);

// Auto-cleanup (1% of requests)
if (rand(1, 100) === 1) {
	$files = glob($cache_dir . '/*');
	$now = time();
	foreach ($files as $f) {
		if (is_file($f) && ($now - filemtime($f)) > 2592000) @unlink($f);
	}
	if (count($files) > 10000) {
		usort($files, function($a, $b) { return filemtime($a) - filemtime($b); });
		for ($i = 0; $i < 1000; $i++) @unlink($files[$i]);
	}
}

// Check cache
$cache_file = $cache_dir . '/' . md5($x . ($_GET['text'] ?? '')) . '.' . $format;
if (file_exists($cache_file)) {
	$mtime = gmdate('D, d M Y H:i:s', filemtime($cache_file)) . ' GMT';
	if (getenv("HTTP_IF_MODIFIED_SINCE") == $mtime) {
		header("HTTP/1.0 304 Not Modified");
		exit;
	}
	header("Last-Modified: $mtime");
	header("Expires: " . gmdate('D, d M Y H:i:s', time() + $expires) . ' GMT');
	header("Cache-Control: max-age=$expires, must-revalidate");
	header("Content-type: " . ($format == 'svg' ? 'image/svg+xml' : ($format == 'jpg' ? 'image/jpeg' : "image/$format")));
	readfile($cache_file);
	exit;
}

// Parse colors
$parts = explode('/', $x);
$bg = explode('.', $parts[1] ?? '')[0] ?: "ccc";
$fg = explode('.', $parts[2] ?? '')[0] ?: "969696";

// Parse dimensions
$dims = explode('x', explode('/', $x)[0]);
$w = preg_replace('/[^\d]/', '', $dims[0]);
$h = isset($dims[1]) ? preg_replace('/[^\d]/', '', $dims[1]) : $w;
if ($w * $h >= 16000000) die("Too big!");

$text = isset($_GET['text']) ? str_replace('|', "\n", $_GET['text']) : "$w x $h";

// Track image generation in Google Analytics
trackImageGeneration("{$w}x{$h}", $format, $bg, $fg, isset($_GET['text']) ? $_GET['text'] : '');

// Generate SVG (fast, small, scalable)
if ($format == 'svg') {
	$bg = '#' . $bg;
	$fg = '#' . $fg;
	$size = max(min($w / strlen($text) * 0.75, $h * 0.25), 5);
	
	// Embed the font directly in the SVG as base64
	// This ensures it works even when SVG is used in <img> tags (browsers block external resources)
	$font_base64 = '';
	if (file_exists($font_file)) {
		$font_base64 = base64_encode(file_get_contents($font_file));
	}
	
	$svg = '<?xml version="1.0" encoding="UTF-8"?>
<svg width="' . $w . '" height="' . $h . '" xmlns="http://www.w3.org/2000/svg">
<defs>
<style type="text/css">
@font-face {
font-family: "AauxOffice";
src: url("data:font/truetype;charset=utf-8;base64,' . $font_base64 . '") format("truetype");
font-weight: bold;
}
</style>
</defs>
<rect width="100%" height="100%" fill="' . $bg . '"/>
<text x="50%" y="50%" font-family="AauxOffice, Arial, sans-serif" font-size="' . $size . '" fill="' . $fg . '" text-anchor="middle" dominant-baseline="middle">' . htmlspecialchars($text) . '</text>
</svg>';
	
	file_put_contents($cache_file, $svg);
	header("Last-Modified: " . gmdate('D, d M Y H:i:s') . ' GMT');
	header("Expires: " . gmdate('D, d M Y H:i:s', time() + $expires) . ' GMT');
	header("Cache-Control: max-age=$expires, must-revalidate");
	header("Content-type: image/svg+xml");
	echo $svg;
	exit;
}

// Generate raster image (PNG or GIF only)
include("color.class.php");
$background = new color();
$background->set_hex($bg);
$foreground = new color();
$foreground->set_hex($fg);

$img = imageCreate($w, $h);
$bgc = imageColorAllocate($img, $background->get_rgb('r'), $background->get_rgb('g'), $background->get_rgb('b'));
$fgc = imageColorAllocate($img, $foreground->get_rgb('r'), $foreground->get_rgb('g'), $foreground->get_rgb('b'));

imageFilledRectangle($img, 0, 0, $w, $h, $bgc);

// Use custom TrueType font for PNG/GIF
if (file_exists($font_file)) {
	// Calculate font size based on image dimensions
	$font_size = max(min($w / strlen($text) * 1.2, $h * 0.3), 12);
	
	// Get text dimensions to center it
	$bbox = imagettfbbox($font_size, 0, $font_file, $text);
	$text_width = abs($bbox[4] - $bbox[0]);
	$text_height = abs($bbox[5] - $bbox[1]);
	
	$tx = ($w - $text_width) / 2;
	$ty = ($h - $text_height) / 2 + $text_height; // Add height because baseline is at bottom
	
	// Draw text with TrueType font
	imagettftext($img, $font_size, 0, $tx, $ty, $fgc, $font_file, $text);
} else {
	// Fallback to built-in font if TTF file not found
	$font = 5;
	$text_width = imagefontwidth($font) * strlen($text);
	$text_height = imagefontheight($font);
	$tx = ($w - $text_width) / 2;
	$ty = ($h - $text_height) / 2;
	imagestring($img, $font, $tx, $ty, $text, $fgc);
}

// Map format to PHP GD function name (PHP uses 'imagejpeg' not 'imagejpg')
$save_function = "image" . ($format == 'jpg' ? 'jpeg' : $format);
$save_function($img, $cache_file);

header("Last-Modified: " . gmdate('D, d M Y H:i:s') . ' GMT');
header("Expires: " . gmdate('D, d M Y H:i:s', time() + $expires) . ' GMT');
header("Cache-Control: max-age=$expires, must-revalidate");
header("Content-type: " . ($format == 'jpg' ? 'image/jpeg' : "image/$format"));
$save_function($img);
imageDestroy($img);
?>
