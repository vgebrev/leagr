import { getLeagueId } from '$lib/client/services/api-client.svelte.js';

function keyFor(leagueId, date) {
    return `${leagueId || 'default'}/${date}/ownedPlayers`;
}

export function markOwned(date, playerName) {
    if (typeof window === 'undefined') return;
    try {
        const leagueId = getLeagueId();
        const key = keyFor(leagueId, date);
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        if (!current.includes(playerName)) {
            current.push(playerName);
            localStorage.setItem(key, JSON.stringify(current));
        }
    } catch {
        return false;
    }
}

export function ownsPlayer(date, playerName) {
    if (typeof window === 'undefined') return false;
    try {
        const leagueId = getLeagueId();
        const key = keyFor(leagueId, date);
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        return current.includes(playerName);
    } catch {
        return false;
    }
}
