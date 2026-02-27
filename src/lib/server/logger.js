/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Simple file logger for production debugging
 * Writes logs to both console and a rotating log file
 */
class Logger {
    #minLevel = LEVELS.info;

    constructor() {
        // Use project logs directory in development
        this.logsDir =
            process.env.LOGS_DIR || (process.env.NODE_ENV === 'production' ? '/app/logs' : 'logs');
        this.logFile = path.join(this.logsDir, 'app.log');
        this.maxLogSize = 10 * 1024 * 1024; // 10MB
        this.ensureLogDir();
    }

    /**
     * Set the minimum log level. Messages below this level are silently dropped.
     * @param {string} level - 'debug' | 'info' | 'warn' | 'error'
     */
    initialize(level) {
        const normalised = level?.toLowerCase();
        if (normalised && normalised in LEVELS) {
            this.#minLevel = LEVELS[normalised];
        }
    }

    #shouldLog(level) {
        return LEVELS[level] >= this.#minLevel;
    }

    ensureLogDir() {
        try {
            if (!fs.existsSync(this.logsDir)) {
                fs.mkdirSync(this.logsDir, { recursive: true });
            }
        } catch (err) {
            // If we can't create log dir, just use console
            console.error('Failed to create logs directory:', err);
        }
    }

    formatMessage(level, ...args) {
        const timestamp = new Date().toISOString();
        const message = args
            .map((arg) => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch {
                        return String(arg);
                    }
                }
                return String(arg);
            })
            .join(' ');
        return `[${timestamp}] [${level}] ${message}\n`;
    }

    writeToFile(message) {
        try {
            // Check file size and rotate if needed
            if (fs.existsSync(this.logFile)) {
                const stats = fs.statSync(this.logFile);
                if (stats.size > this.maxLogSize) {
                    const rotatedFile = `${this.logFile}.${Date.now()}`;
                    fs.renameSync(this.logFile, rotatedFile);

                    // Keep only last 5 rotated logs
                    const files = fs
                        .readdirSync(this.logsDir)
                        .filter((f) => f.startsWith('app.log.'))
                        .sort()
                        .reverse();

                    if (files.length > 5) {
                        files.slice(5).forEach((f) => {
                            fs.unlinkSync(path.join(this.logsDir, f));
                        });
                    }
                }
            }

            fs.appendFileSync(this.logFile, message);
        } catch (err) {
            // If file write fails, at least we have console
            console.error('Failed to write to log file:', err);
        }
    }

    log(...args) {
        if (!this.#shouldLog('info')) return;
        const message = this.formatMessage('INFO', ...args);
        console.log(...args);
        this.writeToFile(message);
    }

    error(...args) {
        if (!this.#shouldLog('error')) return;
        const message = this.formatMessage('ERROR', ...args);
        console.error(...args);
        this.writeToFile(message);
    }

    warn(...args) {
        if (!this.#shouldLog('warn')) return;
        const message = this.formatMessage('WARN', ...args);
        console.warn(...args);
        this.writeToFile(message);
    }

    info(...args) {
        if (!this.#shouldLog('info')) return;
        const message = this.formatMessage('INFO', ...args);
        console.info(...args);
        this.writeToFile(message);
    }

    debug(...args) {
        if (!this.#shouldLog('debug')) return;
        const message = this.formatMessage('DEBUG', ...args);
        console.debug(...args);
        this.writeToFile(message);
    }
}

export const logger = new Logger();

/**
 * Configure the logger minimum level from an environment variable value.
 * Call this from hooks.server.js so the env var is resolved at request time
 * rather than at module initialisation (where Vite may not have injected it yet).
 * @param {string | undefined} level - Value of LOG_LEVEL env var
 */
export function initializeLogger(level) {
    logger.initialize(level);
}
