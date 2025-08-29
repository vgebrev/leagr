# Leagr

A little [SvelteKit 5](https://svelte.dev/) web app to help organise social 5-a-side [football] leagues.

Features include:

- **League Management**
    - Subdomain-based league registration.
    - Access-controlled league isolation.
    - [Mailgun](https://www.mailgun.com/) integration for sending email (Access code recovery).
- **Player Management**
    - View and manage player availability.
    - Waiting list after a limit is reached.
    - Moving players between lists.
- **Team Management**
    - Generate random teams, either completely random or using player ELO as seeds.
    - Multi-iteration team generation algorithm that tries to maximise team variance and balance.
    - Replay team draws for dramatic effect.
    - Players can be moved from a team to the waiting list (and vice versa), removed, or marked as a no-show.
- **Discipline**
    - Automatic suspension of players after repeated no-shows.
- **Game Scheduling and Score Tracking**
    - Generate a round-robin home-away match schedule and track results.
    - Standings table based on match results.
    - Knockout tournament generation with teams seeded by standings.
- **Player Rankings**
    - Cumulative player rankings based on team performances and consistency.
    - Player ELO tracks individual matches for long-term team balance optimisation.
    - Player profile - ranking details and history.
    - Champions hall: tracks league and cup winners.

## Environment Setup

Data is stored as JSON files in the `data` directory. For dev, make sure it exists in the root of the project.

For development (needs [Node.js](https://nodejs.org/en)):

- `npm ci` - Ensures dependencies are installed.
- `npm run dev` - Starts the dev server. The app is available at http://localhost:5173.
- `npm run dev -- --host` - Starts the dev server and allows access from other devices on your network (useful for mobile testing, or if you're using [WSL](https://learn.microsoft.com/en-us/windows/wsl/)).

### Subdomain Setup

Since leagues are registered/accessed on subdomains, it's useful to set up your `hosts` file to test locally:

```bash
# Add to /etc/hosts (Linux/Mac) or C:\Windows\System32\drivers\etc\hosts (Windows)
127.0.0.1 leagr.local
127.0.0.1 league1.leagr.local
127.0.0.1 league2.leagr.local

# If you're using WSL, you need the WSL Network IP
172.21.184.1 leagr.local
172.21.184.1 league1.leagr.local
```

Then you can access the app at `http://leagr.local:5173`, `http://league1.leagr.local:5173`, etc.

### Security Configuration

The application includes rudimentary security features to prevent abuse:

#### CORS Protection

- **ALLOWED_ORIGIN**: Comma-separated list of allowed origins for cross-origin requests
- Only specified origins can access the API endpoints
- Example: `https://your-production-url.com,http://localhost:3000`

#### Semi-public API Key Authentication

- **API_KEY**: Required for all API endpoint access
- Must be provided via `X-API-KEY` header
- Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

#### Access Code Authorisation

- Each league has a unique access code
- To access the league, the access code must be provided in a "code" query parameter, or the user is redirected to a login page
- Access code must be included in an **Authorization** header of API requests
- Access codes can be reset if an organiser/owner email is set up for the league

#### Rate Limiting

- Built-in rate limiting: 60 requests per minute per IP address
- Automatically blocks excessive requests with HTTP 429 status

### Production Deployment

For production (needs [Docker](https://www.docker.com/)):

- Build a docker image with a production build of the app

```bash
docker build -t leagr:latest
```

- Run the docker container (The app will be available at http://localhost:3000)

```bash
docker run -d \
  --name leagr \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /path/to/data/on/host:/app/data \
  -e ALLOWED_ORIGIN="https://your-production-url.com,http://localhost:3000" \
  -e API_KEY="a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -e APP_URL="https://your-production-url.com" \
  -e MAILGUN_SENDING_KEY="your-mailgun-sending-key" \
  -e MAILGUN_DOMAIN="your-mailgun-domain.com" \

  leagr:latest
```

Expose the app to the internet by configuring your web server or reverse proxy (e.g. Nginx, Apache) to forward requests to port 3000.

**Environment Variables:**

- `ALLOWED_ORIGIN`: Comma-separated allowed origins (required for CORS protection)
- `API_KEY`: Secure API key for endpoint access (required for API authentication)
- `APP_URL`: The base URL of your application (used for generating links in emails)
- `MAILGUN_SENDING_KEY`: Mailgun API key for sending emails
- `MAILGUN_DOMAIN`: Mailgun domain for sending emails

**Notes:**

- Replace `/path/to/data/on/host` with the actual path to the data directory on your host machine
- Replace `a1b2c3d4-e5f6-7890-abcd-ef1234567890` with a secure, randomly generated API key
- Replace the allowed origins, app URL with your actual domain(s)
- Replace Mailgun credentials with your actual Mailgun account details

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
