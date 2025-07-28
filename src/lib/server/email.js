import Mailgun from 'mailgun.js';
import FormData from 'form-data';

/** @type {any|null} */
let mailgun = null;
/** @type {string|null} */
let mailgunDomain = null;
/** @type {string|null} */
let appUrl = null;

/**
 * Initialise the email service with configuration from hooks.server.js
 * @param {string} apiKey - Mailgun API key
 * @param {string} domain - Mailgun domain
 * @param {string} appUrlConfig - App URL for generating reset links
 */
export function initializeEmailService(apiKey, domain, appUrlConfig) {
    if (apiKey && domain) {
        const mg = new Mailgun(FormData);
        mailgun = mg.client({
            username: 'api',
            key: apiKey
        });
        mailgunDomain = domain;
        appUrl = appUrlConfig;
    }
}

/**
 * Send an access code reset email to the league owner
 * @param {string} ownerEmail - The email address of the league owner
 * @param {string} leagueId - The league identifier
 * @param {string} leagueName - The name of the league
 * @param {string} resetCode - The reset code for access code recovery
 * @returns {Promise<boolean>} - Success status
 */
export async function sendAccessCodeResetEmail(ownerEmail, leagueId, leagueName, resetCode) {
    if (!mailgun || !mailgunDomain || !appUrl) {
        console.error('Email service not initialized. Call initializeEmailService() first.');
        return false;
    }

    try {
        const appUrlObj = new URL(appUrl);
        const resetUrl = `${appUrlObj.protocol}//${leagueId}.${appUrlObj.hostname}${appUrlObj.port ? ':' + appUrlObj.port : ''}/auth/reset?code=${resetCode}`;

        const messageData = {
            from: `Leagr <noreply@${mailgunDomain}>`,
            to: ownerEmail,
            subject: `Reset Your "${leagueName}" Access Code`,
            html: `
                <h3>Reset Your Access Code</h3>
                <p>You have requested to reset the access code for your league: <strong>${leagueName}</strong></p>
                <p>Click the link below to set a new access code:</p>
                <p><a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Access Code</a></p>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this reset, please ignore this email.</p>
                <hr>
                <p><small>This is an automated message from Leagr. Please do not reply to this email.</small></p>
            `,
            text: `
Reset Your Access Code

You have requested to reset the access code for your league: ${leagueName}

Click the link below to set a new access code:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this reset, please ignore this email.

This is an automated message from Leagr. Please do not reply to this email.
            `
        };

        await mailgun.messages.create(mailgunDomain, messageData);
        return true;
    } catch (error) {
        console.error('Failed to send access code reset email:', error);
        return false;
    }
}
