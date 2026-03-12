# Integration Guide for placehold.us Lorem Generator

## Quick Start

1. **Add the lorem.php file** to your placehold.us directory

2. **Get an Anthropic API key** from https://console.anthropic.com/

3. **Add to your existing routing** (likely in index.php or similar):

```php
<?php
// At the top of your file
require_once 'lorem.php';

// Your existing config
$anthropicApiKey = getenv('ANTHROPIC_API_KEY'); // Or however you store secrets

// Add this before your existing image placeholder logic
if (preg_match('#^/lorem/#', $_SERVER['REQUEST_URI'])) {
    $lorem = new LoremGenerator($anthropicApiKey);
    $lorem->handleRequest($_SERVER['REQUEST_URI']);
    exit;
}

// Your existing placehold.us image code continues below...
?>
```

## URL Examples

Once integrated, these URLs will work:

**Basic:**
- `placehold.us/lorem/words/50` - 50 words, casual style
- `placehold.us/lorem/chars/200` - 200 characters
- `placehold.us/lorem/words/100/professional` - 100 professional words

**With styles:**
- `placehold.us/lorem/words/75/technical`
- `placehold.us/lorem/words/50/creative`
- `placehold.us/lorem/chars/300/formal`

**Different formats:**
- `placehold.us/lorem/words/50/casual/json` - Returns JSON
- `placehold.us/lorem/words/50/casual/html` - Returns wrapped in <p> tags
- `placehold.us/lorem/words/50/casual/text` - Plain text (default)

## Available Styles
- casual (default)
- professional
- technical
- creative
- formal
- playful

## Features Built In

✅ **Caching** - Reduces API costs by caching results for 1 hour
✅ **Error handling** - Graceful failures with error messages
✅ **Format options** - Text, JSON, or HTML output
✅ **Validation** - Prevents abuse (max 10,000 words/chars)
✅ **Simple integration** - One require, one if statement

## Optional: .htaccess

If you're using .htaccess for your existing routing, add this rule:

```apache
# Lorem text generator
RewriteRule ^lorem/(.*)$ index.php [QSA,L]
```

## Cost Management

The built-in cache reduces costs significantly. Each unique request hits the API once, then serves from cache for 1 hour. You can adjust cache time in the constructor:

```php
$lorem = new LoremGenerator($apiKey, './cache/lorem/', 7200); // 2 hour cache
```

To disable caching (not recommended):
```php
$lorem->cacheEnabled = false;
```

## Testing

Test it's working:
1. Visit: `placehold.us/lorem/words/25`
2. You should see 25 unique words
3. Refresh - should serve instantly from cache
4. Try different styles and counts

## Notes

- Each API call costs a few cents
- Caching makes this very affordable
- Generate fresh text by changing parameters
- Works alongside your existing image placeholder code
- No JavaScript required - pure server-side
