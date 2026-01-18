export function normalizeUSNumber(number: string) {
  // Remove non-digits
  const digits = number.replace(/\D/g, "");
  // Ensure 10 digits
  if (digits.length === 10) return `+1${digits}`;
  // Already has country code?
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null; // invalid
}

const customerNumber = normalizeUSNumber("5204445252"); // +15204445252
if (!customerNumber) throw new Error("Invalid phone number");
