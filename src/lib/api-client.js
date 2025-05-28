const baseUrl = '/api';
async function get(key, date) {
    const url = `${baseUrl}/${key}${date ? `?date=${date}` : ''}`;
    const response = await fetch(url);
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
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(value)
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

async function remove(key, date, value) {
    const url = `${baseUrl}/${key}${date ? `?date=${date}` : ''}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
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
    remove
};
