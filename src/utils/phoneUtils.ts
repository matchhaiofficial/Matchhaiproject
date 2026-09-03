/**
 * Shared phone utility for Pakistani phone numbers.
 */

/**
 * Normalizes any messy Pakistani phone format into E164 and digits-only.
 * 
 * Input: 03XX..., +92 3XX..., 92..., spaces/dashes
 * Output: 
 *   phoneE164: +923XXXXXXXXX
 *   phoneDigits: 3XXXXXXXXX (last 10 digits)
 */
export const normalizePakistaniPhone = (value: string) => {
    const raw = String(value || "").trim();
    const numeric = raw.replace(/\D/g, "");

    let digits = "";
    if (!numeric) {
        digits = "";
    } else if (raw.startsWith("+")) {
        digits = numeric.startsWith("92") ? numeric.slice(2) : "";
    } else if (numeric.startsWith("0092")) {
        digits = numeric.slice(4);
    } else if (numeric.startsWith("92")) {
        digits = numeric.slice(2);
    } else if (numeric.startsWith("0")) {
        digits = numeric.slice(1);
    } else if (numeric.length === 10) {
        digits = numeric;
    } else {
        digits = "";
    }

    // Ensure we only have 10 digits for the main part
    if (digits.length > 10) {
        digits = digits.slice(-10);
    }

    return {
        phoneE164: digits.length === 10 ? `+92${digits}` : "",
        phoneDigits: digits.length === 10 ? digits : "",
    };
};

/**
 * Formats a phone number for display (messy input -> +92 3XX XXX XXXX or 03XX XXX XXXX)
 */
export const formatPakistaniPhone = (value: string) => {
    const raw = String(value || "").trim();
    const numeric = raw.replace(/\D/g, "");
    if (!numeric) return value;

    let prefix = "";
    let rest = numeric;

    if (raw.startsWith("+")) {
        if (!numeric.startsWith("92")) return value;
        prefix = "+92 ";
        rest = numeric.slice(2);
    } else if (numeric.startsWith("0092")) {
        prefix = "+92 ";
        rest = numeric.slice(4);
    } else if (numeric.startsWith("92")) {
        prefix = "+92 ";
        rest = numeric.slice(2);
    } else if (numeric.startsWith("0")) {
        prefix = "0";
        rest = numeric.slice(1);
    } else if (numeric.length === 10) {
        prefix = "0";
        rest = numeric;
    } else {
        return value;
    }

    // Slice rest to max 10 digits for formatting
    const main = rest.slice(0, 10);
    let formatted = prefix;

    if (main.length <= 3) {
        formatted += main;
    } else if (main.length <= 7) {
        formatted += main.slice(0, 3) + " " + main.slice(3);
    } else {
        formatted +=
            main.slice(0, 3) + " " + main.slice(3, 7) + " " + main.slice(7);
    }

    return formatted.trim();
};

/**
 * Validates if the phone number is a valid Pakistani mobile number.
 */
export const isValidPakistaniPhone = (value: string) => {
    const { phoneDigits } = normalizePakistaniPhone(value);
    const phoneRegex = /^3[0-9]{9}$/;
    return phoneRegex.test(phoneDigits);
};
