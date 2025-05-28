# Pirates Footy Organiser

A little app to help organise Saturday social 5-a-side footy sessions at Pirates.

Features include:
- View and manage player availability.
- Waiting list after a limit is reached.
- Generate random teams.
- Schedule matches and track results.
- Standings table based on match results.

## Environment Setup

Data is stored as JSON files in the `data` directory. For dev, make sure it exists in the root of the project.

For development (needs [Node.js](https://nodejs.org/en)):

- `npm ci` - Ensures dependencies are installed.
- `npm run dev` - Starts the dev server. The app is available at http://localhost:5173.

For production (needs [Docker](https://www.docker.com/)):

- `docker build -t pirates-footy-roster:latest` - Builds a docker image with a production build of the app.
- `docker run -d --name pirates-footy-roster -p 3000:3000 -v /path/to/data/on/host:/app/data pirates-footy-roster:latest` - Runs a docker container. The app is available at http://localhost:3000 and data is saved in `/path/to/data/on/host`.

NOTE: Replace `/path/to/data/on/host` with the actual path to the data directory on your host machine.
