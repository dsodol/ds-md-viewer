import React, { useState, useEffect, useRef } from 'react';

function FileItem({ item, onFileSelect, onLoadChildren, currentFilePath, level = 0, expandToPath, onExpandComplete }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState(item.children);
  const [loading, setLoading] = useState(false);
  const isActive = item.path === currentFilePath;
  const itemRef = useRef(null);

  // Scroll to file when it matches the target path
  useEffect(() => {
    if (expandToPath && !item.isDirectory) {
      const normalizedItemPath = item.path.toLowerCase().replace(/\\/g, '/');
      const normalizedTargetPath = expandToPath.toLowerCase().replace(/\\/g, '/');

      if (normalizedTargetPath === normalizedItemPath) {
        setTimeout(() => {
          if (itemRef.current) {
            itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          if (onExpandComplete) {
            onExpandComplete();
          }
        }, 100);
      }
    }
  }, [expandToPath, item.path, item.isDirectory, onExpandComplete]);

  // Check if this folder should be expanded to reach the target path
  useEffect(() => {
    if (expandToPath && item.isDirectory) {
      const normalizedItemPath = item.path.toLowerCase().replace(/\\/g, '/');
      const normalizedTargetPath = expandToPath.toLowerCase().replace(/\\/g, '/');

      // If target path starts with this item's path, expand this folder
      if (normalizedTargetPath.startsWith(normalizedItemPath + '/') || normalizedTargetPath === normalizedItemPath) {
        const doExpand = async () => {
          if (children === null) {
            setLoading(true);
            const loadedChildren = await onLoadChildren(item.path);
            setChildren(loadedChildren);
            setLoading(false);
          }
          setExpanded(true);
        };
        doExpand();
      }
    }
  }, [expandToPath, item.path, item.isDirectory, children, onLoadChildren, onExpandComplete]);

  const handleToggle = async () => {
    if (!expanded && children === null) {
      setLoading(true);
      const loadedChildren = await onLoadChildren(item.path);
      setChildren(loadedChildren);
      setLoading(false);
    }
    setExpanded(!expanded);
  };

  if (item.isDirectory) {
    const hasContent = children === null || (children && children.length > 0);
    return (
      <div className="tree-item">
        <div
          ref={itemRef}
          className={`tree-row ${expanded ? 'expanded' : ''}`}
          style={{ paddingLeft: `${4 + level * 16}px` }}
          onClick={handleToggle}
        >
          <span className="tree-expand">
            {hasContent && (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                {expanded ? (
                  <path d="M1 2h6L4 6z"/>
                ) : (
                  <path d="M2 1v6l4-3z"/>
                )}
              </svg>
            )}
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" className="tree-icon">
            {expanded ? (
              <path fill="#dcb67a" d="M1 4v10h14V6H8L6 4H1z"/>
            ) : (
              <path fill="#dcb67a" d="M1 3h5l2 2h7v9H1V3z"/>
            )}
          </svg>
          <span className="tree-label">{item.name}</span>
          {loading && <span className="tree-loading">...</span>}
        </div>
        {expanded && children && children.length > 0 && (
          <div className="tree-children">
            {children.map((child, index) => (
              <FileItem
                key={child.path || index}
                item={child}
                onFileSelect={onFileSelect}
                onLoadChildren={onLoadChildren}
                currentFilePath={currentFilePath}
                level={level + 1}
                expandToPath={expandToPath}
                onExpandComplete={onExpandComplete}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={itemRef}
      className={`tree-row file ${isActive ? 'selected' : ''}`}
      style={{ paddingLeft: `${4 + level * 16}px` }}
      onClick={() => onFileSelect(item.path)}
    >
      <span className="tree-expand"></span>
      <svg width="16" height="16" viewBox="0 0 16 16" className="tree-icon">
        <path fill="#6d8eb5" d="M3 1h6l4 4v10H3V1z"/>
        <path fill="#fff" d="M9 1v4h4"/>
      </svg>
      <span className="tree-label">{item.name}</span>
    </div>
  );
}

function FileBrowser({ files, folderPath, onFileSelect, onOpenFile, onOpenFolder, onSyncToFile, onRefresh, currentFilePath, hasActiveFile, expandToPath, onExpandComplete }) {
  const folderName = folderPath ? folderPath.split(/[/\\]/).pop() || folderPath : '';

  const handleLoadChildren = async (path) => {
    return await window.electronAPI.getFolderChildren(path);
  };

  return (
    <div className="file-browser" style={{ width: '100%' }}>
      <div className="browser-toolbar">
        <button className="toolbar-btn" onClick={onOpenFolder} title="Open Folder">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3h5l2 2h7v9H1V3zm1 2v8h12V6H7.5L5.5 4H2z"/>
          </svg>
        </button>
        <button className="toolbar-btn" onClick={onOpenFile} title="Open File">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 1h6l4 4v10H3V1zm6 1v3h3L9 2zM4 2v12h8V6H8V2H4z"/>
          </svg>
        </button>
        <button
          className="toolbar-btn"
          onClick={onSyncToFile}
          title="Sync to current file location"
          disabled={!hasActiveFile}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z"/>
            <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
        </button>
        <button
          className="toolbar-btn"
          onClick={onRefresh}
          title="Refresh"
          disabled={!folderPath}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.5 8a5.5 5.5 0 1 1-1.21-3.47L10.5 6h4V2l-1.56 1.56A7 7 0 1 0 15 8h-1.5z"/>
          </svg>
        </button>
      </div>

      <div className="browser-content">
        {folderPath ? (
          <div className="tree-view">
            <div className="tree-root">
              <div className="tree-row root-folder expanded">
                <span className="tree-expand">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                    <path d="M1 2h6L4 6z"/>
                  </svg>
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" className="tree-icon">
                  <path fill="#dcb67a" d="M1 4v10h14V6H8L6 4H1z"/>
                </svg>
                <span className="tree-label" title={folderPath}>{folderName}</span>
              </div>
              <div className="tree-children">
                {files.map((item, index) => (
                  <FileItem
                    key={item.path || index}
                    item={item}
                    onFileSelect={onFileSelect}
                    onLoadChildren={handleLoadChildren}
                    currentFilePath={currentFilePath}
                    level={1}
                    expandToPath={expandToPath}
                    onExpandComplete={onExpandComplete}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-browser">
            <p>No folder open</p>
            <button className="open-folder-btn" onClick={onOpenFolder}>
              Open Folder
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default FileBrowser;
