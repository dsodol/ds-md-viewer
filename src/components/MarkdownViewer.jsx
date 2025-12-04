import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import css from 'react-syntax-highlighter/dist/esm/languages/hljs/css';
import xml from 'react-syntax-highlighter/dist/esm/languages/hljs/xml';
import markdown from 'react-syntax-highlighter/dist/esm/languages/hljs/markdown';
import sql from 'react-syntax-highlighter/dist/esm/languages/hljs/sql';
import java from 'react-syntax-highlighter/dist/esm/languages/hljs/java';
import csharp from 'react-syntax-highlighter/dist/esm/languages/hljs/csharp';
import cpp from 'react-syntax-highlighter/dist/esm/languages/hljs/cpp';
import go from 'react-syntax-highlighter/dist/esm/languages/hljs/go';
import rust from 'react-syntax-highlighter/dist/esm/languages/hljs/rust';
import yaml from 'react-syntax-highlighter/dist/esm/languages/hljs/yaml';

SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('shell', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('html', xml);
SyntaxHighlighter.registerLanguage('xml', xml);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('csharp', csharp);
SyntaxHighlighter.registerLanguage('cs', csharp);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('c', cpp);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('rs', rust);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('yml', yaml);

function MarkdownViewer({ content, fileName, fontFamily = 'Segoe UI', codeFontFamily = 'JetBrains Mono', zoom = 100, onHeadingSync }) {
  // Handle Ctrl+click to find the closest heading and sync with TOC
  const handleClick = (e) => {
    if (!onHeadingSync || !e.ctrlKey) return;

    // Find the closest heading element by walking up the DOM or finding nearby headings
    let element = e.target;
    let headingId = null;

    // First, check if the clicked element is within a heading
    while (element && element !== e.currentTarget) {
      if (/^H[1-6]$/.test(element.tagName)) {
        headingId = element.id;
        break;
      }
      element = element.parentElement;
    }

    // If not directly on a heading, find the closest heading above the click position
    if (!headingId) {
      const allHeadings = e.currentTarget.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const clickY = e.clientY;

      for (let i = allHeadings.length - 1; i >= 0; i--) {
        const heading = allHeadings[i];
        const rect = heading.getBoundingClientRect();
        if (rect.top <= clickY) {
          headingId = heading.id;
          break;
        }
      }
    }

    if (headingId) {
      onHeadingSync(headingId);
    }
  };

  const contentStyle = {
    fontFamily: `'${fontFamily}', sans-serif`,
    fontSize: `${14 * zoom / 100}px`,
  };

  const codeStyle = {
    '--code-font-family': `'${codeFontFamily}', monospace`,
  };

  if (!content) {
    return (
      <div className="markdown-viewer empty">
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="currentColor" opacity="0.3">
            <path d="M12 4h24l16 16v40H12V4zm24 4v12h12L36 8zM16 8v48h32V24H32V8H16z"/>
            <path d="M20 32h24v2H20zm0 6h24v2H20zm0 6h16v2H20z"/>
          </svg>
          <h2>No file open</h2>
          <p>Open a Markdown file to view its contents</p>
          <div className="shortcuts">
            <span><kbd>Ctrl</kbd> + <kbd>O</kbd> Open File</span>
            <span><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd> Open Folder</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="markdown-viewer">
      <div className="markdown-content" style={{ ...contentStyle, ...codeStyle }} onClick={handleClick}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  style={docco}
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
            a({ node, children, href, ...props }) {
              // Handle anchor links for in-document navigation
              if (href && href.startsWith('#')) {
                const handleClick = (e) => {
                  e.preventDefault();
                  const targetId = href.slice(1);
                  const element = document.getElementById(targetId);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                  }
                };
                return (
                  <a href={href} onClick={handleClick} {...props}>
                    {children}
                  </a>
                );
              }
              // External links open in browser
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                >
                  {children}
                </a>
              );
            },
            // Add IDs to headings for anchor navigation
            h1({ node, children, ...props }) {
              const id = String(children).toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '');
              return <h1 id={id} {...props}>{children}</h1>;
            },
            h2({ node, children, ...props }) {
              const id = String(children).toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '');
              return <h2 id={id} {...props}>{children}</h2>;
            },
            h3({ node, children, ...props }) {
              const id = String(children).toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '');
              return <h3 id={id} {...props}>{children}</h3>;
            },
            h4({ node, children, ...props }) {
              const id = String(children).toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '');
              return <h4 id={id} {...props}>{children}</h4>;
            },
            h5({ node, children, ...props }) {
              const id = String(children).toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '');
              return <h5 id={id} {...props}>{children}</h5>;
            },
            h6({ node, children, ...props }) {
              const id = String(children).toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '');
              return <h6 id={id} {...props}>{children}</h6>;
            },
            img({ node, src, alt, ...props }) {
              // Handle relative image paths
              return <img src={src} alt={alt} loading="lazy" {...props} />;
            },
            table({ node, children, ...props }) {
              return (
                <div className="table-wrapper">
                  <table {...props}>{children}</table>
                </div>
              );
            }
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default MarkdownViewer;
