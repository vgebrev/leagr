import { describe, it, expect } from 'vitest';
import {
    validateAndSanitizePlayerName,
    validatePlayerNameForUI,
    isValidSubdomain,
    generateAccessCode,
    validateDateParameter,
    parseRequestBody,
    validateRequestBody,
    validateList,
    validateRequiredFields,
    validateScorers,
    validateMatchScorers,
    RESERVED_SCORER_KEYS
} from '$lib/shared/validation.js';

describe('Player Name Validation', () => {
    describe('validateAndSanitizePlayerName', () => {
        describe('valid names', () => {
            it('should accept simple ASCII names', () => {
                const result = validateAndSanitizePlayerName('John');
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe('John');
                expect(result.errors).toEqual([]);
            });

            it('should accept names with spaces', () => {
                const result = validateAndSanitizePlayerName('John Smith');
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe('John Smith');
                expect(result.errors).toEqual([]);
            });

            it('should accept names with hyphens and apostrophes', () => {
                const result = validateAndSanitizePlayerName("Mary-Jane O'Connor");
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe("Mary-Jane O'Connor");
                expect(result.errors).toEqual([]);
            });

            it('should accept Cyrillic names', () => {
                const result = validateAndSanitizePlayerName('Александр');
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe('Александр');
                expect(result.errors).toEqual([]);
            });

            it('should accept Arabic names', () => {
                const result = validateAndSanitizePlayerName('محمد');
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe('محمد');
                expect(result.errors).toEqual([]);
            });

            it('should accept Chinese names', () => {
                const result = validateAndSanitizePlayerName('李小明');
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe('李小明');
                expect(result.errors).toEqual([]);
            });

            it('should accept Japanese names', () => {
                const result = validateAndSanitizePlayerName('田中太郎');
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe('田中太郎');
                expect(result.errors).toEqual([]);
            });

            it('should accept Korean names', () => {
                const result = validateAndSanitizePlayerName('김민수');
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe('김민수');
                expect(result.errors).toEqual([]);
            });

            it('should accept Hindi names', () => {
                const result = validateAndSanitizePlayerName('राजेश');
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe('राजेश');
                expect(result.errors).toEqual([]);
            });

            it('should accept names with emojis', () => {
                const result = validateAndSanitizePlayerName('Alex ⚽');
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe('Alex ⚽');
                expect(result.errors).toEqual([]);
            });

            it('should accept names with multiple emojis', () => {
                const result = validateAndSanitizePlayerName('Sarah 🏆⚽🥅');
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe('Sarah 🏆⚽🥅');
                expect(result.errors).toEqual([]);
            });

            it('should accept accented European names', () => {
                const result = validateAndSanitizePlayerName('José María');
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe('José María');
                expect(result.errors).toEqual([]);
            });

            it('should accept numbers in names', () => {
                const result = validateAndSanitizePlayerName('Player1');
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe('Player1');
                expect(result.errors).toEqual([]);
            });

            it('should accept mixed script names', () => {
                const result = validateAndSanitizePlayerName('John 田中');
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe('John 田中');
                expect(result.errors).toEqual([]);
            });
        });

        describe('input sanitization', () => {
            it('should trim whitespace', () => {
                const result = validateAndSanitizePlayerName('  John  ');
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe('John');
                expect(result.errors).toEqual([]);
            });

            it('should normalize multiple spaces to single space', () => {
                const result = validateAndSanitizePlayerName('John    Smith');
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe('John Smith');
                expect(result.errors).toEqual([]);
            });

            it('should remove HTML tags', () => {
                const result = validateAndSanitizePlayerName('John<script>alert("xss")</script>');
                expect(result.isValid).toBe(false);
                expect(result.sanitizedName).toBe('Johnalert("xss")');
                expect(result.errors).toContain('Player name contains potentially unsafe content');
            });

            it('should remove script tags with content', () => {
                const result = validateAndSanitizePlayerName('<script>malicious</script>John');
                expect(result.isValid).toBe(false);
                expect(result.sanitizedName).toBe('maliciousJohn');
                expect(result.errors).toContain('Player name contains potentially unsafe content');
            });

            it('should remove javascript: protocol', () => {
                const result = validateAndSanitizePlayerName('javascript:alert(1)John');
                expect(result.isValid).toBe(false);
                expect(result.sanitizedName).toBe('alert(1)John');
                expect(result.errors).toContain('Player name contains potentially unsafe content');
            });

            it('should remove onclick handlers', () => {
                const result = validateAndSanitizePlayerName('John onclick=alert(1)');
                expect(result.isValid).toBe(false);
                expect(result.sanitizedName).toBe('John alert(1)');
                expect(result.errors).toContain('Player name contains potentially unsafe content');
            });

            it('should remove eval expressions', () => {
                const result = validateAndSanitizePlayerName('John eval(code)');
                expect(result.isValid).toBe(false);
                expect(result.sanitizedName).toBe('John code)');
                expect(result.errors).toContain('Player name contains potentially unsafe content');
            });

            it('should remove control characters', () => {
                const result = validateAndSanitizePlayerName('John\x00\x01\x02');
                expect(result.isValid).toBe(false);
                expect(result.sanitizedName).toBe('John');
                expect(result.errors).toContain('Player name contains invalid characters');
            });

            it('should handle mixed dangerous content', () => {
                const result = validateAndSanitizePlayerName(
                    '<script>alert(1)</script>John\x00onclick=hack'
                );
                expect(result.isValid).toBe(false);
                expect(result.sanitizedName).toBe('alert(1)Johnhack');
                expect(result.errors.length).toBeGreaterThan(0);
            });
        });

        describe('invalid inputs', () => {
            it('should reject non-string input', () => {
                const result = validateAndSanitizePlayerName(123);
                expect(result.isValid).toBe(false);
                expect(result.sanitizedName).toBe('');
                expect(result.errors).toContain('Player name must be text');
            });

            it('should reject null input', () => {
                const result = validateAndSanitizePlayerName(null);
                expect(result.isValid).toBe(false);
                expect(result.sanitizedName).toBe('');
                expect(result.errors).toContain('Player name must be text');
            });

            it('should reject undefined input', () => {
                const result = validateAndSanitizePlayerName(undefined);
                expect(result.isValid).toBe(false);
                expect(result.sanitizedName).toBe('');
                expect(result.errors).toContain('Player name must be text');
            });

            it('should reject empty string', () => {
                const result = validateAndSanitizePlayerName('');
                expect(result.isValid).toBe(false);
                expect(result.sanitizedName).toBe('');
                expect(result.errors).toContain('Player name cannot be empty');
            });

            it('should reject whitespace-only string', () => {
                const result = validateAndSanitizePlayerName('   ');
                expect(result.isValid).toBe(false);
                expect(result.sanitizedName).toBe('');
                expect(result.errors).toContain('Player name cannot be empty');
            });

            it('should reject names with only punctuation', () => {
                const result = validateAndSanitizePlayerName('---...__');
                expect(result.isValid).toBe(false);
                expect(result.sanitizedName).toBe('---...__');
                expect(result.errors).toContain(
                    'Player name must contain letters, numbers, or meaningful characters'
                );
            });

            it('should reject names that become empty after sanitization', () => {
                const result = validateAndSanitizePlayerName('<script></script>');
                expect(result.isValid).toBe(false);
                expect(result.sanitizedName).toBe('');
                expect(result.errors).toContain('Player name contains only invalid characters');
            });
        });

        describe('length validation', () => {
            it('should accept names at maximum length (100 chars)', () => {
                const longName = 'A'.repeat(100);
                const result = validateAndSanitizePlayerName(longName);
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe(longName);
                expect(result.errors).toEqual([]);
            });

            it('should truncate names over maximum length', () => {
                const tooLongName = 'A'.repeat(101);
                const result = validateAndSanitizePlayerName(tooLongName);
                expect(result.isValid).toBe(false);
                expect(result.sanitizedName).toBe('A'.repeat(100));
                expect(result.errors).toContain('Player name cannot exceed 100 characters');
            });

            it('should handle Unicode names near length limit', () => {
                // Unicode characters can be multiple bytes
                const unicodeName = '🏆'.repeat(50); // 50 trophies = 100 characters in JS
                const result = validateAndSanitizePlayerName(unicodeName);
                expect(result.isValid).toBe(true);
                expect(result.sanitizedName).toBe(unicodeName);
            });
        });
    });

    describe('validatePlayerNameForUI', () => {
        it('should return UI-friendly format for valid names', () => {
            const result = validatePlayerNameForUI('John');
            expect(result.isValid).toBe(true);
            expect(result.sanitizedName).toBe('John');
            expect(result.errorMessage).toBe('');
        });

        it('should return first error for invalid names', () => {
            const result = validatePlayerNameForUI('');
            expect(result.isValid).toBe(false);
            expect(result.sanitizedName).toBe('');
            expect(result.errorMessage).toBe('Player name cannot be empty');
        });

        it('should return first error for multiple issues', () => {
            const result = validatePlayerNameForUI('<script>alert(1)</script>'.repeat(10));
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toMatch(
                /(Player name cannot exceed 100 characters|Player name contains potentially unsafe content)/
            );
        });

        it('should handle sanitization for UI', () => {
            const result = validatePlayerNameForUI('  John  ');
            expect(result.isValid).toBe(true);
            expect(result.sanitizedName).toBe('John');
            expect(result.errorMessage).toBe('');
        });
    });

    describe('edge cases', () => {
        it('should handle very long Unicode names gracefully', () => {
            const longUnicodeName = '田中'.repeat(100); // Much longer than 100 chars
            const result = validateAndSanitizePlayerName(longUnicodeName);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Player name cannot exceed 100 characters');
        });

        it('should handle mixed valid and invalid content', () => {
            const mixedName = 'John<script>alert(1)</script>Smith';
            const result = validateAndSanitizePlayerName(mixedName);
            expect(result.isValid).toBe(false);
            expect(result.sanitizedName).toBe('Johnalert(1)Smith');
            expect(result.errors).toContain('Player name contains potentially unsafe content');
        });

        it('should preserve legitimate special characters while removing dangerous ones', () => {
            const name = "José-María O'Connor"; // legitimate special chars
            const result = validateAndSanitizePlayerName(name);
            expect(result.isValid).toBe(true);
            expect(result.sanitizedName).toBe(name);
        });

        it('should handle names with tabs and newlines', () => {
            const nameWithWhitespace = 'John\t\nSmith';
            const result = validateAndSanitizePlayerName(nameWithWhitespace);
            expect(result.isValid).toBe(true);
            expect(result.sanitizedName).toBe('John Smith'); // normalized whitespace
        });
    });

    describe('security tests', () => {
        const dangerousInputs = [
            '<img src=x onerror=alert(1)>',
            'javascript:alert(document.cookie)',
            '<svg onload=alert(1)>',
            'expression(alert(1))',
            'eval(String.fromCharCode(97,108,101,114,116,40,49,41))',
            '<iframe src=javascript:alert(1)>',
            '<object data=javascript:alert(1)>',
            '<embed src=javascript:alert(1)>',
            '<link rel=stylesheet href=javascript:alert(1)>',
            '<meta http-equiv=refresh content=0;url=javascript:alert(1)>'
        ];

        dangerousInputs.forEach((dangerousInput, index) => {
            it(`should sanitize dangerous input ${index + 1}: ${dangerousInput.substring(0, 30)}...`, () => {
                const result = validateAndSanitizePlayerName(dangerousInput);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Player name contains potentially unsafe content');
                // Should not contain the original dangerous content
                expect(result.sanitizedName).not.toContain('<script');
                expect(result.sanitizedName).not.toContain('javascript:');
                expect(result.sanitizedName).not.toContain('onerror=');
                expect(result.sanitizedName).not.toContain('onload=');
            });
        });
    });
});

