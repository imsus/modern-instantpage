# @imsus/modern-instantpage

**Make your site's pages instant in 1 minute and improve your conversion rate by 1%.**

A modernized fork of [instant.page](https://instant.page/) by Alexandre Dieulot, with TypeScript, Speculation Rules API, and PointerEvent support.

## Features

- **Speculation Rules API** — uses modern browser APIs when available, with automatic fallback
- **PointerEvent** — replaces fragile touch/mouse heuristics with native device detection
- **Scheduler API** — uses `scheduler.postTask()` for priority-aware scheduling
- **TypeScript** — full type safety with exported types
- **Tiny** — ~2KB gzipped, zero dependencies

## Install

```bash
npm install @imsus/modern-instantpage
```

## Usage

### Script tag

```html
<script src="dist/instantpage.min.js" type="module"></script>
```

### ES Module

```javascript
import 'modern-instantpage'
```

### Debug build

```html
<script src="dist/instantpage-debug.min.js" type="module"></script>
```

## Configuration

Configure via data attributes on `<body>`:

| Attribute                                 | Description                         |
| ----------------------------------------- | ----------------------------------- |
| `data-instant-intensity="mousedown"`      | Preload on mousedown (80ms average) |
| `data-instant-intensity="mousedown-only"` | Mousedown on desktop only           |
| `data-instant-intensity="viewport"`       | Preload visible links (mobile)      |
| `data-instant-intensity="viewport-all"`   | Preload all visible links           |
| `data-instant-intensity="150"`            | Custom hover delay (ms)             |
| `data-instant-allow-query-string`         | Allow query string pages            |
| `data-instant-allow-external-links`       | Allow external links                |
| `data-instant-whitelist`                  | Only preload marked links           |
| `data-instant-mousedown-shortcut`         | Trigger click on mousedown          |
| `data-no-instant`                         | Blacklist specific links            |

## Browser Support

- Chrome 100+
- Firefox 115+
- Safari 15.4+

Progressive enhancement — no impact on unsupported browsers.

## Development

```bash
pnpm install
pnpm dev        # Start dev server
pnpm build      # Build production + debug
pnpm test       # Run tests
pnpm typecheck  # Type check
```

## Credits

Original library by [Alexandre Dieulot](https://github.com/alexandre-dieulot).

Modernized by [imsus](https://github.com/imsus).

## License

MIT
