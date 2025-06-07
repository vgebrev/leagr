const API_KEY = process.env.API_KEY || import.meta.env.VITE_API_KEY;

export const load = () => {
    return {
        apiKey: API_KEY
    };
};
