import path from 'path';
import fs from 'fs/promises';
import { isObject } from '$lib/shared/helpers.js';
import { Mutex } from 'async-mutex';
import { getLeagueDataPath } from './league.js';

const mutexes = new Map();

function getMutex(filename) {
    if (!mutexes.has(filename)) {
        mutexes.set(filename, new Mutex());
    }
    return mutexes.get(filename);
}

function resolvePath(obj, path, defaultValue = {}) {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = defaultValue;
        current = current[parts[i]];
    }
    return { parent: current, key: parts[parts.length - 1] };
}

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
            await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2));
            return parent[finalKey];
        } catch (err) {
            console.error('Error writing file: ', err);
            return null;
        }
    });
}

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
    remove
};
