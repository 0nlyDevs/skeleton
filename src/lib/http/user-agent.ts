/**
 * Human label for a User-Agent ("Chrome sur Windows"), for security alerts and
 * the session list. Deliberately coarse: it describes, it never identifies.
 */
export function describeUserAgent(ua: string | null | undefined): { browser: string; os: string } {
  const value = ua ?? "";
  const browser = /Edg\//.test(value)
    ? "Edge"
    : /OPR\/|Opera/.test(value)
      ? "Opera"
      : /Firefox\//.test(value)
        ? "Firefox"
        : /Chrome\//.test(value)
          ? "Chrome"
          : /Safari\//.test(value)
            ? "Safari"
            : "Navigateur inconnu";
  const os = /Android/.test(value)
    ? "Android"
    : /iPhone|iPad|iPod/.test(value)
      ? "iOS"
      : /Windows/.test(value)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(value)
          ? "macOS"
          : /Linux/.test(value)
            ? "Linux"
            : "système inconnu";
  return { browser, os };
}
