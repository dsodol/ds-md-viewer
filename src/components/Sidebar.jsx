import React, { useState } from 'react';

function FileItem({ item, onFileSelect, currentFilePath, level = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const isActive = item.path === currentFilePath;

  if (item.isDirectory) {
    return (
      <div className="sidebar-folder">
        <div
          className="sidebar-item folder"
          style={{ paddingLeft: `${12 + level * 16}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="currentColor"
            className={`folder-arrow ${expanded ? 'expanded' : ''}`}
          >
            <path d="M4 2l4 4-4 4V2z"/>
          </svg>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="folder-icon">
            <path d="M1 3h5l2 2h7v9H1V3zm1 1v9h12V6H7.5L5.5 4H2z"/>
          </svg>
          <span className="item-name">{item.name}</span>
        </div>
        {expanded && (
          <div className="folder-children">
            {item.children.map((child, index) => (
              <FileItem
                key={index}
                item={child}
                onFileSelect={onFileSelect}
                currentFilePath={currentFilePath}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`sidebar-item file ${isActive ? 'active' : ''}`}
      style={{ paddingLeft: `${28 + level * 16}px` }}
      onClick={() => onFileSelect(item.path)}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="file-icon">
        <path d="M3 1h6l4 4v10H3V1zm6 1v3h3L9 2zM4 2v12h8V6H8V2H4z"/>
      </svg>
      <span className="item-name">{item.name}</span>
    </div>
  );
}

function Sidebar({ files, folderPath, onFileSelect, currentFilePath }) {
  const folderName = folderPath.split(/[/\\]/).pop();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title" title={folderPath}>{folderName}</span>
      </div>
      <div className="sidebar-content">
        {files.map((item, index) => (
          <FileItem
            key={index}
            item={item}
            onFileSelect={onFileSelect}
            currentFilePath={currentFilePath}
          />
        ))}
        {files.length === 0 && (
          <div className="sidebar-empty">No Markdown files found</div>
        )}
      </div>
    </div>
  );
}

export default Sidebar;
