import React, { useMemo, useEffect, useRef } from 'react';

function TableOfContents({ content, onNavigate, activeHeadingId }) {
  const activeItemRef = useRef(null);

  const headings = useMemo(() => {
    if (!content) return [];

    const lines = content.split('\n');
    const result = [];

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '');
        result.push({ level, text, id });
      }
    }

    return result;
  }, [content]);

  // Scroll active item into view when it changes
  useEffect(() => {
    if (activeHeadingId && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeHeadingId]);

  const handleClick = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (onNavigate) {
      onNavigate(id);
    }
  };

  if (!content) {
    return (
      <div className="toc-panel">
        <div className="toc-header">OUTLINE</div>
        <div className="toc-empty">No document open</div>
      </div>
    );
  }

  if (headings.length === 0) {
    return (
      <div className="toc-panel">
        <div className="toc-header">OUTLINE</div>
        <div className="toc-empty">No headings found</div>
      </div>
    );
  }

  return (
    <div className="toc-panel">
      <div className="toc-header">OUTLINE</div>
      <div className="toc-content">
        {headings.map((heading, index) => {
          const isActive = heading.id === activeHeadingId;
          return (
            <div
              key={index}
              ref={isActive ? activeItemRef : null}
              className={`toc-item toc-level-${heading.level}${isActive ? ' active' : ''}`}
              onClick={() => handleClick(heading.id)}
              title={heading.text}
            >
              {heading.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TableOfContents;
