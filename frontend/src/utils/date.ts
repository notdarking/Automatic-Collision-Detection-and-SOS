// Date and UTC Timestamp Utilities
// Handles backend timestamps returning without 'Z' (e.g., '2026-11-24T14:30:00')

export function parseUtcDate(timestampStr: string | null | undefined): Date | null {
  if (!timestampStr) return null;
  const trimmed = timestampStr.trim();
  if (!trimmed) return null;

  // Append 'Z' if there is no timezone specifier (Z or +HH:MM / -HH:MM)
  const normalized = (!trimmed.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(trimmed))
    ? `${trimmed}Z`
    : trimmed;

  const date = new Date(normalized);
  return isNaN(date.getTime()) ? null : date;
}

export function formatUtcTime(timestampStr: string | null | undefined): string {
  const date = parseUtcDate(timestampStr);
  if (!date) return '--:--:--';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
}

export function formatUtcDateTime(timestampStr: string | null | undefined): string {
  const date = parseUtcDate(timestampStr);
  if (!date) return 'Unknown';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
}

export function formatRelativeTime(timestampStr: string | null | undefined): string {
  const date = parseUtcDate(timestampStr);
  if (!date) return '';
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
}
