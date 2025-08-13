import { error, json } from '@sveltejs/kit';
import { createDisciplineManager, DisciplineError } from '$lib/server/discipline.js';
import { createPlayerManager, PlayerError } from '$lib/server/playerManager.js';
import { validateDateParameter } from '$lib/shared/validation.js';

export const GET = async ({ url, locals }) => {
    const dateValidation = validateDateParameter(url.searchParams);
    if (!dateValidation.isValid) {
        return error(400, dateValidation.error);
    }

    try {
        const disciplineManager = createDisciplineManager().setLeague(locals.leagueId);
        const playerManager = createPlayerManager()
            .setDate(dateValidation.date)
            .setLeague(locals.leagueId);

        // Get settings to understand suspension threshold
        const gameData = await playerManager.getData({
            players: false,
            teams: false,
            settings: true
        });

        // Get all discipline records
        const disciplineData = await disciplineManager.getAllRecords();

        // Get all players who have discipline records and construct suspension info
        const suspensionInfo = [];

        for (const [playerName, record] of Object.entries(disciplineData.players || {})) {
            const activeNoShows = record.activeNoShows || [];
            const suspensions = record.suspensions || [];

            // Filter active no-shows to only include those on or before the current date
            const relevantNoShows = activeNoShows.filter(
                (noShowDate) => noShowDate <= dateValidation.date
            );

            // Check if player has active no-shows or suspensions
            const suspensionForDate = suspensions.find((s) => s.date === dateValidation.date);
            const threshold = gameData.settings.discipline?.noShowThreshold || 2;
            const relevantNoShowCount = relevantNoShows.length;

            // Only include players with relevant discipline issues
            if (relevantNoShowCount > 0 || suspensionForDate) {
                let status;
                let statusText;

                if (suspensionForDate) {
                    status = 'suspended';
                    statusText = 'Suspended for this session';
                } else if (relevantNoShowCount >= threshold) {
                    status = 'willBeSuspended';
                    statusText = 'Pending suspension (on sign-up)';
                } else {
                    status = 'noShows';
                    const remaining = threshold - relevantNoShowCount;
                    statusText = `${remaining} more no-show${remaining === 1 ? '' : 's'} until suspension`;
                }

                suspensionInfo.push({
                    playerName,
                    activeNoShows: relevantNoShowCount,
                    threshold,
                    status,
                    statusText,
                    suspensionForDate: suspensionForDate || null
                });
            }
        }

        // Sort suspensions list by:
        // 1. Active suspensions first
        // 2. Number of active no-shows (descending)
        // 3. Player name (ascending)
        suspensionInfo.sort((a, b) => {
            // 1. Active suspensions first
            if (a.status === 'suspended' && b.status !== 'suspended') return -1;
            if (b.status === 'suspended' && a.status !== 'suspended') return 1;

            // 2. Number of active no-shows (descending)
            if (a.activeNoShows !== b.activeNoShows) {
                return b.activeNoShows - a.activeNoShows;
            }

            // 3. Player name (ascending)
            return a.playerName.localeCompare(b.playerName);
        });

        return json({
            players: suspensionInfo,
            threshold: gameData.settings.discipline?.noShowThreshold || 2,
            enabled: gameData.settings.discipline?.enabled !== false
        });
    } catch (err) {
        console.error('Error fetching discipline data:', err);
        if (err instanceof DisciplineError || err instanceof PlayerError) {
            return error(err.statusCode, err.message);
        }
        return error(500, 'Failed to fetch discipline data');
    }
};
