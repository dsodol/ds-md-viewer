# DS MD Viewer

A lightweight Markdown file viewer for Windows built with Electron and React.

## Features

- **Markdown Rendering**: Full GFM (GitHub Flavored Markdown) support with syntax highlighting for 15+ languages
- **File Browser**: Tree-view file browser starting from C:\ root, with lazy-loading for folders
- **Tab Support**: Open multiple files in tabs
- **Table of Contents**: Auto-generated outline from document headings in the sidebar
- **Font Customization**: Select any system font for body text and code blocks
- **Zoom Controls**: Ctrl+mouse wheel or toolbar buttons (50%-200%)
- **Session Persistence**: Remembers last opened file and settings
- **File Sync**: Navigate file browser to current file location
- **TOC Sync**: Ctrl+click on document text to highlight corresponding heading in outline

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+O | Open file |
| Ctrl+Shift+O | Open folder |
| Ctrl+Mouse Wheel | Zoom in/out |
| Ctrl+Click | Sync with TOC outline |

## Technology Stack

- **Electron** - Desktop application framework
- **React** - UI library
- **Webpack** - Module bundler
- **react-markdown** - Markdown parser
- **remark-gfm** - GitHub Flavored Markdown support
- **react-syntax-highlighter** - Code syntax highlighting
- **electron-store** - Settings persistence
- **font-list** - System font enumeration

## Development

```bash
# Install dependencies
npm install

# Run in development
npm start

# Build for production
npm run build

# Create installer
npm run dist
```

## Building

The application uses electron-builder for creating Windows installers:

```bash
npm run dist
```

This creates an NSIS installer in the `release` folder.

## License

MIT
