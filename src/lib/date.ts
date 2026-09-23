/**
 * Deterministic Date & Time Formatting Utilities
 *
 * Provides locale-independent, cross-platform consistent date strings
 * between Node.js SSR and Browser Hydration to prevent any React hydration mismatch.
 */

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday"
];

function toValidDate(d: Date | string | number): Date {
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? new Date() : date;
}

/**
 * Example: "Wed, Sep 23, 12:00 AM"
 */
export function formatSessionDateTime(d: Date | string | number): string {
  const date = toValidDate(d);
  const weekday = DAYS_SHORT[date.getDay()];
  const month = MONTHS_SHORT[date.getMonth()];
  const day = date.getDate();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${weekday}, ${month} ${day}, ${hours}:${minutes} ${ampm}`;
}

/**
 * Example: "Sep 23"
 */
export function formatDateShort(d: Date | string | number): string {
  const date = toValidDate(d);
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Example: "Sep 23, 2026"
 */
export function formatDateMedium(d: Date | string | number): string {
  const date = toValidDate(d);
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Example: "September 23, 2026"
 */
export function formatDateLong(d: Date | string | number): string {
  const date = toValidDate(d);
  return `${MONTHS_LONG[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Example: "Wednesday, Sep 23"
 */
export function formatWeekdayDate(d: Date | string | number): string {
  const date = toValidDate(d);
  return `${DAYS_LONG[date.getDay()]}, ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Example: "12:00 AM"
 */
export function formatTime(d: Date | string | number): string {
  const date = toValidDate(d);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}
