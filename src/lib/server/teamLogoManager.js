import path from 'path';
import fs from 'fs/promises';
import { Mutex } from 'async-mutex';
import { getLeagueDataPath } from './league.js';
import { generateTeamLogo, pickBadgeShapes } from './openaiImageClient.js';
import { logger } from './logger.js';
import { env } from '$env/dynamic/private';

const logosMutexes = new Map();

/**
 * Team logo management service.
 * Owns all logo business logic: storage, retrieval, and AI generation.
 */
export class TeamLogoManager {
    constructor() {
        /** @type {string | null} */
        this.leagueId = null;
    }

    /**
     * @param {string} leagueId
     * @returns {TeamLogoManager}
     */
    setLeague(leagueId) {
        this.leagueId = leagueId;
        return this;
    }

    getDataPath() {
        if (!this.leagueId) throw new Error('League ID must be set before accessing data path');
        return getLeagueDataPath(this.leagueId);
    }

    getLogosMutex() {
        if (!this.leagueId) throw new Error('League ID must be set before accessing mutex');
        const key = `logos-${this.leagueId}`;
        if (!logosMutexes.has(key)) {
            logosMutexes.set(key, new Mutex());
        }
        return logosMutexes.get(key);
    }

    getLogosMetadataPath() {
        return path.join(this.getDataPath(), 'logos.json');
    }

    getLogosDir() {
        return path.join(this.getDataPath(), 'logos');
    }

    /**
     * Composite key from date + team name.
     * @param {string} date - YYYY-MM-DD
     * @param {string} teamName - e.g. "blue wolves"
     * @returns {string}
     */
    getLogoKey(date, teamName) {
        return `${date}_${teamName}`;
    }

    async loadLogosUnsafe() {
        try {
            const raw = await fs.readFile(this.getLogosMetadataPath(), 'utf-8');
            return JSON.parse(raw);
        } catch (err) {
            if (err.code === 'ENOENT') return {};
            throw err;
        }
    }

    async loadLogos() {
        return await this.getLogosMutex().runExclusive(() => this.loadLogosUnsafe());
    }

    async saveLogosUnsafe(logos) {
        await fs.writeFile(this.getLogosMetadataPath(), JSON.stringify(logos, null, 2));
    }

    /**
     * Check whether a logo already exists for a date + team.
     * @param {string} date
     * @param {string} teamName
     * @returns {Promise<boolean>}
     */
    async hasLogo(date, teamName) {
        const logos = await this.loadLogos();
        return !!logos[this.getLogoKey(date, teamName)];
    }

    /**
     * Get logo filename for a date + team, or null if not generated yet.
     * @param {string} date
     * @param {string} teamName
     * @returns {Promise<string | null>}
     */
    async getLogo(date, teamName) {
        const logos = await this.loadLogos();
        return logos[this.getLogoKey(date, teamName)] ?? null;
    }

    /**
     * Persist a logo image buffer and record it in the metadata.
     * @param {string} date
     * @param {string} teamName
     * @param {Buffer} buffer - Raw image bytes (PNG from OpenAI)
     * @returns {Promise<string>} Saved filename
     */
    async saveLogo(date, teamName, buffer) {
        return await this.getLogosMutex().runExclusive(async () => {
            const logos = await this.loadLogosUnsafe();
            const key = this.getLogoKey(date, teamName);

            // Clean up any previously generated logo for this key
            if (logos[key]) {
                try {
                    await fs.unlink(path.join(this.getLogosDir(), logos[key]));
                } catch {
                    // Ignore missing files
                }
            }

            await fs.mkdir(this.getLogosDir(), { recursive: true });

            const safeKey = key.replace(/[^a-z0-9_-]/gi, '_');
            const filename = `${safeKey}.webp`;
            await fs.writeFile(path.join(this.getLogosDir(), filename), buffer);

            logos[key] = filename;
            await this.saveLogosUnsafe(logos);
            return filename;
        });
    }

    /**
     * Returns a map of teamName → filename for all logos on a given date.
     * @param {string} date
     * @returns {Promise<Record<string, string>>}
     */
    async getLogosForDate(date) {
        const logos = await this.loadLogos();
        const prefix = `${date}_`;
        /** @type {Record<string, string>} */
        const result = {};
        for (const [key, filename] of Object.entries(logos)) {
            if (key.startsWith(prefix)) {
                result[key.slice(prefix.length)] = filename;
            }
        }
        return result;
    }

    /**
     * @param {string} filename
     * @returns {string}
     */
    getLogoFilePath(filename) {
        return path.join(this.getLogosDir(), filename);
    }

    /**
     * Generate logos for all teams in a draw that don't already have one.
     * Assigns a distinct random badge shape to each team.
     * Errors per team are logged and swallowed so a single failure doesn't
     * block the others.
     *
     * Intended to be called fire-and-forget from the teams POST handler.
     *
     * @param {string} date
     * @param {Record<string, string[]>} teams - { teamName: playerNames[] }
     */
    async generateLogosForDraw(date, teams) {
        const teamNames = Object.keys(teams);
        const shapes = pickBadgeShapes(teamNames.length);

        logger.info('[teamLogos] Starting logo generation', { date, teams: teamNames, shapes });

        await Promise.allSettled(
            teamNames.map(async (teamName, i) => {
                try {
                    if (await this.hasLogo(date, teamName)) {
                        logger.info('[teamLogos] Skipping, logo already exists', { teamName });
                        return;
                    }
                    const buffer = await generateTeamLogo(teamName, shapes[i], env.OPENAI_API_KEY);
                    const filename = await this.saveLogo(date, teamName, buffer);
                    logger.info('[teamLogos] Saved logo', { teamName, filename });
                } catch (err) {
                    logger.error(`[teamLogos] Failed to generate logo for "${teamName}"`, {
                        error: err.message,
                        stack: err.stack
                    });
                }
            })
        );

        logger.info('[teamLogos] Logo generation complete', { date, teams: teamNames });
    }
}

/**
 * @returns {TeamLogoManager}
 */
export function createTeamLogoManager() {
    return new TeamLogoManager();
}
