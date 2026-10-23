import { defineEnvVars } from '@sveltejs/kit/env';

// Variables read through $app/env/private. Both are optional: returning undefined keeps
// "unset" distinguishable from an empty string, so the logo generator can skip when there
// is no key and generateTeamLogo's default model still applies when no override is given.
export const variables = defineEnvVars({
    OPENAI_API_KEY: {
        description: 'OpenAI key for AI team-logo generation; logos are skipped when unset',
        schema: (value) => value || undefined
    },
    OPENAI_MODEL: {
        description: 'Overrides the default OpenAI image model',
        schema: (value) => value || undefined
    }
});
