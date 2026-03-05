import { api } from '$lib/client/services/api-client.svelte.js';
import { setNotification } from '$lib/client/stores/notification.js';
import { withLoading } from '$lib/client/stores/loading.js';
import { findLeagueMatch, findKnockoutMatch, updateActionCount } from '$lib/shared/matchUtils.js';

export { findLeagueMatch, findKnockoutMatch, updateActionCount };

class GamesService {
    // League games state
    /** @type {Array<Array<Object>>} */
    schedule = $state([]);

    /** @type {number} */
    anchorIndex = $state(0);

    /** @type {number} */
    teamCount = $state(0);

    /** @type {Object} */
    teams = $state({});

    /** @type {string|null} */
    currentDate = $state(null);

    // Knockout state
    /** @type {Object|null} */
    knockoutBracket = $state(null);

    /** @type {Array} */
    standings = $state([]);

    /** @type {Array<Array<Object>>} */
    leagueGames = $state([]);

    // Derived
    hasTeams = $derived(this.teamCount > 0);
    hasSchedule = $derived(this.schedule.length > 0);
    hasStandings = $derived(this.standings.length > 0);

    // --- League games ---

    /**
     * Load league schedule and teams for a date.
     * @param {string} date
     */
    async load(date) {
        await withLoading(
            async () => {
                this.currentDate = date;
                const [gamesData, teamsData] = await Promise.all([
                    api.get('games', date),
                    api.get('teams', date)
                ]);
                this.schedule = gamesData?.rounds || [];
                this.anchorIndex = gamesData?.anchorIndex || 0;
                this.teamCount = gamesData?.teamCount || 0;
                this.teams = teamsData?.teams || {};
            },
            (err) => {
                console.error('Error fetching games data:', err);
                setNotification(
                    err.message || 'Failed to load games data. Please try again.',
                    'error'
                );
            }
        );
    }

    /**
     * Generate a new league schedule.
     */
    async generateSchedule() {
        const restoreSchedule = this.schedule;
        await withLoading(
            async () => {
                const scheduleData = await api.post('games', this.currentDate, {
                    operation: 'generate',
                    anchorIndex: Math.floor(Math.random() * this.teamCount)
                });
                this.schedule = scheduleData.rounds || [];
                this.anchorIndex = scheduleData.anchorIndex || 0;
                this.teamCount = scheduleData.teamCount || 0;
            },
            (err) => {
                console.error(err);
                setNotification(
                    err.message || 'Failed to generate schedule. Please try again.',
                    'error'
                );
                this.schedule = restoreSchedule;
            }
        );
    }

    /**
     * Add more rounds to the current schedule.
     */
    async addMoreGames() {
        const restoreSchedule = this.schedule;
        await withLoading(
            async () => {
                const gameData = await api.post('games', this.currentDate, {
                    operation: 'addMore',
                    anchorIndex: this.anchorIndex
                });
                this.schedule = gameData.rounds || [];
                this.anchorIndex = gameData.anchorIndex || this.anchorIndex;
                this.teamCount = gameData.teamCount || this.teamCount;
            },
            (err) => {
                console.error(err);
                setNotification(
                    err.message || 'Failed to add more games. Please try again.',
                    'error'
                );
                this.schedule = restoreSchedule;
            }
        );
    }

    /**
     * Update a league match and save to server. Uses optimistic update with revert on error.
     * @param {number} roundIndex - 0-based round index
     * @param {number} matchIndex - 0-based match index within round
     * @param {Object} updatedMatch - Updated match object
     */
    async updateLeagueMatch(roundIndex, matchIndex, updatedMatch) {
        const restoreSchedule = this.schedule;

        // Optimistic update
        const newSchedule = [...this.schedule];
        newSchedule[roundIndex] = [...newSchedule[roundIndex]];
        newSchedule[roundIndex][matchIndex] = updatedMatch;
        this.schedule = newSchedule;

        await withLoading(
            async () => {
                const scoreData = await api.post('games', this.currentDate, {
                    rounds: this.schedule,
                    anchorIndex: this.anchorIndex
                });
                this.schedule = scoreData.rounds || this.schedule;
                this.teamCount = scoreData.teamCount || this.teamCount;
            },
            (err) => {
                console.error(err);
                setNotification(err.message || 'Failed to save score. Please try again.', 'error');
                this.schedule = restoreSchedule;
            }
        );
    }

    // --- Knockout ---

    /**
     * Load knockout bracket, standings, teams, and league games for a date.
     * @param {string} date
     */
    async loadKnockout(date) {
        await withLoading(
            async () => {
                this.currentDate = date;
                const [standingsData, teamsData, gamesData] = await Promise.all([
                    api.get('standings', date),
                    api.get('teams', date),
                    api.get('games', date)
                ]);
                this.standings = standingsData.standings || [];
                this.teams = teamsData?.teams || {};
                this.leagueGames = gamesData?.rounds || [];

                try {
                    const knockoutData = await api.get('games/knockout', date);
                    this.knockoutBracket = knockoutData.knockoutGames;
                } catch (knockoutErr) {
                    if (knockoutErr.status !== 404) throw knockoutErr;
                    this.knockoutBracket = null;
                }
            },
            (err) => {
                console.error('Error loading knockout data:', err);
                setNotification(
                    err.message || 'Failed to load knockout data. Please try again.',
                    'error'
                );
            }
        );
    }

