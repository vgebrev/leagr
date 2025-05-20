export function dateString(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');

	return `${year}-${month}-${day}`;
}

export function dateTimeString(date) {
	const time = date.toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});

	const datePart = date.toLocaleDateString(undefined, {
		weekday: 'long',
		day: '2-digit',
		month: 'long',
		year: 'numeric'
	});

	return `${time}, ${datePart}`;
}

export function isSaturday(date) {
	return date.getDay() === 6;
}

export function isObject(val) {
	return typeof val === 'object' && val !== null && !Array.isArray(val);
}
