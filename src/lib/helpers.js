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

export function isDateInPast(date, hours = 13) {
    const limit = new Date(date);
    limit.setDate(limit.getDate());
    limit.setHours(hours, 0, 0, 0);
    return limit < new Date();
}

export function isObject(val) {
    return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function titleCase(str) {
    if (!str) return '';
    return str
        .split(' ')
        .map((word) => capitalize(word))
        .join(' ');
}

export function rotateArray(arr, offset) {
    const len = arr.length;
    const shift = offset % len;
    return arr.slice(shift).concat(arr.slice(0, shift));
}

export const teamColours = ['blue', 'white', 'orange', 'green', 'black'];

export const teamStyles = {
    blue: {
        text: 'text-blue-100 bg-blue-500',
        header: 'bg-blue-600 text-white',
        row: 'bg-blue-500',
        button: 'white',
        confetti: ['#2b7fff', '#bedbff']
    },
    orange: {
        text: 'text-orange-100 bg-orange-500',
        header: 'bg-orange-600 text-white',
        row: 'bg-orange-500',
        button: 'white',
        confetti: ['#ff6900', '#ffd6a8']
    },
    green: {
        text: 'text-green-100 bg-green-500',
        header: 'bg-green-600 text-white',
        row: 'bg-green-500',
        button: 'white',
        confetti: ['#00c951', '#b9f8cf']
    },
    white: {
        text: 'text-gray-800 bg-gray-100',
        header: 'bg-gray-200 text-gray-800',
        row: 'bg-gray-100',
        button: 'black',
        confetti: ['#6a7282', '#e5e7eb']
    },
    black: {
        text: 'text-gray-100 bg-gray-800',
        header: 'bg-gray-900 text-white',
        row: 'bg-gray-700',
        button: 'white',
        confetti: ['#1c1917', '#79716b']
    },
    default: {
        text: 'text-gray-700 dark:text-gray-200 dark:bg-gray-700 bg-gray-200',
        header: 'dark:bg-gray-700 bg-gray-200',
        row: 'bg-gray-100 dark:bg-gray-600',
        button: 'primary',
        confetti: ['#6a7282', '#e5e7eb']
    }
};
