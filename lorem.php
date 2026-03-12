<?php
/**
 * AI Lorem Ipsum Generator for placehold.us
 * URL Format: placehold.us/lorem/[words|chars]/[number]/[style]
 * Examples:
 *   placehold.us/lorem/words/50
 *   placehold.us/lorem/chars/200
 *   placehold.us/lorem/words/100/professional
 */

class LoremGenerator {
    
    private $apiKey;
    private $cacheDir;
    private $cacheEnabled = true;
    private $cacheTime = 3600; // Cache for 1 hour to reduce API calls
    
    public function __construct($apiKey = null, $cacheDir = './cache/lorem/') {
        $this->apiKey = $apiKey; // Anthropic API key
        $this->cacheDir = $cacheDir;
        
        // Create cache directory if it doesn't exist
        if ($this->cacheEnabled && !is_dir($this->cacheDir)) {
            mkdir($this->cacheDir, 0755, true);
        }
    }
    
    /**
     * Main handler - call this from your routing
     */
    public function handleRequest($urlPath) {
        // Parse URL: lorem/words/50/professional
        $params = $this->parseUrl($urlPath);
        
        if (!$params) {
            $this->sendError('Invalid URL format. Use: lorem/[words|chars]/[number]/[style]');
            return;
        }
        
        // Check cache first
        $cacheKey = md5(json_encode($params));
        $cached = $this->getCache($cacheKey);
        
        if ($cached !== false) {
            $this->sendResponse($cached, $params['format']);
            return;
        }
        
        // Generate new text
        $text = $this->generateText($params);
        
        if ($text === false) {
            $this->sendError('Failed to generate text. Please try again.');
            return;
        }
        
        // Cache the result
        $this->setCache($cacheKey, $text);
        
        // Send response
        $this->sendResponse($text, $params['format']);
    }
    
    /**
     * Parse URL path into parameters
     */
    private function parseUrl($urlPath) {
        // Remove leading/trailing slashes
        $urlPath = trim($urlPath, '/');
        $parts = explode('/', $urlPath);
        
        // Minimum: lorem/words/50
        if (count($parts) < 3 || $parts[0] !== 'lorem') {
            return false;
        }
        
        $type = $parts[1]; // 'words' or 'chars'
        $count = intval($parts[2]);
        $style = isset($parts[3]) ? $parts[3] : 'casual';
        $format = isset($parts[4]) ? $parts[4] : 'text'; // text, json, html
        
        // Validate
        if (!in_array($type, ['words', 'chars'])) {
            return false;
        }
        
        if ($count <= 0 || $count > 10000) {
            return false;
        }
        
        if (!in_array($style, ['casual', 'professional', 'technical', 'creative', 'formal', 'playful'])) {
            $style = 'casual';
        }
        
        return [
            'type' => $type,
            'count' => $count,
            'style' => $style,
            'format' => $format
        ];
    }
    
    /**
     * Generate text using Anthropic API
     */
    private function generateText($params) {
        $prompt = $params['type'] === 'words' 
            ? "Generate exactly {$params['count']} words of unique, {$params['style']} placeholder text. Make it sound natural and varied - NOT standard Lorem Ipsum. Just output the text directly with no preamble or explanation."
            : "Generate exactly {$params['count']} characters of unique, {$params['style']} placeholder text. Make it sound natural - NOT standard Lorem Ipsum. Just output the text directly with no preamble or explanation.";
        
        $data = [
            'model' => 'claude-sonnet-4-20250514',
            'max_tokens' => 2000,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $prompt
                ]
            ]
        ];
        
        $ch = curl_init('https://api.anthropic.com/v1/messages');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'x-api-key: ' . $this->apiKey,
            'anthropic-version: 2023-06-01'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            error_log("Anthropic API error: " . $response);
            return false;
        }
        
        $result = json_decode($response, true);
        
        if (!isset($result['content'][0]['text'])) {
            return false;
        }
        
        return trim($result['content'][0]['text']);
    }
    
    /**
     * Send response in requested format
     */
    private function sendResponse($text, $format = 'text') {
        switch($format) {
            case 'json':
                header('Content-Type: application/json');
                echo json_encode(['text' => $text]);
                break;
                
            case 'html':
                header('Content-Type: text/html; charset=utf-8');
                echo '<p>' . htmlspecialchars($text) . '</p>';
                break;
                
            default: // text
                header('Content-Type: text/plain; charset=utf-8');
                echo $text;
                break;
        }
    }
    
    /**
     * Send error response
     */
    private function sendError($message) {
        header('HTTP/1.1 400 Bad Request');
        header('Content-Type: text/plain');
        echo $message;
    }
    
    /**
     * Get from cache
     */
    private function getCache($key) {
        if (!$this->cacheEnabled) {
            return false;
        }
        
        $file = $this->cacheDir . $key . '.txt';
        
        if (!file_exists($file)) {
            return false;
        }
        
        // Check if cache is expired
        if (time() - filemtime($file) > $this->cacheTime) {
            unlink($file);
            return false;
        }
        
        return file_get_contents($file);
    }
    
    /**
     * Save to cache
     */
    private function setCache($key, $content) {
        if (!$this->cacheEnabled) {
            return;
        }
        
        $file = $this->cacheDir . $key . '.txt';
        file_put_contents($file, $content);
    }
}

// Example usage - integrate this into your existing routing
// Assuming you already have URL routing that detects /lorem/ paths

/*
// In your main index.php or routing file:

$anthropicApiKey = 'your-api-key-here'; // Or load from config/env

if (preg_match('#^/lorem/#', $_SERVER['REQUEST_URI'])) {
    $lorem = new LoremGenerator($anthropicApiKey);
    $lorem->handleRequest($_SERVER['REQUEST_URI']);
    exit;
}

// Otherwise continue with your existing image placeholder logic
*/

?>
