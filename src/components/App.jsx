import React, { useState, useEffect, useRef } from 'react';
import FileBrowser from './FileBrowser';
import MarkdownViewer from './MarkdownViewer';
import TableOfContents from './TableOfContents';
import FontPicker from './FontPicker';

function App() {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [folderFiles, setFolderFiles] = useState([]);
  const [folderPath, setFolderPath] = useState('');
  const [expandToPath, setExpandToPath] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [fonts, setFonts] = useState([]);
  const [fontFamily, setFontFamily] = useState('Segoe UI');
  const [codeFontFamily, setCodeFontFamily] = useState('JetBrains Mono');
  const [zoom, setZoom] = useState(100);
  const [showFontPicker, setShowFontPicker] = useState(null); // null, 'body', or 'code'
  const [activeHeadingId, setActiveHeadingId] = useState(null);
  const sidebarRef = useRef(null);
  const tabIdCounter = useRef(1);

  const activeTab = tabs.find(t => t.id === activeTabId);

  // Load fonts and settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const systemFonts = await window.electronAPI.getSystemFonts();
      setFonts(systemFonts);

      const settings = await window.electronAPI.getSettings();
      setFontFamily(settings.fontFamily);
      setCodeFontFamily(settings.codeFontFamily);
      setZoom(settings.zoom);
    };
    loadSettings();
  }, []);

  // Save settings when they change
  const updateSettings = async (newSettings) => {
    await window.electronAPI.saveSettings(newSettings);
  };

  const handleFontSelect = (font) => {
    setFontFamily(font);
    updateSettings({ fontFamily: font });
  };

  const handleCodeFontSelect = (font) => {
    setCodeFontFamily(font);
    updateSettings({ codeFontFamily: font });
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + 10, 200);
    setZoom(newZoom);
    updateSettings({ zoom: newZoom });
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 10, 50);
    setZoom(newZoom);
    updateSettings({ zoom: newZoom });
  };

  const handleZoomReset = () => {
    setZoom(100);
    updateSettings({ zoom: 100 });
  };

  // Ctrl+mouse wheel zoom
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          // Scroll up = zoom in
          setZoom(prev => {
            const newZoom = Math.min(prev + 10, 200);
            updateSettings({ zoom: newZoom });
            return newZoom;
          });
        } else {
          // Scroll down = zoom out
          setZoom(prev => {
            const newZoom = Math.max(prev - 10, 50);
            updateSettings({ zoom: newZoom });
            return newZoom;
          });
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    window.electronAPI.onFileOpened((data) => {
      // Check if file is already open in a tab
      const existingTab = tabs.find(t => t.filePath === data.filePath);
      if (existingTab) {
        // Update content and switch to tab
        setTabs(prev => prev.map(tab =>
          tab.filePath === data.filePath
            ? { ...tab, content: data.content, fileName: data.fileName }
            : tab
        ));
        setActiveTabId(existingTab.id);
      } else {
        // Create new tab
        const newTab = {
          id: tabIdCounter.current++,
          fileName: data.fileName,
          filePath: data.filePath,
          content: data.content
        };
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
      }
    });

    window.electronAPI.onFolderOpened((data) => {
      setFolderPath(data.folderPath);
      setFolderFiles(data.files);
    });

    window.electronAPI.onExpandToPath((targetPath) => {
      setExpandToPath(targetPath);
    });

    window.electronAPI.onMenuOpenFile(() => {
      handleOpenFile();
    });

    window.electronAPI.onMenuOpenFolder(() => {
      handleOpenFolder();
    });
  }, [tabs]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (newWidth >= 150 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleOpenFile = async () => {
    await window.electronAPI.openFileDialog();
  };

  const handleOpenFolder = async () => {
    await window.electronAPI.openFolderDialog();
  };

  const handleFileSelect = async (path) => {
    await window.electronAPI.readFile(path);
  };

  const handleRefresh = async () => {
    await window.electronAPI.refreshFolder();
  };

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleCloseTab = (tabId, e) => {
    e.stopPropagation();
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId && newTabs.length > 0) {
      // Switch to adjacent tab
      const newIndex = Math.min(tabIndex, newTabs.length - 1);
      setActiveTabId(newTabs[newIndex].id);
    } else if (newTabs.length === 0) {
      setActiveTabId(null);
    }
  };

  const handleSyncToFile = async () => {
    if (activeTab && activeTab.filePath) {
      await window.electronAPI.syncToFile(activeTab.filePath);
    }
  };

  const handleRefreshFile = async () => {
    if (activeTab && activeTab.filePath) {
      const result = await window.electronAPI.refreshFile(activeTab.filePath);
      if (result) {
        setTabs(prev => prev.map(tab =>
          tab.id === activeTabId
            ? { ...tab, content: result.content, fileName: result.fileName }
            : tab
        ));
      }
    }
  };

  return (
    <div className="app">
      <div
        className={`sidebar-container ${sidebarCollapsed ? 'collapsed' : ''}`}
        style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
        ref={sidebarRef}
      >
        <div className="sidebar-split">
          <div className="sidebar-top">
            <FileBrowser
              files={folderFiles}
              folderPath={folderPath}
              onFileSelect={handleFileSelect}
              onOpenFile={handleOpenFile}
              onOpenFolder={handleOpenFolder}
              onSyncToFile={handleSyncToFile}
              onRefresh={handleRefresh}
              currentFilePath={activeTab?.filePath}
              hasActiveFile={!!activeTab}
              expandToPath={expandToPath}
              onExpandComplete={() => setExpandToPath(null)}
            />
          </div>
          <div className="sidebar-bottom">
            <TableOfContents content={activeTab?.content || ''} activeHeadingId={activeHeadingId} />
          </div>
        </div>
      </div>
      <div
        className={`resize-handle ${isResizing ? 'active' : ''}`}
        onMouseDown={handleResizeStart}
      >
        <button
          className="collapse-btn"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            {sidebarCollapsed ? (
              <path d="M4 2l4 4-4 4z"/>
            ) : (
              <path d="M8 2L4 6l4 4z"/>
            )}
          </svg>
        </button>
      </div>
      <div className="main-content">
        <div className="viewer-toolbar">
          <div className="toolbar-section">
            <label className="toolbar-label">Font:</label>
            <button
              className="font-picker-btn"
              onClick={() => setShowFontPicker('body')}
              style={{ fontFamily: `'${fontFamily}', sans-serif` }}
            >
              {fontFamily}
            </button>
          </div>
          <div className="toolbar-section">
            <label className="toolbar-label">Code:</label>
            <button
              className="font-picker-btn"
              onClick={() => setShowFontPicker('code')}
              style={{ fontFamily: `'${codeFontFamily}', monospace` }}
            >
              {codeFontFamily}
            </button>
          </div>
          <div className="toolbar-section toolbar-zoom">
            <button className="toolbar-btn" onClick={handleZoomOut} title="Zoom Out">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3 7h10v2H3z"/>
              </svg>
            </button>
            <span className="zoom-level" onClick={handleZoomReset} title="Reset Zoom">
              {zoom}%
            </span>
            <button className="toolbar-btn" onClick={handleZoomIn} title="Zoom In">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M7 3v4H3v2h4v4h2V9h4V7H9V3z"/>
              </svg>
            </button>
          </div>
        </div>
        {tabs.length > 0 && (
          <div className="tabs-bar">
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
                onClick={() => setActiveTabId(tab.id)}
                title={tab.filePath}
              >
                <span className="tab-title">{tab.fileName}</span>
                <button
                  className="tab-close"
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  title="Close tab"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                    <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  </svg>
                </button>
              </div>
            ))}
            <button
              className="tab-refresh"
              onClick={handleRefreshFile}
              title="Refresh file (reload from disk)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.65 2.35A8 8 0 1 0 16 8h-2a6 6 0 1 1-1.76-4.24L10 6h6V0l-2.35 2.35z"/>
              </svg>
            </button>
          </div>
        )}
        <MarkdownViewer
          content={activeTab?.content || ''}
          fileName={activeTab?.fileName || ''}
          fontFamily={fontFamily}
          codeFontFamily={codeFontFamily}
          zoom={zoom}
          onHeadingSync={setActiveHeadingId}
        />
      </div>
      {showFontPicker && (
        <FontPicker
          fonts={fonts}
          currentFont={showFontPicker === 'body' ? fontFamily : codeFontFamily}
          onSelect={showFontPicker === 'body' ? handleFontSelect : handleCodeFontSelect}
          onClose={() => setShowFontPicker(null)}
          title={showFontPicker === 'body' ? 'Select Body Font' : 'Select Code Font'}
          previewText={showFontPicker === 'code' ? 'const x = 42; function test() { return x * 2; }' : undefined}
        />
      )}
    </div>
  );
}

export default App;
