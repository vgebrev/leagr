const baseUrl = '/api';
let apiKey = $state('');
export function setApiKey(key) {
    apiKey = key;
}

async function get(key, date) {
    const url = `${baseUrl}/${key}${date ? `?date=${date}` : ''}`;
    const response = await fetch(url, { headers: { 'x-api-key': apiKey } });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

async function post(key, date, value) {
    const url = `${baseUrl}/${key}${date ? `?date=${date}` : ''}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
        },
        body: JSON.stringify(value)
    });
    if (!response.ok) {
        const errorData = await response
            .json()
            .catch(() => ({ message: `HTTP error! status: ${response.status}` }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

async function postDirect(endpoint, value) {
    const url = `${baseUrl}/${endpoint}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
        },
        body: JSON.stringify(value)
    });
    if (!response.ok) {
        const errorData = await response
            .json()
            .catch(() => ({ message: `HTTP error! status: ${response.status}` }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

async function remove(key, date, value) {
    const url = `${baseUrl}/${key}${date ? `?date=${date}` : ''}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
        },
        body: JSON.stringify(value)
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

async function patch(key, date, value) {
    const url = `${baseUrl}/${key}${date ? `?date=${date}` : ''}`;
    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
        },
        body: JSON.stringify(value)
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

export const api = {
    get,
    post,
    postDirect,
    remove,
    patch
};
