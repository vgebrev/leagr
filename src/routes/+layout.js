import { dateString } from '$lib/helpers.js';

export const load = ({ url }) => {
	return {
		date: url.searchParams.get('date') || dateString(new Date())
	};
};
