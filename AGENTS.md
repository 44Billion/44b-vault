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

### Icons
- **CSS-only Icons** - No SVG for security reasons
- **Sources**: css.gg and cssicon.space
- **Location**: `/docs/styles/icons.css`
- **Important**: When adding new icons to HTML, always add their CSS definitions to `/docs/styles/icons.css` from the respective icon libraries

## Development Guidelines

### Import Map Maintenance
- **Critical**: Keep `/docs/import-map.json` updated when adding/removing JS files
- Maps module names to file paths for clean imports

### Handler Pattern
- Handlers resemble custom elements but use plain functions for better accessibility
- Each handler manages a specific page or UI slice
- All handlers initialized via `initHandlers()` function

### Security Considerations
- No server-side dependencies for key operations
- Iframe isolation for security boundaries
- Code transparency through GitHub Pages deployment
- Minimal attack surface through reduced dependencies

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