    /**
     * Reload knockout bracket (e.g. after a save error).
     */
    async reloadKnockout() {
        if (!this.currentDate) return;
        await withLoading(
            async () => {
                const knockoutData = await api.get('games/knockout', this.currentDate);
                this.knockoutBracket = knockoutData.knockoutGames;
            },
            () => {
                this.knockoutBracket = null;
            }
        );
    }

    /**
     * Generate or regenerate the knockout tournament.
     */
    async addKnockoutGames() {
        await withLoading(
            async () => {
                const response = await api.post('games/knockout', this.currentDate, {
                    operation: 'generate'
                });
                this.knockoutBracket = response.knockoutGames;
                setNotification('Knockout cup started!', 'success');
            },
            (err) => {
                console.error('Error generating knockout games:', err);
                setNotification(
                    err.message || 'Failed to generate knockout games. Please try again.',
                    'error'
                );
            }
        );
    }

    /**
     * Update a knockout match score and save. Uses optimistic update with reload on error.
     * @param {Object} updatedMatch - Updated match object (must have .round and .match)
     */
    async updateKnockoutMatch(updatedMatch) {
        if (!this.knockoutBracket) return;

        const updatedBracket = { ...this.knockoutBracket };
        const matchIndex = updatedBracket.bracket.findIndex(
            (m) => m.round === updatedMatch.round && m.match === updatedMatch.match
        );
        if (matchIndex === -1) return;

        updatedBracket.bracket[matchIndex] = updatedMatch;
        this.knockoutBracket = updatedBracket;

        await withLoading(
            async () => {
                const response = await api.post('games/knockout', this.currentDate, {
                    operation: 'updateScores',
                    bracket: updatedBracket.bracket
                });
                this.knockoutBracket = response.knockoutGames;
            },
            (err) => {
                console.error('Error saving knockout scores:', err);
                setNotification(
                    err.message || 'Failed to save knockout scores. Please try again.',
                    'error'
                );
                this.reloadKnockout();
            }
        );
    }

    // --- Match tracker ---

    /**
     * Load data for the match tracker page.
     * League: loads schedule + teams. Knockout: loads bracket + teams only.
     * @param {string} date
     * @param {'league'|'knockout'} competition
     */
    async loadForMatchTracker(date, competition) {
        this.currentDate = date;
        if (competition === 'league') {
            await this.load(date);
        } else {
            await withLoading(
                async () => {
                    const [knockoutData, teamsData] = await Promise.all([
                        api.get('games/knockout', date),
                        api.get('teams', date)
                    ]);
                    this.knockoutBracket = knockoutData.knockoutGames;
                    this.teams = teamsData?.teams || {};
                },
                (err) => {
                    console.error(err);
                    setNotification(err.message || 'Failed to load match data.', 'error');
                }
            );
        }
    }

    /**
     * Apply a player action (goal, offensive, or defensive) to a specific match.
     * Performs an optimistic update and saves to the server.
     * @param {'league'|'knockout'} competition
     * @param {string} roundParam - 1-indexed round number (league) or round name (knockout)
     * @param {string} matchParam - Match number as string
     * @param {'home'|'away'} team
     * @param {string} playerName
     * @param {'goals'|'offensive'|'defensive'|'saves'} mode
     * @param {number} delta - +1 or -1
     */
    async applyPlayerAction(competition, roundParam, matchParam, team, playerName, mode, delta) {
        const currentMatch =
            competition === 'league'
                ? findLeagueMatch(this.schedule, roundParam, matchParam)
                : findKnockoutMatch(this.knockoutBracket, roundParam, matchParam);

        if (!currentMatch) return;

        let updatedMatch;

        if (mode === 'goals') {
            const scorersKey = team === 'home' ? 'homeScorers' : 'awayScorers';
            const currentScorers = currentMatch[scorersKey] || {};
            const newScorers = updateActionCount(currentScorers, playerName, delta);
            const currentScore =
                team === 'home' ? currentMatch.homeScore || 0 : currentMatch.awayScore || 0;
            const newScore = Math.max(0, currentScore + delta);

            let homeScore = currentMatch.homeScore;
            let awayScore = currentMatch.awayScore;

            if (team === 'home') {
                homeScore = newScore;
                if (
                    newScore > 0 &&
                    currentMatch.homeScore === null &&
                    currentMatch.awayScore === null
                ) {
                    awayScore = 0;
                }
            } else {
                awayScore = newScore;
                if (
                    newScore > 0 &&
                    currentMatch.homeScore === null &&
                    currentMatch.awayScore === null
                ) {
                    homeScore = 0;
                }
            }

            updatedMatch = {
                ...currentMatch,
                homeScore,
                awayScore,
                [scorersKey]: newScorers
            };
        } else {
            const actionsKey =
                team === 'home'
                    ? mode === 'offensive'
                        ? 'homeOffensiveActions'
                        : mode === 'defensive'
                          ? 'homeDefensiveActions'
                          : 'homeSaveActions'
                    : mode === 'offensive'
                      ? 'awayOffensiveActions'
                      : mode === 'defensive'
                        ? 'awayDefensiveActions'
                        : 'awaySaveActions';

            updatedMatch = {
                ...currentMatch,
                [actionsKey]: updateActionCount(currentMatch[actionsKey], playerName, delta)
            };
        }

        if (competition === 'league') {
            const roundIndex = parseInt(roundParam, 10) - 1;
            const matchIndex = parseInt(matchParam, 10) - 1;
            await this.updateLeagueMatch(roundIndex, matchIndex, updatedMatch);
        } else {
            await this.updateKnockoutMatch(updatedMatch);
        }
    }
}

export const gamesService = new GamesService();
