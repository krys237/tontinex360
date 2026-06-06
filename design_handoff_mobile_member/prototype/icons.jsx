// icons.jsx — inline SVG icon set (Ionicons-style, filled + outline)
// Self-contained: renders identically in live browser, screenshot capture and PDF export.
// Uses currentColor so the <Icon> wrapper controls color/size.

const ICON_PATHS = {
  // ---- filled (tab bar + status) ----
  home: <path d="M12 3.2 3 10.3V20a1 1 0 0 0 1 1h5v-6h6v6h5a1 1 0 0 0 1-1v-9.7L12 3.2Z"/>,
  cash: <g><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6" fill="#fff"/><circle cx="5.6" cy="9.2" r="1.1" fill="#fff"/><circle cx="18.4" cy="14.8" r="1.1" fill="#fff"/></g>,
  card: <g><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><rect x="2.5" y="8.5" width="19" height="2.6" fill="#fff"/></g>,
  wallet: <path d="M5 5.5h11A3 3 0 0 1 19 8h-2.5A2.5 2.5 0 0 0 14 10.5 2.5 2.5 0 0 0 16.5 13H19v2.5a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3Zm11.6 6.5a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Z"/>,
  people: <g><circle cx="9" cy="8.2" r="3"/><path d="M3.2 18.4c0-3 2.6-5.2 5.8-5.2s5.8 2.2 5.8 5.2v.6H3.2v-.6Z"/><circle cx="16.4" cy="8.8" r="2.4"/><path d="M16.4 12.6c2.6 0 4.4 1.9 4.4 4.4v.6h-4.1c.1-1.9-.6-3.7-1.9-5Z"/></g>,
  person: <g><circle cx="12" cy="7.6" r="3.6"/><path d="M4.6 19.4c0-3.6 3.3-6 7.4-6s7.4 2.4 7.4 6v.6H4.6v-.6Z"/></g>,
  layers: <g><path d="M12 2.2 2 8l10 5.8L22 8 12 2.2Z"/><path d="M4.3 11.1 2 12.4l10 5.8 10-5.8-2.3-1.3L12 16.6 4.3 11.1Z"/></g>,
  create: <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/>,
  'lock-closed': <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 0 1 6 0v3H9Z"/>,
  'shield-checkmark': <path d="M12 2 4 5v6c0 4.5 3.4 8.7 8 10 4.6-1.3 8-5.5 8-10V5l-8-3Zm3.5 7.4-4.2 4.2a1 1 0 0 1-1.4 0L8 11.7l1.4-1.4 1.2 1.2 3.5-3.5 1.4 1.4Z"/>,
  business: <path d="M5 3a1 1 0 0 0-1 1v17h7v-4h2v4h7V10a1 1 0 0 0-1-1h-5V4a1 1 0 0 0-1-1H5Zm2 4h2v2H7V7Zm4 0h2v2h-2V7ZM7 11h2v2H7v-2Zm4 0h2v2h-2v-2Zm6 0h2v2h-2v-2Zm0 4h2v2h-2v-2Z"/>,
  globe: <g fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18"/></g>,
  camera: <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.7L8.5 5h7l1.3 2h2.7A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z"/><circle cx="12" cy="13" r="3.2"/></g>,
  'log-out': <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3"/><path d="M10 8l4 4-4 4M14 12H3"/></g>,
  trophy: <path d="M7 4h10v1.5h2.5A1.5 1.5 0 0 1 21 7c0 2.4-1.7 4.4-4 4.85A5 5 0 0 1 13 14.9V17h2.2a1 1 0 0 1 1 1v.5H7.8V18a1 1 0 0 1 1-1H11v-2.1A5 5 0 0 1 7 11.85C4.7 11.4 3 9.4 3 7a1.5 1.5 0 0 1 1.5-1.5H7V4Zm0 3H4.6c.2 1.4 1.2 2.5 2.4 2.9V7Zm10 0v2.9c1.2-.4 2.2-1.5 2.4-2.9H17Z"/>,
  'checkmark-circle': <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5 7.4-6.1 6.1a1 1 0 0 1-1.4 0L6 12.4l1.4-1.4 2.8 2.8 5.4-5.4L17 9.4Z"/>,
  'document-text': <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Zm2 14H8v-1.6h8V16Zm0-3.4H8V11h8v1.6ZM13.5 8V3.5L18 8h-4.5Z"/>,
  'information-circle': <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a1.3 1.3 0 1 1 0 2.6A1.3 1.3 0 0 1 12 7Zm1.6 10h-3.2v-1.4h.8v-3.2h-.8V11h2.4v4.6h.8V17Z"/>,
  calendar: <path d="M7 2v2H5.5A2.5 2.5 0 0 0 3 6.5V19a2.5 2.5 0 0 0 2.5 2.5h13A2.5 2.5 0 0 0 21 19V6.5A2.5 2.5 0 0 0 18.5 4H17V2h-2v2H9V2H7Zm12 7H5V6.5A.5.5 0 0 1 5.5 6H7v1h2V6h6v1h2V6h1.5a.5.5 0 0 1 .5.5V9Z"/>,
  'calendar-clear': <path d="M5.5 4A2.5 2.5 0 0 0 3 6.5V19a2.5 2.5 0 0 0 2.5 2.5h13A2.5 2.5 0 0 0 21 19V6.5A2.5 2.5 0 0 0 18.5 4h-13ZM19 9H5V6.5A.5.5 0 0 1 5.5 6h13a.5.5 0 0 1 .5.5V9Z"/>,
  'help-circle': <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm.3 14.9a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm1.7-5.6c-.7.6-.9.9-.9 1.6v.3h-1.9v-.4c0-1.2.5-1.9 1.3-2.5.7-.6.9-.9.9-1.4 0-.6-.5-1-1.2-1-.8 0-1.3.5-1.4 1.3l-1.9-.2C8.4 7.2 9.7 6 11.7 6c1.9 0 3.2 1.1 3.2 2.7 0 1-.4 1.7-.9 2.6Z"/>,
  'arrow-down-circle': <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 11.2 2.3-2.3 1.4 1.4L12 17l-4.7-4.7 1.4-1.4 2.3 2.3V7h2v6.2Z"/>,
  'chatbubble-ellipses': <path d="M12 3C6.8 3 3 6.4 3 10.6c0 2 .9 3.8 2.5 5.1-.2 1.2-.8 2.4-1.6 3.3-.2.2-.1.6.2.6 1.7 0 3.3-.6 4.5-1.5 1.1.4 2.3.6 3.4.6 5.2 0 9-3.4 9-7.6S17.2 3 12 3Zm-4 9a1.3 1.3 0 1 1 0-2.6A1.3 1.3 0 0 1 8 12Zm4 0a1.3 1.3 0 1 1 0-2.6A1.3 1.3 0 0 1 12 12Zm4 0a1.3 1.3 0 1 1 0-2.6A1.3 1.3 0 0 1 16 12Z"/>,
  time: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 10.4-3.3 2.5-1.1-1.5 2.4-1.8V6.5h2v5.9Z"/>,
  location: <path d="M12 2a7 7 0 0 0-7 7c0 4.6 5.7 11.6 6 11.9.5.6 1.5.6 2 0 .3-.3 6-7.3 6-11.9a7 7 0 0 0-7-7Zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2Z"/>,
  checkmark: <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 6.5"/>,
  'chevron-forward': <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>,
  'arrow-up': <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M6 11l6-6 6 6"/>,
  'swap-horizontal': <path fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" d="M7 8h12m0 0-3-3m3 3-3 3M17 16H5m0 0 3-3m-3 3 3 3"/>,

  // ---- outline ----
  'notifications-outline': <path fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" d="M18 8.5a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5ZM10.3 19.5a2 2 0 0 0 3.4 0"/>,
  'eye-outline': <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></g>,
  'calendar-outline': <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></g>,
  'time-outline': <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 6.5V12l3.5 2.5"/></g>,
  'location-outline': <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21.5s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"/><circle cx="12" cy="9.5" r="2.6"/></g>,
  'newspaper-outline': <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h11v13H5a2 2 0 0 1-2-2V7"/><path d="M15 9h4v8a2 2 0 0 1-2 2"/><path d="M6.5 9.5h6M6.5 12.5h6M6.5 15.5h4"/></g>,
  'mail-outline': <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M4 7.5l8 5.5 8-5.5"/></g>,
  'people-outline': <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 6a2.7 2.7 0 0 1 0 5.4M17 14c2.4.2 4 2.1 4 4.6"/></g>,
};

function Icon({ name, size = 20, color = 'currentColor', style = {} }) {
  const path = ICON_PATHS[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}
         style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, color, ...style }}
         aria-hidden="true">
      {path || ICON_PATHS['information-circle']}
    </svg>
  );
}

window.Icon = Icon;
window.ICON_PATHS = ICON_PATHS;
