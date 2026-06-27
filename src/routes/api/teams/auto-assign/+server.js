import { error, isHttpError, json } from '@sveltejs/kit';
import { createPlayerManager, PlayerError } from '$lib/server/playerManager.js';
import { createTeamGenerator, TeamError } from '$lib/server/teamGenerator.js';
import { createPlayerAccessControl } from '$lib/server/playerAccessControl.js';
import { buildTeamGenerationContext } from '$lib/server/teamGenerationContext.js';
import { validateLeagueForAPI } from '$lib/server/league.js';
import {
    validateDateParameter,
    parseRequestBody,
    validateAndSanitizePlayerName,
    validateCompetitionOperationsAllowed
} from '$lib/shared/validation.js';

/**
 * Balance-aware auto-assignment.
 *
 * Three modes, chosen by the request body:
 *  - { playerName }  → place that player into the best-balanced team (smallest team first).
 *  - { teamName }    → fill that team with the best-balanced available/waiting player.
 *  - {}              → "Auto-Assign All": distribute waiting-then-unassigned players evenly
 *                      across teams up to the player cap (admin only).
 */
export const POST = async ({ request, url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const dateValidation = validateDateParameter(url.searchParams);
    if (!dateValidation.isValid) {
        return error(400, dateValidation.error);
    }
    const date = dateValidation.date;

    const bodyParseResult = await parseRequestBody(request);
    if (!bodyParseResult.isValid) {
        return error(400, bodyParseResult.error);
    }

    const rawPlayerName = bodyParseResult.data.playerName ?? null;
    const teamName = bodyParseResult.data.teamName ?? null;

    // Determine mode
    const mode = rawPlayerName ? 'player' : teamName ? 'team' : 'all';

    // "Auto-Assign All" is a bulk operation touching players the requester may not own
    if (mode === 'all' && !locals.isAdmin) {
        return error(403, 'Admin access is required to auto-assign all players.');
    }

    // Validate the supplied player name (player mode)
    let playerName = null;
    if (mode === 'player') {
        const nameValidation = validateAndSanitizePlayerName(rawPlayerName);
        if (!nameValidation.isValid) {
            return error(400, `Invalid player name: ${nameValidation.errors.join(', ')}`);
        }
        playerName = nameValidation.sanitizedName;
    }

    try {
        const playerManager = createPlayerManager()
            .setDate(date)
            .setLeague(leagueId)
            .setAccessControl(
                createPlayerAccessControl().setContext(
                    date,
                    leagueId,
                    locals.clientId,
                    locals.isAdmin
                )
            );

        const gameData = await playerManager.getData({
            players: true,
            teams: true,
            settings: true
        });

        // Validate if operations are allowed based on competition end state
        const operationValidation = validateCompetitionOperationsAllowed(date, gameData.settings);
        if (!operationValidation.isValid) {
            return error(400, operationValidation.error);
        }

        const teams = gameData.teams || {};
        if (Object.keys(teams).length === 0) {
            return error(400, 'No teams have been generated yet.');
        }

        // Derive the player pools
        const teamPlayers = Object.values(teams)
            .flat()
            .filter((p) => p !== null && p !== undefined);
        const available = gameData.players?.available || [];
        const waitingList = gameData.players?.waitingList || [];
        const unassigned = available.filter((p) => !teamPlayers.includes(p));

        const maxPlayersPerTeam = gameData.settings.teamGeneration?.maxPlayersPerTeam || 7;
        const playerLimit =
            gameData.settings[date]?.playerLimit || gameData.settings.playerLimit || Infinity;
        // Waiting-list players can only join if there is room under the cap to promote them
        const canPromoteWaiting = available.length < playerLimit;

        // Build scoring context and configure the generator
        const { rankings, previousYearRankings, teammateHistory } =
            await buildTeamGenerationContext({ leagueId, date });

        const generator = createTeamGenerator()
            .setLeague(leagueId)
            .setSettings(gameData.settings)
            .setRankings(rankings)
            .setPreviousYearRankings(previousYearRankings)
            .setTeammateHistory(teammateHistory);

        if (mode === 'player') {
            const pool = [...teamPlayers, playerName];
            generator.prepareAnchors(pool);
            const team = generator.findBestTeamForPlayer(teams, playerName, { maxPlayersPerTeam });
            if (!team) {
                return error(400, 'No team has space for this player.');
            }
            await playerManager.fillEmptySlotWithPlayer(team, playerName);
        } else if (mode === 'team') {
            if (!teams[teamName]) {
                return error(404, `Team "${teamName}" not found.`);
            }
            const candidates = [...unassigned, ...(canPromoteWaiting ? waitingList : [])];
            if (candidates.length === 0) {
                return error(400, 'No available players to assign.');
            }
            generator.prepareAnchors([...teamPlayers, ...candidates]);
            const best = generator.findBestPlayerForTeam(teams, teamName, candidates);
            if (!best) {
                return error(400, 'No available players to assign.');
            }
            await playerManager.fillEmptySlotWithPlayer(teamName, best);
        } else {
            // Auto-Assign All: waiting first, then unassigned (per product decision)
            const orderedCandidates = [...waitingList, ...unassigned];
            if (orderedCandidates.length === 0) {
                return error(400, 'No players available to assign.');
            }
            generator.prepareAnchors([...teamPlayers, ...orderedCandidates]);
            const plan = generator.planAutoAssignAll(teams, orderedCandidates, {
                maxPlayersPerTeam,
                playerLimit,
                assignedCount: teamPlayers.length
            });
            if (plan.length === 0) {
                return error(400, 'Teams are already full — no players could be assigned.');
            }
            await playerManager.assignManyToTeams(
                plan.map(({ player, team }) => ({ playerName: player, teamName: team }))
            );
        }

        // Validate and clean-up any inconsistencies
        await playerManager.validateAndCleanup();

        const enhancedData = await playerManager.getAllDataWithElo();
        const ownedByMe = await playerManager.getOwnedPlayersForCurrentClient();
        return json({ ...enhancedData, ownedByMe });
    } catch (err) {
        console.error('Error auto-assigning players:', err);
        if (isHttpError(err)) {
            throw err;
        }
        if (err instanceof TeamError || err instanceof PlayerError) {
            return error(err.statusCode, err.message);
        }
        return error(500, 'Failed to auto-assign players.');
    }
};
