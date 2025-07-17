/**
 * Clipboard and sharing utilities with native sharing support
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

/**
 * Share content using the native Web Share API or fallback to clipboard
 * @param {Object} shareData - The data to share
 * @param {string} shareData.title - The title of the content being shared
 * @param {string} shareData.text - The text to share
 * @param {string} shareData.url - The URL to share
 * @returns {Promise<{success: boolean, method: string}>} Promise with success status and method used
 */
export async function shareContent(shareData) {
    // Check if Web Share API is available and supported
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try {
            await navigator.share(shareData);
            return { success: true, method: 'native' };
        } catch (error) {
            // User cancelled sharing or other error
            if (error.name === 'AbortError') {
                return { success: false, method: 'native', cancelled: true };
            }
            // Fall back to clipboard if sharing fails
            console.warn('Native sharing failed, falling back to clipboard:', error);
        }
    }

    // Fallback to clipboard copying
    const text = shareData.url || shareData.text;
    const success = await copyToClipboard(text);
    return { success, method: 'clipboard' };
}
