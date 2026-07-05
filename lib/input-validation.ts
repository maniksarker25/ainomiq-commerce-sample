/**
 * Input validation and sanitization for user-provided data.
 * Prevents XSS, oversized inputs, and invalid data.
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MAX_EMAIL_LENGTH = 254; // RFC 5321
const MAX_NAME_LENGTH = 100;
const MAX_ORG_LENGTH = 100;
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 6;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Sanitize a string by stripping HTML tags and trimming.
 */
export function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[<>"'&]/g, (char) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
      };
      return entities[char] || char;
    })
    .trim();
}

/**
 * Validate and sanitize registration input.
 */
export function validateRegistration(body: {
  name?: string;
  email?: string;
  password?: string;
  organization?: string;
}): { valid: true; data: { name: string; email: string; password: string; organization: string } } | { valid: false; error: string } {
  const { name, email, password, organization } = body;

  if (!name || !email || !password) {
    return { valid: false, error: 'Name, email and password are required' };
  }

  // Name validation
  const cleanName = sanitize(name);
  if (cleanName.length === 0) {
    return { valid: false, error: 'Name cannot be empty' };
  }
  if (cleanName.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `Name must be ${MAX_NAME_LENGTH} characters or less` };
  }

  // Email validation
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail.length > MAX_EMAIL_LENGTH) {
    return { valid: false, error: 'Email address is too long' };
  }
  if (!EMAIL_REGEX.test(cleanEmail)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  // Password validation
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be ${MAX_PASSWORD_LENGTH} characters or less` };
  }

  // Organization validation
  const cleanOrg = organization ? sanitize(organization) : '';
  if (cleanOrg.length > MAX_ORG_LENGTH) {
    return { valid: false, error: `Organization must be ${MAX_ORG_LENGTH} characters or less` };
  }

  return {
    valid: true,
    data: {
      name: cleanName,
      email: cleanEmail,
      password,
      organization: cleanOrg,
    },
  };
}

/**
 * Validate email format.
 */
export function validateEmail(email: string): boolean {
  if (!email || email.length > MAX_EMAIL_LENGTH) return false;
  return EMAIL_REGEX.test(email.toLowerCase().trim());
}

/**
 * Validate password strength.
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) return { valid: false, error: 'Password is required' };
  if (password.length < MIN_PASSWORD_LENGTH) return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  if (password.length > MAX_PASSWORD_LENGTH) return { valid: false, error: `Password must be ${MAX_PASSWORD_LENGTH} characters or less` };
  return { valid: true };
}
