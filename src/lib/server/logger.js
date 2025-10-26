/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';

/**
 * Simple file logger for production debugging
 * Writes logs to both console and a rotating log file
 */
class Logger {
    constructor() {
        this.logsDir = process.env.LOGS_DIR || '/app/logs';
        this.logFile = path.join(this.logsDir, 'app.log');
        this.maxLogSize = 10 * 1024 * 1024; // 10MB
        this.ensureLogDir();
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
        const message = this.formatMessage('INFO', ...args);
        console.log(...args);
        this.writeToFile(message);
    }

    error(...args) {
        const message = this.formatMessage('ERROR', ...args);
        console.error(...args);
        this.writeToFile(message);
    }

    warn(...args) {
        const message = this.formatMessage('WARN', ...args);
        console.warn(...args);
        this.writeToFile(message);
    }

    info(...args) {
        const message = this.formatMessage('INFO', ...args);
        console.info(...args);
        this.writeToFile(message);
    }

    debug(...args) {
        if (process.env.NODE_ENV === 'development') {
            const message = this.formatMessage('DEBUG', ...args);
            console.debug(...args);
            this.writeToFile(message);
        }
    }
}

export const logger = new Logger();
