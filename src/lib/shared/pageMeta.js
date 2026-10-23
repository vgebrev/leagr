/**
 * Per-route page titles and share descriptions.
 *
 * Rendered by the root layout during SSR so link previews (WhatsApp, Slack, ...) - which
 * never run client JS - see the page-specific title and text, not just the league's.
 */

const ROOT_DOMAIN_NAME = 'Social League Organiser';
const ROOT_DOMAIN_DESCRIPTION =
    'Your social 5-a-side league, sorted. Player registration, balanced team draws, fixtures and standings.';

/**
 * @typedef {object} MetaContext
 * @property {string} league - League name
 * @property {Record<string, string>} params - Route params
 * @property {string} on - " on Saturday 24 October" when the link names a date, else ""
 * @property {string|null} when - "Saturday 24 October" when the link names a date, else null
 */

/** @typedef {{title: (ctx: MetaContext) => string[], description: (ctx: MetaContext) => string}} RouteMeta */

/** @type {Record<string, RouteMeta>} */
const ROUTES = {
    '/': {
        title: () => [],
        description: ({ league }) =>
            `Sign up for the next ${league} session, see the team draw and follow the table.`
    },
    '/players': {
        title: () => ['Players'],
        description: ({ league, when }) =>
            `Sign up for ${when ? `${league} on ${when}` : `the next ${league} session`}. See who's in and how many spots are left.`
    },
    '/teams': {
        title: () => ['Teams'],
        description: ({ league, on }) => `The balanced team draw for ${league}${on}.`
    },
    '/games': {
        title: () => ['Games'],
        description: ({ league, on }) => `Fixtures and results for ${league}${on}.`
    },
    '/games/match': {
        title: () => ['Match Centre', 'Games'],
        description: ({ league, on }) => `Live scores and match clock for ${league}${on}.`
    },
    '/table': {
        title: () => ['Table'],
        description: ({ league, on }) => `League standings for ${league}${on}.`
    },
    '/knockout': {
        title: () => ['Cup'],
        description: ({ league, on }) => `The cup bracket for ${league}${on}.`
    },
    '/rankings': {
        title: () => ['Rankings'],
        description: ({ league }) => `Player ratings and rankings at ${league} this year.`
    },
    '/rankings/[player]': {
        title: ({ params }) => [params.player, 'Rankings'],
        description: ({ league, params }) =>
            `Rating, form and record for ${params.player} at ${league}.`
    },
    '/champions': {
        title: () => ['Champions'],
        description: ({ league }) => `League and cup winners at ${league}.`
    },
    '/golden-boot': {
        title: () => ['Golden Boot'],
        description: ({ league }) => `Top scorers at ${league}.`
    },
    '/ballers-board': {
        title: () => ['Ballers Board'],
        description: ({ league }) => `In-form players at ${league}.`
    },
    '/news': {
        title: () => ['News'],
        description: ({ league }) => `The latest from ${league}.`
    },
    '/fantasy': {
        title: () => ['Fantasy'],
        description: ({ league }) =>
            `${league} Fantasy: pick a squad and score points from real results.`
    },
    '/fantasy/team': {
        title: () => ['My Squad', 'Fantasy'],
        description: ({ league }) => `Pick your ${league} Fantasy squad.`
    },
    '/year-recap/[year]': {
        title: ({ params }) => [params.year, 'Year Recap'],
        description: ({ league, params }) => `The ${params.year} season at ${league}, in numbers.`
    },
    '/help': {
        title: () => ['Help'],
        description: ({ league }) => `How ${league} works on Leagr.`
    },
    '/help/badges': {
        title: () => ['Badges', 'Help'],
        description: ({ league }) => `What the ${league} player badges mean.`
    },
    '/settings': {
        title: () => ['Settings'],
        description: ({ league }) => `Settings for ${league}.`
    },
    '/auth': {
        title: () => ['Sign In'],
        description: ({ league }) => `Enter the ${league} access code to get in.`
    },
    '/auth/forgot': {
        title: () => ['Forgot Code'],
        description: ({ league }) => `Recover the ${league} access code.`
    },
    '/auth/reset': {
        title: () => ['Reset Code'],
        description: ({ league }) => `Reset the ${league} access code.`
    }
};

/**
 * Formats a YYYY-MM-DD date as "Saturday 24 October", or null if it doesn't parse.
 * Built from its parts so the server's timezone can't shift the day.
 * @param {string|null} date
 * @returns {string|null}
 */
function formatWhen(date) {
    const match = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Title and share description for a route.
 * @param {{routeId: string|null, params: Record<string, string>, leagueName: string|null, date: string|null}} options
 *   `date` is the `?date=` query param only - a link without one shouldn't claim today's date.
 * @returns {{title: string, description: string}}
 */
export function pageMeta({ routeId, params, leagueName, date }) {
    if (!leagueName && routeId === '/') {
        return { title: `${ROOT_DOMAIN_NAME} > Leagr`, description: ROOT_DOMAIN_DESCRIPTION };
    }

    const route = (routeId && ROUTES[routeId]) || ROUTES['/'];
    const when = formatWhen(date);
    /** @type {MetaContext} */
    const ctx = {
        league: leagueName || 'your league',
        params,
        when,
        on: when ? ` on ${when}` : ''
    };

    return {
        title: [...route.title(ctx), leagueName || ROOT_DOMAIN_NAME, 'Leagr'].join(' > '),
        description: route.description(ctx)
    };
}
