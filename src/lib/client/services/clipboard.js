/**
 * Clipboard utilities for copying text to clipboard with fallback support
 */

/**
 * Copy text to clipboard with fallback for older browsers or insecure contexts
 * @param {string} text - The text to copy to clipboard
 * @returns {Promise<boolean>} Promise that resolves to true if successful, false otherwise
 */
export async function copyToClipboard(text) {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fall back to legacy method if modern API fails
            return fallbackCopyToClipboard(text);
        }
    } else {
        // Use fallback method if modern API is not available
        return fallbackCopyToClipboard(text);
    }
}

/**
 * Fallback method using deprecated document.execCommand for older browsers
 * @param {string} text - The text to copy to clipboard
 * @returns {boolean} True if successful, false otherwise
 */
function fallbackCopyToClipboard(text) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        return successful;
    } catch (err) {
        console.error('Fallback clipboard copy failed:', err);
        return false;
    }
}
