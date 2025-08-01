import path from 'path';
import fs from 'fs/promises';
import { isObject } from '$lib/shared/helpers.js';
import { Mutex } from 'async-mutex';
import { getLeagueDataPath } from './league.js';

const mutexes = new Map();

/**
 * Returns a mutex for the given filename
 * @param filename
 * @returns {any}
 */
function getMutex(filename) {
    if (!mutexes.has(filename)) {
        mutexes.set(filename, new Mutex());
    }
    return mutexes.get(filename);
}

/**
 * Resolves a path in an object and returns the parent object and the final key.
 * This is useful for setting or getting nested properties in an object.
 * If the path does not exist, it initialises the parent object with a default value.
 * @param obj
 * @param path
 * @param defaultValue
 * @returns {{parent, key: *}}
 */
function resolvePath(obj, path, defaultValue = {}) {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = defaultValue;
        current = current[parts[i]];
    }
    return { parent: current, key: parts[parts.length - 1] };
}

/**
 * Gets a value from the JSON file for a given key and date.
 * If the file does not exist or the key is not found, it returns null.
 * @param key
 * @param date
 * @param {string | null} leagueId
 * @returns {Promise<*|null>}
 */
async function get(key, date, leagueId = null) {
    const filename = date?.match(/^\d{4}-\d{2}-\d{2}/) ? date : null;
    if (!filename) {
        console.warn(`${date} is not a valid date`);
        return null;
    }

    const dataPath = getLeagueDataPath(leagueId);
    const filePath = path.join(dataPath, `${filename}.json`);
    const mutex = getMutex(filePath);

    return await mutex.runExclusive(async () => {
        try {
            const file = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(file);
            const { parent, key: finalKey } = resolvePath(data, key);
            return parent[finalKey];
        } catch (err) {
            console.error('Error reading file:', err);
            return null;
        }
    });
}

/**
 * Sets a value in the JSON file for a given key and date.
 * @param key
 * @param date
 * @param value
 * @param {[]|{}|number}defaultValue
 * @param {boolean} [overwrite=false] - Whether to overwrite the existing value if it exists (true), or merge/add to it (false).
 * @param {string|null} [leagueId=null] - The league name (null for default league).
 * @returns {Promise}
 */
async function set(key, date, value, defaultValue = [], overwrite = false, leagueId = null) {
    const results = await setMany([{ key, value, defaultValue, overwrite }], date, leagueId);
    return results ? results[key] : null;
}

/**
 * Atomically sets multiple values in the JSON file for a given date.
 * @param {Array<{key: string, value: any, defaultValue?: any, overwrite?: boolean}>} operations - Array of set operations
 * @param {string} date - The date string (YYYY-MM-DD format)
 * @param {string|null} [leagueId=null] - The league name (null for default league)
 * @returns {Promise<Object>} - Object with keys as operation keys and values as the final values
 */
async function setMany(operations, date, leagueId = null) {
    const filename = date?.match(/^\d{4}-\d{2}-\d{2}/) ? date : null;
    if (!filename) {
        console.warn(`${date} is not a valid date`);
        return null;
    }

    const dataPath = getLeagueDataPath(leagueId);
    const filePath = path.join(dataPath, `${filename}.json`);
    const mutex = getMutex(filePath);

    return await mutex.runExclusive(async () => {
        try {
            let jsonData = {};
            try {
                const file = await fs.readFile(filePath, 'utf-8');
                jsonData = JSON.parse(file);
            } catch (ex) {
                console.warn(`File ${filePath} not found or empty, creating a new one.`, ex);
            }

            const results = {};

            // Apply all operations to the in-memory data
            for (const operation of operations) {
                const { key, value, defaultValue = [], overwrite = false } = operation;
                const { parent, key: finalKey } = resolvePath(jsonData, key);

                if (!parent[finalKey]) {
                    parent[finalKey] = defaultValue;
                }

                if (Array.isArray(parent[finalKey])) {
                    parent[finalKey].push(value);
                } else if (isObject(parent[finalKey])) {
                    parent[finalKey] = overwrite
                        ? { ...value }
                        : { ...(parent[finalKey] ?? {}), ...value };
                } else {
                    parent[finalKey] = value;
                }

                results[key] = parent[finalKey];
            }

            // Single atomic write for all changes
            await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2));
            return results;
        } catch (err) {
            console.error('Error writing file in setMany: ', err);
            throw err; // Re-throw to ensure failures are visible
        }
    });
}

/**
 * Removes a value from the JSON file for a given key and date.
 * If the key does not exist, it returns null.
 * If the value is an array, it removes the specified value from the array.
 * If the value is an object, it deletes the specified key from the object.
 * If the value is a primitive, it sets the key to null.
 * @param key
 * @param date
 * @param value
 * @param {string | null } leagueId
 * @returns {Promise<*|null>}
 */
async function remove(key, date, value, leagueId = null) {
    const filename = date?.match(/^\d{4}-\d{2}-\d{2}/) ? date : null;
    if (!filename) {
        console.warn(`${date} is not a valid date`);
        return null;
    }

    const dataPath = getLeagueDataPath(leagueId);
    const filePath = path.join(dataPath, `${filename}.json`);
    const mutex = getMutex(filePath);

    return await mutex.runExclusive(async () => {
        try {
            let jsonData = {};
            try {
                const file = await fs.readFile(filePath, 'utf-8');
                jsonData = JSON.parse(file);
            } catch (ex) {
                console.warn(`File ${filePath} not found or empty, creating a new one.`, ex);
            }

            const { parent, key: finalKey } = resolvePath(jsonData, key);
            if (!parent[finalKey]) {
                return null;
            }
            if (Array.isArray(parent[finalKey])) {
                parent[finalKey] = parent[finalKey].filter((item) => item !== value);
            } else if (isObject(jsonData[key])) {
                delete parent[finalKey][value];
            } else {
                parent[finalKey] = null;
            }
            await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2));
            return parent[finalKey];
        } catch (err) {
            console.error('Error writing file:', err);
            return null;
        }
    });
}

export const data = {
    get,
    set,
    setMany,
    remove
};
