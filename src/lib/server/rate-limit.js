const rateLimitMap = new Map();
const RATE_LIMIT_DURATION = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60;

function isExceeded(ip) {
    const currentTime = Date.now();
    const requestData = rateLimitMap.get(ip) || { count: 0, firstRequestTime: currentTime };

    if (currentTime - requestData.firstRequestTime > RATE_LIMIT_DURATION) {
        requestData.count = 1;
        requestData.firstRequestTime = currentTime;
    } else {
        requestData.count += 1;
    }

    rateLimitMap.set(ip, requestData);

    return requestData.count > RATE_LIMIT_MAX_REQUESTS;
}

export const rateLimit = {
    isExceeded
};
