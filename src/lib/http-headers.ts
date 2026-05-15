/**
 * Build a Content-Disposition header value that's safe against header injection
 * and supports non-ASCII filenames per RFC 5987 / RFC 6266.
 *
 * Why: the filename is often taken from user-controlled input (email
 * attachment names, quote company names). Direct interpolation into a header
 * like `attachment; filename="${name}"` allows:
 *
 *   1. CRLF injection -> response splitting if the runtime doesn't sanitise
 *      header values for the platform (Next.js does in Node, but defensive
 *      depth matters).
 *   2. Quote injection -> breaks the filename parameter and lets a
 *      malicious sender control downstream parsing (some browsers / proxies
 *      misinterpret the value).
 *   3. Non-ASCII names get mangled or dropped.
 *
 * Encoding strategy:
 *   - Strip CR/LF/NUL entirely (no header smuggling).
 *   - Provide an ASCII-only `filename="..."` fallback with quoted-pair escaping
 *     for backslashes and double-quotes.
 *   - Provide a `filename*=UTF-8''<percent-encoded>` parameter for modern UAs.
 *
 * Spec refs:
 *   - RFC 6266 Content-Disposition for HTTP
 *   - RFC 5987 Character set / language encoding for HTTP header parameters
 */
export function contentDisposition(
  filename: string,
  opts: { inline?: boolean } = {},
): string {
  const type = opts.inline ? 'inline' : 'attachment';

  // Defensive: nothing past CR/LF/NUL ever enters the header.
  const cleaned = (filename ?? '').replace(/[\r\n\0]/g, '').slice(0, 255);

  // ASCII fallback: replace anything outside printable ASCII with '_',
  // and quote-escape backslashes/double-quotes so the filename="..." parameter
  // can't be terminated early.
  const ascii = cleaned
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  // RFC 5987: percent-encode the UTF-8 bytes for filename*.
  // encodeURIComponent leaves !*'() unescaped per RFC 3986; per RFC 5987 those
  // also need encoding inside an HTTP header value, so escape them too.
  const utf8 = encodeURIComponent(cleaned).replace(
    /['()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );

  return `${type}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
