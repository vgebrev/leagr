# Pirates Footy Organiser

A little [SvelteKit 5](https://svelte.dev/) web app to help organise Saturday social 5-a-side footy sessions at Pirates.

Features include:

- View and manage player availability.
- Waiting list after a limit is reached.
- Generate random teams, either completely random or using player rankings as seeds.
- Generate a round-robin home-away match schedule and track results.
- Standings table based on match results.
- Cumulative player rankings based on team performances.

## Environment Setup

Data is stored as JSON files in the `data` directory. For dev, make sure it exists in the root of the project.

For development (needs [Node.js](https://nodejs.org/en)):

- `npm ci` - Ensures dependencies are installed.
- `npm run dev` - Starts the dev server. The app is available at http://localhost:5173.

### Security Configuration

The application includes rudimentary security features to prevent abuse:

#### CORS Protection
- **ALLOWED_ORIGIN**: Comma-separated list of allowed origins for cross-origin requests
- Only specified origins can access the API endpoints
- Example: `https://your-production-url.com,http://localhost:3000`

#### Semi-public API Key Authentication
- **API_KEY**: Required for all API endpoint access
- Must be provided via `X-API-KEY` header or `Authorization` header
- Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

#### Rate Limiting
- Built-in rate limiting: 60 requests per minute per IP address
- Automatically blocks excessive requests with HTTP 429 status

### Production Deployment

For production (needs [Docker](https://www.docker.com/)):

- Build a docker image with a production build of the app
```bash
docker build -t pirates-footy-roster:latest
```

- Run the docker container (The app will be available at http://localhost:3000)
```bash
docker run -d \
  --name pirates-footy-roster \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /path/to/data/on/host:/app/data \
  -e ALLOWED_ORIGIN="https://your-production-url.com,http://localhost:3000" \
  -e API_KEY="a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  pirates-footy-roster:latest
```
Expose the app to the internet by configuring your web server or reverse proxy (e.g., Nginx, Apache) to forward requests to port 3000.

**Environment Variables:**
- `ALLOWED_ORIGIN`: Comma-separated allowed origins (required for CORS protection)
- `API_KEY`: Secure API key for endpoint access (required for API authentication)

**Notes:**
- Replace `/path/to/data/on/host` with the actual path to the data directory on your host machine
- Replace `a1b2c3d4-e5f6-7890-abcd-ef1234567890` with a secure, randomly generated API key
- Replace the allowed origins with your actual domain(s)
