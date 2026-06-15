'use client';

import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

interface EmailBodyIframeProps {
  html: string;
}

export function EmailBodyIframe({ html }: EmailBodyIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Measure from the parent. With sandbox="allow-same-origin" (and NO allow-scripts)
  // we can read the iframe DOM safely without ever executing third-party email
  // scripts. This closes the XSS surface that allow-scripts created.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let cleanup: (() => void) | undefined;

    const measure = () => {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;
      const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
      iframe.style.height = (h + 24) + 'px';
    };

    const onLoad = () => {
      measure();
      const doc = iframe.contentDocument;
      if (!doc) return;

      // Re-measure when images finish loading (their height isn't known up-front).
      const imgs = Array.from(doc.images || []);
      imgs.forEach((img) => {
        if (!img.complete) {
          img.addEventListener('load', measure);
          img.addEventListener('error', measure);
        }
      });

      // Watch for layout shifts (fonts loading, etc).
      let ro: ResizeObserver | undefined;
      if (typeof ResizeObserver !== 'undefined' && doc.body) {
        ro = new ResizeObserver(measure);
        ro.observe(doc.body);
      }

      cleanup = () => {
        imgs.forEach((img) => {
          img.removeEventListener('load', measure);
          img.removeEventListener('error', measure);
        });
        ro?.disconnect();
      };
    };

    iframe.addEventListener('load', onLoad);
    return () => {
      iframe.removeEventListener('load', onLoad);
      cleanup?.();
    };
  }, [html]);

  // Tidy up the raw email HTML before rendering. Outlook/Gmail emails are full
  // of empty paragraphs and stacked <br>s that render as huge blank gaps — the
  // main reason raw emails look messy. Collapse them.
  const tidied = (html || '')
    // Drop paragraphs/divs that contain nothing but whitespace, &nbsp; or <br>.
    .replace(/<(p|div)\b[^>]*>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/\1>/gi, '')
    // Collapse 3+ consecutive line breaks down to a single blank line.
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>');

  // Sanitize HTML — DOMPurify strips XSS vectors.
  // FORCE_BODY keeps content as-is; ADD_TAGS allows style/link for email styling.
  const sanitizedHtml =
    typeof window !== 'undefined'
      ? DOMPurify.sanitize(tidied, {
          FORCE_BODY: true,
          ADD_TAGS: ['style', 'link'],
          ADD_ATTR: ['target', 'rel'],
        })
      : tidied; // SSR fallback (iframe is client-only anyway)

  const srcDoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  html, body {
    margin: 0; padding: 0;
    max-width: 100% !important;
    overflow-x: hidden !important;
    word-break: break-word;
    -webkit-text-size-adjust: 100%;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 14px; color: #1A1A1F; line-height: 1.45;
    padding: 4px 2px;
  }
  * { box-sizing: border-box !important; max-width: 100% !important; }
  p:empty, div:empty { display: none; }
  table { border-collapse: collapse !important; width: 100% !important; table-layout: auto !important; }
  table[width], td[width], th[width] { width: auto !important; }
  td, th { word-break: break-word; max-width: 0; }
  img { max-width: 100% !important; height: auto !important; display: block; }
  a { color: #2056A4; word-break: break-all; }
  p { margin: 0 0 0.6em; }
  blockquote { margin: 8px 0; padding: 0 0 0 12px; border-left: 3px solid #DADADA; color: #60606A; }
  [align="center"] { text-align: center; }
  center { display: block; }
</style>
</head>
<body>${sanitizedHtml}</body>
</html>`;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox="allow-same-origin allow-popups"
      scrolling="no"
      style={{ width: '100%', border: 'none', display: 'block', minHeight: '80px', overflow: 'hidden' }}
      title="Email content"
    />
  );
}
