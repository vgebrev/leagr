import { data } from './data.js';
import { getLeagueInfo, updateLeagueInfo } from './league.js';
import {
    getEffectiveLeagueSettings,
    DAY_LEVEL_SETTINGS,
    LEAGUE_ONLY_SETTINGS
} from '$lib/shared/defaults.js';

/**
 * Get consolidated settings for a league and date
 * Returns league defaults merged with day-specific overrides
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} leagueId - League identifier
 * @returns {Promise<Object>} - Consolidated settings object
 */
export async function getConsolidatedSettings(date, leagueId) {
    // Get league info and effective league settings (with fallback to defaultSettings)
    const leagueInfo = getLeagueInfo(leagueId);
    const leagueSettings = getEffectiveLeagueSettings(leagueInfo);

    // Get day-specific settings from daily file
    const daySettings = (await data.get('settings', date, leagueId)) || {};

    // Create the response structure with league settings as base
    const response = { ...leagueSettings };

    // Add day-specific overrides as a nested object if date is provided
    if (date) {
        // Create day overrides object with league defaults as fallback
        const dayOverrides = {};

        // For each day-level setting, use saved value or fallback to league default
        for (const settingKey of DAY_LEVEL_SETTINGS) {
            if (Object.prototype.hasOwnProperty.call(daySettings, settingKey)) {
                dayOverrides[settingKey] = daySettings[settingKey];
            } else {
                // Fallback to league setting value
                dayOverrides[settingKey] = leagueSettings[settingKey];
            }
        }

        response[date] = dayOverrides;
    }

    return response;
}

/**
 * Save settings to the appropriate location (league info.json or daily file)
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} leagueId - League identifier
 * @param {Object} settings - Settings object to save
 * @returns {Promise<Object>} - Updated consolidated settings
 */
export async function saveConsolidatedSettings(date, leagueId, settings) {
    const leagueInfo = getLeagueInfo(leagueId);
    if (!leagueInfo) {
        throw new Error('League not found');
    }

    // Separate league-level and day-level settings
    const leagueUpdates = {};
    const dayUpdates = {};

    for (const [key, value] of Object.entries(settings)) {
        // Skip the date-specific nested object for now
        if (key === date) continue;

        if (LEAGUE_ONLY_SETTINGS.includes(key)) {
            leagueUpdates[key] = value;
        } else if (DAY_LEVEL_SETTINGS.includes(key)) {
            // Day-level settings should ALWAYS be saved at league level as the default
            // This ensures league-level changes are preserved even when day overrides exist
            leagueUpdates[key] = value;
        } else {
            // Default to league level for unknown settings
            leagueUpdates[key] = value;
        }
    }

    // Handle date-specific overrides if present
    if (settings[date]) {
        for (const [key, value] of Object.entries(settings[date])) {
            if (DAY_LEVEL_SETTINGS.includes(key)) {
                dayUpdates[key] = value;
            }
        }
    }

    // Update league info if there are league-level changes
    if (Object.keys(leagueUpdates).length > 0) {
        const updatedLeagueInfo = {
            ...leagueInfo,
            settings: {
                ...leagueInfo.settings,
                ...leagueUpdates
            }
        };

        const success = updateLeagueInfo(leagueId, updatedLeagueInfo);
        if (!success) {
            throw new Error('Failed to update league settings');
        }
    }

    // Update day-specific settings if there are day-level changes
    if (Object.keys(dayUpdates).length > 0) {
        const result = await data.set('settings', date, dayUpdates, {}, true, leagueId);
        if (!result) {
            throw new Error('Failed to update day settings');
        }
    }

    // Return the updated consolidated settings
    return await getConsolidatedSettings(date, leagueId);
}