describe('Other Validation Functions', () => {
    describe('isValidSubdomain', () => {
        it('should accept valid subdomains', () => {
            expect(isValidSubdomain('abc')).toBe(true);
            expect(isValidSubdomain('my-league')).toBe(true);
            expect(isValidSubdomain('league123')).toBe(true);
        });

        it('should reject invalid subdomains', () => {
            expect(isValidSubdomain('')).toBe(false);
            expect(isValidSubdomain('ab')).toBe(false); // too short
            expect(isValidSubdomain('-abc')).toBe(false); // starts with hyphen
            expect(isValidSubdomain('abc-')).toBe(false); // ends with hyphen
        });
    });

    describe('generateAccessCode', () => {
        it('should generate properly formatted access codes', () => {
            const code = generateAccessCode();
            expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
        });

        it('should generate unique codes', () => {
            const codes = new Set();
            for (let i = 0; i < 100; i++) {
                codes.add(generateAccessCode());
            }
            expect(codes.size).toBe(100); // All should be unique
        });
    });
});

describe('API Validation Functions', () => {
    describe('validateDateParameter', () => {
        it('should accept valid date parameter', () => {
            const searchParams = new URLSearchParams('date=2024-01-15');
            const result = validateDateParameter(searchParams);
            expect(result.isValid).toBe(true);
            expect(result.date).toBe('2024-01-15');
            expect(result.error).toBe('');
        });

        it('should reject missing date parameter', () => {
            const searchParams = new URLSearchParams('');
            const result = validateDateParameter(searchParams);
            expect(result.isValid).toBe(false);
            expect(result.date).toBe(null);
            expect(result.error).toBe('Date parameter is required');
        });

        it('should handle empty date parameter', () => {
            const searchParams = new URLSearchParams('date=');
            const result = validateDateParameter(searchParams);
            expect(result.isValid).toBe(false);
            expect(result.date).toBe(null);
            expect(result.error).toBe('Date parameter is required');
        });
    });

    describe('parseRequestBody', () => {
        // Mock Request objects for testing
        const createMockRequest = (body) => ({
            json: async () => {
                if (body === 'invalid-json') {
                    throw new Error('Invalid JSON');
                }
                return body;
            }
        });

        it('should parse valid JSON body', async () => {
            const mockRequest = createMockRequest({ name: 'John', age: 30 });
            const result = await parseRequestBody(mockRequest);
            expect(result.isValid).toBe(true);
            expect(result.data).toEqual({ name: 'John', age: 30 });
            expect(result.error).toBe('');
        });

        it('should reject invalid JSON', async () => {
            const mockRequest = createMockRequest('invalid-json');
            const result = await parseRequestBody(mockRequest);
            expect(result.isValid).toBe(false);
            expect(result.data).toBe(null);
            expect(result.error).toBe('Invalid JSON payload');
        });

        it('should reject null body', async () => {
            const mockRequest = createMockRequest(null);
            const result = await parseRequestBody(mockRequest);
            expect(result.isValid).toBe(false);
            expect(result.data).toBe(null);
            expect(result.error).toBe('Request body must be a valid JSON object');
        });

        it('should reject non-object body', async () => {
            const mockRequest = createMockRequest('just a string');
            const result = await parseRequestBody(mockRequest);
            expect(result.isValid).toBe(false);
            expect(result.data).toBe(null);
            expect(result.error).toBe('Request body must be a valid JSON object');
        });
    });

    describe('validateRequestBody', () => {
        it('should accept valid body with all required fields', () => {
            const body = { playerName: 'John', list: 'available' };
            const result = validateRequestBody(body, ['playerName', 'list']);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should reject missing required fields', () => {
            const body = { playerName: 'John' };
            const result = validateRequestBody(body, ['playerName', 'list']);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Missing required field: list');
        });

        it('should reject null values in required fields', () => {
            const body = { playerName: null, list: 'available' };
            const result = validateRequestBody(body, ['playerName', 'list']);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Missing required field: playerName');
        });

        it('should reject undefined values in required fields', () => {
            const body = { playerName: undefined, list: 'available' };
            const result = validateRequestBody(body, ['playerName', 'list']);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Missing required field: playerName');
        });

        it('should accept empty required fields array', () => {
            const body = { playerName: 'John' };
            const result = validateRequestBody(body, []);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should reject null body', () => {
            const result = validateRequestBody(null, ['playerName']);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Request body must be a valid JSON object');
        });
    });

    describe('validateList', () => {
        it('should accept valid list values', () => {
            expect(validateList('available').isValid).toBe(true);
            expect(validateList('waitingList').isValid).toBe(true);
        });

        it('should reject invalid list values', () => {
            const result = validateList('invalid');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('List must be one of: available, waitingList');
        });

        it('should reject non-string values', () => {
            const result = validateList(123);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('List must be a string');
        });

        it('should reject null values', () => {
            const result = validateList(null);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('List must be a string');
        });
    });

    describe('validateRequiredFields', () => {
        it('should accept data with all required fields', () => {
            const data = { name: 'John', email: 'john@example.com' };
            const result = validateRequiredFields(data, ['name', 'email']);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should reject missing fields', () => {
            const data = { name: 'John' };
            const result = validateRequiredFields(data, ['name', 'email']);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('email is required');
        });

        it('should reject null values', () => {
            const data = { name: null, email: 'john@example.com' };
            const result = validateRequiredFields(data, ['name', 'email']);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('name is required');
        });

        it('should reject empty string values', () => {
            const data = { name: '   ', email: 'john@example.com' };
            const result = validateRequiredFields(data, ['name', 'email']);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('name is required');
        });

        it('should accept empty required fields array', () => {
            const data = { name: 'John' };
            const result = validateRequiredFields(data, []);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should reject null data', () => {
            const result = validateRequiredFields(null, ['name']);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Data must be a valid object');
        });
    });
});

