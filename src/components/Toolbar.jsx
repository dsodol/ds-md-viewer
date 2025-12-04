import React from 'react';

function Toolbar({ onOpenFile, onOpenFolder, onToggleSidebar, sidebarOpen, hasFolderOpen, fileName }) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn" onClick={onOpenFile} title="Open File (Ctrl+O)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 1h6l4 4v10H3V1zm6 1v3h3L9 2zM4 2v12h8V6H8V2H4z"/>
          </svg>
          <span>Open File</span>
        </button>
        <button className="toolbar-btn" onClick={onOpenFolder} title="Open Folder (Ctrl+Shift+O)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3h5l2 2h7v9H1V3zm1 1v9h12V6H7.5L5.5 4H2z"/>
          </svg>
          <span>Open Folder</span>
        </button>
        {hasFolderOpen && (
          <button
            className={`toolbar-btn ${sidebarOpen ? 'active' : ''}`}
            onClick={onToggleSidebar}
            title="Toggle Sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 2h14v12H1V2zm1 1v10h4V3H2zm5 0v10h7V3H7z"/>
            </svg>
            <span>Sidebar</span>
          </button>
        )}
      </div>
      <div className="toolbar-center">
        {fileName && <span className="current-file">{fileName}</span>}
      </div>
      <div className="toolbar-right">
        <span className="app-title">MD Viewer</span>
      </div>
    </div>
  );
}

export default Toolbar;
