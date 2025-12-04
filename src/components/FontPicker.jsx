import React, { useState, useMemo, useRef, useEffect } from 'react';

function FontPicker({ fonts, currentFont, onSelect, onClose, title, previewText }) {
  const [search, setSearch] = useState('');
  const [selectedFont, setSelectedFont] = useState(currentFont);
  const searchInputRef = useRef(null);
  const selectedItemRef = useRef(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Scroll selected item into view
    selectedItemRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  const filteredFonts = useMemo(() => {
    if (!search) return fonts;
    const searchLower = search.toLowerCase();
    return fonts.filter(font => font.toLowerCase().includes(searchLower));
  }, [fonts, search]);

  const handleSelect = () => {
    onSelect(selectedFont);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      handleSelect();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const currentIndex = filteredFonts.indexOf(selectedFont);
      if (currentIndex < filteredFonts.length - 1) {
        setSelectedFont(filteredFonts[currentIndex + 1]);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIndex = filteredFonts.indexOf(selectedFont);
      if (currentIndex > 0) {
        setSelectedFont(filteredFonts[currentIndex - 1]);
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="font-picker-modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="modal-header">
          <h3>{title || 'Select Font'}</h3>
          <button className="modal-close" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" fill="none"/>
            </svg>
          </button>
        </div>

        <div className="modal-search">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search fonts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="font-preview-section">
          <div className="preview-label">Preview:</div>
          <div
            className="font-preview-text"
            style={{ fontFamily: `'${selectedFont}', sans-serif` }}
          >
            {previewText || 'The quick brown fox jumps over the lazy dog. 0123456789'}
          </div>
        </div>

        <div className="font-list">
          {filteredFonts.map(font => (
            <div
              key={font}
              ref={font === selectedFont ? selectedItemRef : null}
              className={`font-item ${font === selectedFont ? 'selected' : ''}`}
              style={{ fontFamily: `'${font}', sans-serif` }}
              onClick={() => setSelectedFont(font)}
              onDoubleClick={() => {
                setSelectedFont(font);
                onSelect(font);
                onClose();
              }}
            >
              {font}
            </div>
          ))}
          {filteredFonts.length === 0 && (
            <div className="font-list-empty">No fonts found</div>
          )}
        </div>

        <div className="modal-footer">
          <button className="modal-btn secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn primary" onClick={handleSelect}>Select</button>
        </div>
      </div>
    </div>
  );
}

export default FontPicker;