describe('Scorer Validation', () => {
    describe('validateScorers', () => {
        const teamPlayers = ['Veli', 'Dan', 'Chris', 'Bobinho'];

        describe('valid scorer data', () => {
            it('should accept null scorers (optional field)', () => {
                const result = validateScorers(null, 3, teamPlayers);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should accept undefined scorers (optional field)', () => {
                const result = validateScorers(undefined, 3, teamPlayers);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should accept valid scorer assignment', () => {
                const scorers = { Veli: 2, Dan: 1 };
                const result = validateScorers(scorers, 3, teamPlayers);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should accept partial goal assignment', () => {
                const scorers = { Veli: 1 };
                const result = validateScorers(scorers, 3, teamPlayers);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should accept all goals assigned to one player', () => {
                const scorers = { Veli: 5 };
                const result = validateScorers(scorers, 5, teamPlayers);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should accept own goals with reserved key', () => {
                const scorers = { Veli: 2, [RESERVED_SCORER_KEYS.OWN_GOAL]: 1 };
                const result = validateScorers(scorers, 3, teamPlayers);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should accept only own goals', () => {
                const scorers = { [RESERVED_SCORER_KEYS.OWN_GOAL]: 1 };
                const result = validateScorers(scorers, 1, teamPlayers);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should accept empty scorers object with null score', () => {
                const scorers = {};
                const result = validateScorers(scorers, null, teamPlayers);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should accept multiple players scoring', () => {
                const scorers = { Veli: 1, Dan: 1, Chris: 1, Bobinho: 2 };
                const result = validateScorers(scorers, 5, teamPlayers);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should accept maximum allowed own goals (2)', () => {
                const scorers = { [RESERVED_SCORER_KEYS.OWN_GOAL]: 2 };
                const result = validateScorers(scorers, 2, teamPlayers);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });
        });

        describe('invalid scorer data', () => {
            it('should reject non-object scorers', () => {
                const result = validateScorers('invalid', 3, teamPlayers);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain(
                    'Scorers must be an object mapping player names to goal counts'
                );
            });

            it('should reject array scorers', () => {
                const result = validateScorers(['Veli', 'Dan'], 3, teamPlayers);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain(
                    'Scorers must be an object mapping player names to goal counts'
                );
            });

            it('should reject scorers when score is null', () => {
                const scorers = { Veli: 1 };
                const result = validateScorers(scorers, null, teamPlayers);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Cannot assign scorers when score is not set');
            });

            it('should reject scorers when score is undefined', () => {
                const scorers = { Veli: 1 };
                const result = validateScorers(scorers, undefined, teamPlayers);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Cannot assign scorers when score is not set');
            });

            it('should reject total assigned goals exceeding score', () => {
                const scorers = { Veli: 2, Dan: 2 };
                const result = validateScorers(scorers, 3, teamPlayers);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Total assigned goals (4) exceeds team score (3)');
            });

            it('should reject player not on team', () => {
                const scorers = { 'Unknown Player': 1 };
                const result = validateScorers(scorers, 1, teamPlayers);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Unknown Player is not on this team');
            });

            it('should reject negative goal counts', () => {
                const scorers = { Veli: -1 };
                const result = validateScorers(scorers, 3, teamPlayers);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Invalid goal count for Veli: cannot be negative');
            });

            it('should reject zero goal counts', () => {
                const scorers = { Veli: 0 };
                const result = validateScorers(scorers, 3, teamPlayers);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain(
                    'Invalid goal count for Veli: use 0 goals by not including the player'
                );
            });

            it('should reject non-integer goal counts', () => {
                const scorers = { Veli: 1.5 };
                const result = validateScorers(scorers, 3, teamPlayers);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Invalid goal count for Veli: must be an integer');
            });

            it('should reject string goal counts', () => {
                const scorers = { Veli: '2' };
                const result = validateScorers(scorers, 3, teamPlayers);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Invalid goal count for Veli: must be an integer');
            });

            it('should reject excessive own goals (>2)', () => {
                const scorers = { [RESERVED_SCORER_KEYS.OWN_GOAL]: 3 };
                const result = validateScorers(scorers, 3, teamPlayers);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain(
                    'Own goal count seems unusually high (3). Maximum allowed: 2'
                );
            });
        });

        describe('edge cases', () => {
            it('should handle empty team players array', () => {
                const scorers = { Veli: 1 };
                const result = validateScorers(scorers, 1, []);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Veli is not on this team');
            });

            it('should handle missing team players array', () => {
                const scorers = { Veli: 1 };
                const result = validateScorers(scorers, 1, null);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Team players array is required for validation');
            });

            it('should handle multiple validation errors', () => {
                const scorers = { Unknown: 2, Veli: 3 };
                const result = validateScorers(scorers, 3, teamPlayers);
                expect(result.isValid).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);
                expect(result.errors).toContain('Unknown is not on this team');
                expect(result.errors).toContain('Total assigned goals (5) exceeds team score (3)');
            });

            it('should accept empty scorers object with positive score', () => {
                const scorers = {};
                const result = validateScorers(scorers, 3, teamPlayers);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should handle own goals and regular goals together', () => {
                const scorers = { Veli: 1, Dan: 1, [RESERVED_SCORER_KEYS.OWN_GOAL]: 1 };
                const result = validateScorers(scorers, 3, teamPlayers);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should calculate total correctly with own goals', () => {
                const scorers = { Veli: 2, [RESERVED_SCORER_KEYS.OWN_GOAL]: 2 };
                const result = validateScorers(scorers, 3, teamPlayers);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Total assigned goals (4) exceeds team score (3)');
            });
        });
    });

    describe('validateMatchScorers', () => {
        const teams = {
            'blue quakes': ['Veli', 'Dan', 'Chris'],
            'green wasps': ['Bobinho', 'Tinashe', 'Brent'],
            'orange chasers': ['Mandisi', 'Jonathen', 'Lunathi']
        };

        describe('valid match scorer data', () => {
            it('should accept match without scorers', () => {
                const match = {
                    home: 'blue quakes',
                    away: 'green wasps',
                    homeScore: 2,
                    awayScore: 1
                };
                const result = validateMatchScorers(match, teams);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should accept valid home scorers', () => {
                const match = {
                    home: 'blue quakes',
                    away: 'green wasps',
                    homeScore: 2,
                    awayScore: 1,
                    homeScorers: { Veli: 2 }
                };
                const result = validateMatchScorers(match, teams);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should accept valid away scorers', () => {
                const match = {
                    home: 'blue quakes',
                    away: 'green wasps',
                    homeScore: 2,
                    awayScore: 1,
                    awayScorers: { Bobinho: 1 }
                };
                const result = validateMatchScorers(match, teams);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should accept both home and away scorers', () => {
                const match = {
                    home: 'blue quakes',
                    away: 'green wasps',
                    homeScore: 2,
                    awayScore: 1,
                    homeScorers: { Veli: 1, Dan: 1 },
                    awayScorers: { Bobinho: 1 }
                };
                const result = validateMatchScorers(match, teams);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should accept scorers with own goals', () => {
                const match = {
                    home: 'blue quakes',
                    away: 'green wasps',
                    homeScore: 3,
                    awayScore: 1,
                    homeScorers: { Veli: 2, [RESERVED_SCORER_KEYS.OWN_GOAL]: 1 },
                    awayScorers: { Bobinho: 1 }
                };
                const result = validateMatchScorers(match, teams);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should skip bye matches', () => {
                const match = {
                    bye: 'blue quakes',
                    homeScorers: { invalid: 1 }
                };
                const result = validateMatchScorers(match, teams);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should accept null scorers explicitly', () => {
                const match = {
                    home: 'blue quakes',
                    away: 'green wasps',
                    homeScore: 2,
                    awayScore: 1,
                    homeScorers: null,
                    awayScorers: null
                };
                const result = validateMatchScorers(match, teams);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });
        });

        describe('invalid match scorer data', () => {
            it('should reject invalid match object', () => {
                const result = validateMatchScorers(null, teams);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Match must be a valid object');
            });

            it('should reject invalid home scorers', () => {
                const match = {
                    home: 'blue quakes',
                    away: 'green wasps',
                    homeScore: 2,
                    awayScore: 1,
                    homeScorers: { Veli: 5 } // Exceeds score
                };
                const result = validateMatchScorers(match, teams);
                expect(result.isValid).toBe(false);
                expect(result.errors[0]).toContain('Home team (blue quakes):');
                expect(result.errors[0]).toContain('exceeds team score');
            });

            it('should reject invalid away scorers', () => {
                const match = {
                    home: 'blue quakes',
                    away: 'green wasps',
                    homeScore: 2,
                    awayScore: 1,
                    awayScorers: { Veli: 1 } // Wrong team
                };
                const result = validateMatchScorers(match, teams);
                expect(result.isValid).toBe(false);
                expect(result.errors[0]).toContain('Away team (green wasps):');
                expect(result.errors[0]).toContain('Veli is not on this team');
            });

            it('should reject player from wrong team in home scorers', () => {
                const match = {
                    home: 'blue quakes',
                    away: 'green wasps',
                    homeScore: 2,
                    awayScore: 1,
                    homeScorers: { Bobinho: 2 } // Bobinho is on green wasps
                };
                const result = validateMatchScorers(match, teams);
                expect(result.isValid).toBe(false);
                expect(result.errors[0]).toContain('Bobinho is not on this team');
            });

            it('should reject both invalid home and away scorers', () => {
                const match = {
                    home: 'blue quakes',
                    away: 'green wasps',
                    homeScore: 2,
                    awayScore: 1,
                    homeScorers: { Veli: 5 },
                    awayScorers: { Dan: 1 }
                };
                const result = validateMatchScorers(match, teams);
                expect(result.isValid).toBe(false);
                expect(result.errors.length).toBe(2);
                expect(result.errors[0]).toContain('Home team');
                expect(result.errors[1]).toContain('Away team');
            });
        });

        describe('edge cases', () => {
            it('should handle missing teams object gracefully', () => {
                const match = {
                    home: 'blue quakes',
                    away: 'green wasps',
                    homeScore: 2,
                    awayScore: 1,
                    homeScorers: { Veli: 2 }
                };
                const result = validateMatchScorers(match, null);
                expect(result.isValid).toBe(false);
                // When teams object is null, teams?.[match.home] returns undefined which becomes []
                // so the error is "player is not on this team" rather than "array is required"
                expect(result.errors[0]).toContain('Veli is not on this team');
            });

            it('should handle team not in teams object', () => {
                const match = {
                    home: 'unknown team',
                    away: 'green wasps',
                    homeScore: 2,
                    awayScore: 1,
                    homeScorers: { Veli: 2 }
                };
                const result = validateMatchScorers(match, teams);
                expect(result.isValid).toBe(false);
                expect(result.errors[0]).toContain('Veli is not on this team');
            });

            it('should handle undefined scorers (should pass)', () => {
                const match = {
                    home: 'blue quakes',
                    away: 'green wasps',
                    homeScore: 2,
                    awayScore: 1
                    // homeScorers and awayScorers are undefined
                };
                const result = validateMatchScorers(match, teams);
                expect(result.isValid).toBe(true);
                expect(result.errors).toEqual([]);
            });

            it('should provide clear error context for home team', () => {
                const match = {
                    home: 'blue quakes',
                    away: 'green wasps',
                    homeScore: 1,
                    awayScore: 1,
                    homeScorers: { Veli: -1 }
                };
                const result = validateMatchScorers(match, teams);
                expect(result.isValid).toBe(false);
                expect(result.errors[0]).toMatch(/Home team \(blue quakes\):/);
            });

            it('should provide clear error context for away team', () => {
                const match = {
                    home: 'blue quakes',
                    away: 'green wasps',
                    homeScore: 1,
                    awayScore: 1,
                    awayScorers: { Bobinho: 2 }
                };
                const result = validateMatchScorers(match, teams);
                expect(result.isValid).toBe(false);
                expect(result.errors[0]).toMatch(/Away team \(green wasps\):/);
            });
        });
    });
});
