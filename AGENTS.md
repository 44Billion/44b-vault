# AGENTS.md

## Project Overview

**Nostr Secure Login** (aliased as "vault") is an innovative security-focused login module for the [Nostr Protocol](https://github.com/nostr-protocol/nostr) that implements [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md)'s `window.nostr` object without requiring browser extensions.

## Core Concept

Instead of relying on browser extensions (which can be complex for non-technical users), this project provides a secure iframe-based solution that:

- **Runs on GitHub Pages** - Ensures code transparency and auditability
- **Uses iframe isolation** - Provides security boundaries while maintaining UX
- **Leverages Passkeys API** - Stores private keys securely using browser's credential management
- **Supports NIP-07** - Implements the standard Nostr web interface

## Architecture

### Security Model
The vault operates within an iframe to create a security boundary:
- Parent window has no direct access to private keys stored in the vault
- Users can verify the code runs exactly as published on GitHub
- All key operations happen within the isolated vault context

### Key Management
- **Generation**: Creates new Nostr private keys
- **Import/Export**: Supports key portability
- **Storage**: Uses browser Passkeys API creatively by setting `user.id` to the Nostr private key
- **Auto-sync**: Leverages browser's credential sync capabilities
- **Client-side only**: No servers involved in key operations

### Communication Flow
1. Parent window loads vault in iframe
2. Parent window injects `window.nostr` object for napps (Nostr apps)
3. When napp calls NIP-07 method, message is posted to vault iframe
4. Vault processes request using its signer
5. Vault may prompt user for permissions (e.g., "Allow app to decrypt 'kind 785' events?")
6. Vault replies back with signed/encrypted result

## Tech Stack

### Philosophy
- **Vanilla JavaScript** - No complex frameworks for better security and auditability
- **Minimal Dependencies** - Only nostr-tools (from Nostr protocol author) and its dependencies
- **No Build Steps** - Direct file loading (except small dependency integration step)
- **CSS Icons Only** - No SVG for security; uses [css.gg](https://css.gg/) and [cssicon.space](https://cssicon.space/)

### Dependencies
- `nostr-tools` - Official Nostr protocol library
- Build dependencies are minimal and only used for dependency integration

## Project Structure

```
/docs/                          # Source code (GitHub Pages root)
├── index.html                  # Main SPA entry point
├── import-map.json            # JavaScript module mappings (keep updated!)
├── sw.js                      # Service worker for offline access
├── styles/                    # CSS files
│   ├── index.css             # HTML-specific styles
│   ├── icons.css             # Icon-related styles
│   ├── global.css            # Global styles with dark/light mode
│   └── reset.css             # Browser default resets
└── modules/                   # JavaScript modules
    ├── helpers.js             # Utility functions
    ├── router.js              # Page transition router
    ├── handlers/              # Page-specific logic
    │   ├── index.js          # Handler initialization (initHandlers function)
    │   ├── header.js         # Header component logic
    │   ├── home.js           # Home page handler
    │   ├── lock.js           # Lock screen handler
    │   ├── unlock.js         # Unlock handler
    │   └── new-account.js    # Account creation handler
    ├── avatar.js             # Avatar generation
    ├── config.js             # Configuration management
    ├── idb.js                # IndexedDB utilities
    ├── messenger.js          # Message handling
    ├── nostr-relays.js       # Nostr relay management
    ├── nostr-signer.js       # Nostr signing operations
    ├── nostr.js              # Nostr protocol utilities
    ├── passkey-manager.js    # Passkeys API integration
    ├── queries.js            # Data queries and caching
    ├── session-manager.js    # Session state management
    ├── sw-manager.js         # Service worker management
    └── translator.js         # Internationalization

/build/                        # Build output for dependencies
├── esbuild.js                # Build script
└── nostr/                    # Built nostr-tools integration
    ├── index.js              # Main export file
    ├── nip01.js              # Basic Nostr protocol
    ├── nip04.js              # Encrypted Direct Messages
    ├── nip07.js              # Browser extension interface
    ├── nip19.js              # Bech32-encoded identifiers (nsec, npub, etc.)
    ├── nip44.js              # Versioned encryption
    └── relay.js              # Relay connection handling

/tests/                       # Test files
├── queries.test.js           # Queries module tests
└── import-map.test.js       # Import map validation tests
```

## Key Modules

### Core Infrastructure
- **`router.js`** - Handles SPA navigation and page transitions
- **`handlers/index.js`** - Initializes all page handlers via `initHandlers()`
- **`helpers.js`** - Utility functions used throughout the application

### Nostr Integration
- **`nostr-signer.js`** - Handles event signing and encryption
- **`nostr-relays.js`** - Manages connections to Nostr relays
- **`queries.js`** - Handles profile and relay data with caching

### Security & Storage
- **`passkey-manager.js`** - Manages private key storage via Passkeys API
- **`session-manager.js`** - Handles user session state

### UI Components
- **`handlers/`** - Modularized page logic (avoiding custom elements for better developer accessibility)

## Styling Approach

### Color Scheme
- **Dark Mode First** - Default color scheme
- **Automatic Light Mode** - Uses `@media (prefers-color-scheme: light)` to invert colors
- **CSS Reset** - Custom reset for consistent cross-browser behavior

### CSS Unit System
- **CRITICAL**: The project uses a custom rem unit system via `/docs/styles/reset.css`
- **HTML font-size**: `0.0625em` (1/16th of browser default = 1px base)
- **Body font-size**: `16rem` (equivalent to 16px)
- **Result**: `1rem = 1px` throughout the application
- **Font Sizes**: Use rem units - `24rem` for 24px, `16rem` for 16px, `14rem` for 14px
- **Layout Properties**: Use px units for width, height, padding, margin, border-width, etc.
- **Important**: Never use standard CSS assumptions about rem units - always treat `1rem = 1px` for font-size only

### Icons
- **CSS-only Icons** - No SVG for security reasons
- **Sources**: css.gg and cssicon.space
- **Location**: `/docs/styles/icons.css`
- **CRITICAL WORKFLOW**: When adding new icons to HTML, **ALWAYS** add their CSS definitions to `/docs/styles/icons.css` from the respective icon libraries
  - **Step 1**: Add icon HTML class (e.g., `<i class="gg-eye"></i>`)
  - **Step 2**: **IMMEDIATELY** add corresponding CSS from css.gg or cssicon.space to `/docs/styles/icons.css`
  - **Step 3**: Test icon display in browser
  - **css.gg source**: Use official definitions from https://github.com/astrit/css.gg/blob/main/icons/icons.json
  - **cssicon.space source**: Use definitions from https://github.com/wentin/cssicon
  - Common icons: `gg-eye` (visibility), `gg-eye-alt` (hidden), `gg-lock`, `gg-user-add`, etc.

## Development Guidelines

### Code Consistency Checklist
Before implementing any handler, verify:
1. **User Feedback**: Are you using `showSuccessOverlay`/`showErrorOverlay` instead of custom messages?
2. **Route Handling**: Are you using `router.addEventListener` with correct event structure?
3. **Translation**: Are you using `t({ key: 'name' })` object syntax?
4. **Import Patterns**: Are you following established import conventions?
5. **Error States**: Are all error conditions handled with overlays?

### Adding Nostr NIP Helpers
- **Location**: Add new NIP modules in `/build/nostr/` (e.g., `nip19.js`)
- **Export**: Include the new module in `/build/nostr/index.js`
- **Build**: Run `npm run build:nostr` to integrate into `/docs/modules/nostr.js`
- **Usage**: Import functions from the `'nostr'` module in your handlers
- **Examples**: `nip19Decode` for nsec/npub decoding, `npubEncode` for public key encoding

### Import Map Maintenance
- **Critical**: Keep `/docs/import-map.json` updated when adding/removing JS files
- Maps module names to file paths for clean imports

### Handler Pattern
- Handlers resemble custom elements but use plain functions for better accessibility
- Each handler manages a specific page or UI slice
- All handlers initialized via `initHandlers()` function

### Error Handling & User Feedback
- **CRITICAL**: Always use existing overlay system for user feedback
- **Success Messages**: Use `showSuccessOverlay(message)` from `helpers/misc.js`
- **Error Messages**: Use `showErrorOverlay(message, details?)` from `helpers/misc.js`
- **Never create custom message elements** - use the established overlay system
- **Translation**: Always use `t({ key: 'translationKey' })` object syntax, never `t('key')`
- **Overlay Integration**: Import overlays in any handler that needs user feedback

### Route Handling Pattern
- **Event Source**: Use `router.addEventListener('routechange', ...)`
- **Event Structure**: Access route via `e.detail.state.route`
- **Route Format**: Routes include leading slash (e.g., `/backup-accounts`)
- **Pattern**: Check `if (e.detail.state.route !== '/your-route') return`
- **Import**: Always `import { router } from 'router'`

### Import Patterns
- **IDB**: Default import `import idb from 'idb'`, use `idb.methodName()`
- **Translator**: Named import `import { t } from 'translator'`
- **Router**: Named import `import { router } from 'router'`
- **Overlays**: Named import `import { showSuccessOverlay, showErrorOverlay } from 'helpers/misc.js'`

### Translation System
- **Function Signature**: `t({ key: 'translationKey', l?: 'languageCode' })`
- **Correct Usage**: `t({ key: 'noAccountsFound' })`
- **Wrong Usage**: `t('noAccountsFound')` ❌
- **Language Override**: `t({ key: 'message', l: 'pt' })`
- **Always add missing keys** to `translator.js` with both English and Portuguese translations

### Security Considerations
- No server-side dependencies for key operations
- Iframe isolation for security boundaries
- Code transparency through GitHub Pages deployment
- Minimal attack surface through reduced dependencies
- **Always use existing overlay system** - prevents inconsistent UX and potential security issues
- **Never bypass established patterns** - they exist for security and consistency reasons

## Testing

- **Node.js Tests** - Uses Node.js built-in test runner
- **Import Map Loader** - Custom loader for module resolution in tests
- **Module Mocking** - Uses dependency injection pattern for testability

## Permission System

The vault implements a granular permission system:
- Apps request specific permissions (e.g., "decrypt kind 785 events")
- User sees clear permission prompts with app URL
- Well-known Nostr event kinds may be aliased to human-friendly names
- Permissions are remembered per app

## Offline Support

- Service worker at `/docs/sw.js` enables offline functionality
- Critical for security-sensitive applications
- Managed via `sw-manager.js` module

---

*This project prioritizes security, auditability, and user experience while maintaining the decentralized principles of the Nostr protocol.*
