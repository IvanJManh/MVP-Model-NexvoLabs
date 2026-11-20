/**
 * Normalizes phone numbers for Sri Lankan E.164 format and validates before calling Meta Graph API:
 * 1. Strips spaces, dashes, and parentheses
 * 2. Converts local 07... numbers to 947...
 * 3. Strips any leading +
 * 4. Validates digits before calling Meta's Graph API
 *
 * @param raw Raw input phone number string
 * @returns Cleaned numeric string without '+' or null if invalid
 */
export function normalizeSriLankanPhone(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;

  // 1. Strip spaces, dashes, and parentheses
  let cleaned = raw.replace(/[\s\-\(\)]/g, "").trim();

  // 2. Strip any leading +
  cleaned = cleaned.replace(/^\+/, "");

  // 3. Convert local 07... numbers to 947...
  if (/^07\d+$/.test(cleaned)) {
    cleaned = "94" + cleaned.slice(1);
  }

  // 4. Validate digits (only numbers, valid international length 7-15 digits)
  if (!/^\d{7,15}$/.test(cleaned)) {
    console.warn(`⚠️ [PHONE NORMALIZATION]: Invalid phone format: "${raw}" -> "${cleaned}"`);
    return null;
  }

  return cleaned;
}
