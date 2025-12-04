# DS MD Viewer - Project Requirements

## Overview
A lightweight Markdown file viewer for Windows with a modern UI, file browser, and tabbed document interface.

## Core Features

### 1. File Browser (Left Sidebar)
- Tree-style file explorer starting from a root folder
- Shows only folders and `.md`/`.markdown` files
- Lazy-loading of folder contents (expand on click)
- Folders sorted before files, alphabetically within each group
- Hidden files/folders (starting with `.` or `$`) are excluded
- Refresh button to rescan current folder
- "Sync to file" button to expand tree to currently open file's location
- Resizable sidebar (drag handle, 150-500px range)
- Collapsible sidebar with toggle button

### 2. Tabbed Document Interface
- Multiple markdown files can be open simultaneously in tabs
- Tab bar shows file names with close buttons
- Active tab is visually highlighted
- Clicking same file twice does NOT create duplicate tab - switches to existing tab and refreshes content
- Adjacent tab selection when closing active tab
- Refresh button to reload current file from disk
- File path shown as tooltip on tab hover

### 3. Markdown Rendering
- Full GitHub-Flavored Markdown (GFM) support:
  - Headers (h1-h6)
  - Bold, italic, strikethrough
  - Code blocks with syntax highlighting
  - Inline code
  - Tables
  - Lists (ordered and unordered)
  - Blockquotes
  - Links (open in external browser)
  - Images (lazy loading, relative path support)
  - Task lists/checkboxes
- Smooth scrolling
- Anchor links for headers

### 4. Table of Contents (Right part of sidebar, below file browser)
- Auto-generated from document headings
- Hierarchical display matching heading levels
- Click to scroll to heading in document
- Ctrl+click on heading in document syncs/highlights TOC entry
- Active heading highlighted as user scrolls

### 5. Typography Controls (Toolbar)
- Body font selector (system fonts)
- Code font selector (system fonts)
- Font picker modal with search and preview
- Zoom controls: +/- buttons and percentage display
- Ctrl+mouse wheel zoom support
- Click zoom percentage to reset to 100%
- Settings persist between sessions

### 6. Version Display
- Show version number and build number in toolbar
- Format: "v1.0.0 (build N)"
- Build number auto-increments on each build

### 7. Application Identity
- App name: "DS MD Viewer"
- Custom icon with "DS MD" branding (blue document style)
- Icon used for:
  - Application executable
  - Windows taskbar
  - File associations (.md, .markdown files)
  - Installer

### 8. File Associations
- Register as viewer for `.md` files
- Register as viewer for `.markdown` files
- Double-clicking .md file opens in DS MD Viewer
- Single instance: opening another file focuses existing window and opens file in new tab

### 9. Session Persistence
- Remember last opened file
- Remember font settings (body font, code font)
- Remember zoom level
- Restore on next launch

### 10. Window Features
- Default size: 1200x800
- Standard window controls (minimize, maximize, close)
- Window title shows current file name: "{filename} - DS MD Viewer"
- Application menu:
  - File > Open File (Ctrl+O)
  - File > Open Folder (Ctrl+Shift+O)
  - File > Exit (Alt+F4)
  - View > Reload, DevTools, Zoom controls, Fullscreen

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Font: Segoe UI ▼] [Code: JetBrains Mono ▼] [-] 100% [+]  v1.0.0 (build 5)  │
├─────────────────────────────────────────────────────────────────┤
│         │ Tab1.md  ×  │ Tab2.md  ×  │                    [↻]   │
├─────────┼───────────────────────────────────────────────────────┤
│ FILES   │                                                       │
│ ├─ 📁 docs     │                                                │
│ │  └─ 📄 api.md│           MARKDOWN CONTENT                     │
│ ├─ 📄 README.md│           (rendered)                           │
│ └─ 📄 NOTES.md │                                                │
│─────────│                                                       │
│ OUTLINE │                                                       │
│ ├─ Intro│                                                       │
│ ├─ Setup│                                                       │
│ └─ Usage│                                                       │
│    [<]  │                                                       │
└─────────┴───────────────────────────────────────────────────────┘
     ↑ resize handle with collapse button
```

## Visual Design
- Light theme with subtle borders
- Color scheme:
  - Background: #ffffff (content), #f5f5f5 (sidebar/toolbar)
  - Text: #1a1a1a (primary), #666666 (secondary), #999999 (muted)
  - Accent: #0066cc (links, active items)
  - Borders: #e0e0e0
- Hover states on interactive elements
- Smooth transitions

## Technical Requirements

### Platform
- Windows 10/11
- .NET 10 (C#)
- WinUI 3 or WPF for modern Windows UI

### Installer
- NSIS or similar for Windows installer
- Per-user installation option
- Create desktop shortcut
- Create start menu shortcut
- Register file associations

### Build System
- Auto-increment build number on each build
- Version embedded in application
- Generate installer and portable versions

## File Structure (Suggested)
```
ds_md_viewer/
├── src/
│   ├── App.xaml
│   ├── MainWindow.xaml
│   ├── Views/
│   │   ├── FileBrowser.xaml
│   │   ├── MarkdownViewer.xaml
│   │   ├── TableOfContents.xaml
│   │   └── FontPicker.xaml
│   ├── ViewModels/
│   ├── Models/
│   ├── Services/
│   │   ├── MarkdownService.cs
│   │   ├── FileService.cs
│   │   └── SettingsService.cs
│   └── Assets/
│       └── icon.ico
├── build/
└── installer/
```

## Libraries to Consider
- Markdig (markdown parsing)
- WebView2 (for rendering HTML from markdown)
- Or: Custom WPF/WinUI markdown renderer
- Microsoft.Toolkit.Mvvm (MVVM pattern)
- System.Text.Json (settings persistence)

## Performance Considerations
- Lazy load folder contents
- Virtualize long file lists
- Cache rendered markdown
- Async file operations
- Debounce search/filter operations
