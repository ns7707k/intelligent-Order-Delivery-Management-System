/**
 * Date utility functions
 */

/**
 * Format a date to relative time (e.g., "5 minutes ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted relative time string
 */
export const formatDistanceToNow = (date) => {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now - then) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
};

/**
 * Format a date to a readable string
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Check if a date is today
 * @param {string|Date} date - Date to check
 * @returns {boolean} True if date is today
 */
export const isToday = (date) => {
  const today = new Date();
  const checkDate = new Date(date);
  
  return today.toDateString() === checkDate.toDateString();
};

export const formatDurationHMS = (totalSeconds) => {
  if (!Number.isFinite(totalSeconds)) {
    return '--:--:--';
  }

  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
};

export const getRemainingSeconds = (targetDate, nowTs = Date.now(), fallbackMinutes = null) => {
  if (targetDate) {
    const targetTs = new Date(targetDate).getTime();
    if (!Number.isNaN(targetTs)) {
      return Math.max(0, Math.round((targetTs - nowTs) / 1000));
    }
  }

  if (Number.isFinite(fallbackMinutes)) {
    return Math.max(0, Math.round(fallbackMinutes * 60));
  }

  return null;
};
