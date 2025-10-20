/**
 * Phone Utility Functions
 * Handles phone number normalization and validation
 */

/**
 * Normalize phone number for comparison
 * @param {string} phoneNumber - Phone number to normalize
 * @returns {string} Normalized phone number (digits only)
 */
export function normalizePhoneNumber(phoneNumber) {
  return String(phoneNumber || '').replace(/\D/g, '');
}

/**
 * Check if a phone number is in the allowed contacts list
 * @param {string} senderNumber - Phone number to check
 * @param {Array<string>} allowedContacts - List of allowed contact numbers
 * @returns {boolean} True if contact is allowed
 */
export function isAllowedContact(senderNumber, allowedContacts) {
  const normalized = normalizePhoneNumber(senderNumber);
  return allowedContacts.some(c => normalizePhoneNumber(c) === normalized);
}

/**
 * Extract phone number from JID (WhatsApp ID)
 * @param {string} jid - WhatsApp JID (e.g., "6281234567890@s.whatsapp.net")
 * @returns {string} Phone number without domain
 */
export function extractPhoneFromJid(jid) {
  return jid?.split('@')[0] || '';
}

/**
 * Format phone number for display
 * @param {string} phoneNumber - Phone number to format
 * @returns {string} Formatted phone number with country code
 */
export function formatPhoneNumber(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return '';
  
  // Add + prefix for international format
  return `+${normalized}`;
}
