# Container Hardening Implementation

**Date:** 2026-09-18

## Overview

A security review of the deployment, prompted by another of the owner's projects having a
container infiltrated and a crypto miner installed. The audit was run against the live
deployment rather than just the repo, and the gaps it found are closed here.

Starting state, from `docker inspect leagr` on the production host:

```
ReadonlyRootfs=false   User=0        CapDrop=<none>   SecurityOpt=<none>
Memory=0               NanoCpus=0    PidsLimit=<none>
Ports=0.0.0.0:3001 + [::]:3001       LogConfig=json-file (no size cap)
```

Already sound and left alone: the Docker daemon is not listening on 2375/2376, nothing is
privileged, the Docker socket is not mounted, the base is genuinely distroless, `.env*` is
excluded from the build context, and the app has no `child_process`/`eval` and writes only UUID
or regex-sanitised filenames.

## What changed

### 1. The container no longer runs as root (`Dockerfile`)

The final stage moved to `gcr.io/distroless/nodejs24-debian12:nonroot`, which bakes uid/gid
65532 into the image so the container stays unprivileged even if someone runs it by hand. All
three base images are now pinned by digest alongside their tag, so a retagged or compromised
upstream cannot silently enter a build.

The prod-deps install gained `--ignore-scripts`. `package-lock.json` was checked first: `fsevents`
is the only dependency with an install script and it is darwin-only, so nothing is lost. It is
deliberately **not** applied to the builder stage, whose build depends on `prepare` running
`svelte-kit sync`.

### 2. Runtime hardening (`deploy.sh`)

The flags are assembled into `DOCKER_RUN_FLAGS` and interpolated into the existing single-line
`ssh ... docker run`, which must stay one line because the remote is cmd.exe.

| Flag                                          | Rationale                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `--read-only`                                 | No writable rootfs. Verified safe - every write target is under a mount. |
| `--tmpfs /tmp:rw,noexec,nosuid,size=64m`      | Scratch space that cannot be executed from.                              |
| `--cap-drop=ALL`                              | The app binds port 3000 (>1024), so no capability is required.           |
| `--security-opt=no-new-privileges:true`       | Blocks setuid escalation.                                                |
| `--memory=1g --memory-swap=1g`                | Hard ceiling; equal values disable swap.                                 |
| `--cpus=1.5`                                  | Leaves headroom for IIS and the other sites on the box.                  |
| `--pids-limit=256`                            | Caps fork bombs and miner spawns.                                        |
| `--log-opt max-size=10m --log-opt max-file=3` | Container logs can no longer fill the disk.                              |
| `-p 127.0.0.1:${PORT}:3000`                   | Loopback only - see §3.                                                  |

### 3. Port bound to loopback (`deploy.sh` + IIS `web.config`)

This is the change that makes the rest of the trust model sound. IIS is the intended front door
and overwrites `X-Forwarded-Host` / `X-Forwarded-Proto` with its own values, but the port was
published on `0.0.0.0`, so anything on the network could connect directly, bypass IIS and forge
both headers - defeating rate limiting and reaching the traversal described in §5.

Because Windows resolves `localhost` to `::1` first and `-p 127.0.0.1:` binds IPv4 only, the IIS
rewrite target must change to match:

```diff
- <action type="Rewrite" url="http://localhost:3001/{R:1}" />
+ <action type="Rewrite" url="http://127.0.0.1:3001/{R:1}" />
```

**This edit is on the production host and is outside `deploy.sh`'s automatic rollback.** It must
be applied by hand, and reverted by hand if the deploy is rolled back.

### 4. Secrets moved off the command line (`deploy.sh`)

Secrets were passed as `-e` flags on an ssh command line, putting them in both machines' process
lists and in shell history. They are now written to a `mktemp` file with mode 600, copied to the
host, ACL-restricted with `icacls`, passed via `--env-file`, and deleted from the host once the
container is verified running. Safe to delete because Docker reads `--env-file` only at create
time, so restarts and reboots do not need it. Cleanup is wired into both the success path and
`rollback()`, and an `EXIT` trap always clears the local copy.

**Tradeoff worth recording:** this does _not_ hide secrets from `docker inspect` - Docker stores
them in the container config either way. Doing that would need Docker secrets, which is overkill
for a single-host deploy.

### 5. Subdomain validation before it becomes a path (`league.js`, `hooks.server.js`)

`extractLeagueId` returned the host's first label without validating it, and `getLeagueDataPath`
joins that straight into a filesystem path. Since the host arrives via `X-Forwarded-Host`, a host
of `../../x.leagr.co.za` yielded a league id of `../../x` and escaped the data directory.

The function moved from `hooks.server.js` into `src/lib/server/league.js` as an exported
`extractLeagueId(host, appUrl)` - it belongs beside `getLeagueDataPath`, and unlike a
module-private function it can be unit tested without importing the whole hook and its side
effects. It now applies `isValidSubdomain`, the same guard league creation already used.

### 6. Rate limiting actually engages (`requestIp.js`, `hooks.server.js`)

Found while verifying that the loopback bind would not disturb client-IP logging. IIS ARR appends
the client's ephemeral source port to `X-Forwarded-For`, and `getIp` used the value verbatim as
the rate-limit key:

```
ip=41.126.237.163:46339
ip=41.126.237.163:13135   <- same person, three keys
ip=41.126.237.163:16985
```

The key therefore rotated on every TCP connection, so the 60/min per-IP rule was limiting nothing
and the 100/hour registration rule was equally leaky. New `src/lib/server/requestIp.js` exports
`stripPort`, which handles IPv4-with-port, ARR's bracketed IPv6 form, and bare IPv6 (which must
not be truncated at its first colon).

### 7. Image scanning in CI (`.github/workflows/ci.yml`)

Builds the image and scans it with Trivy at `HIGH,CRITICAL`. `ignore-unfixed: true` is set
deliberately: distroless ships CVEs with no upstream fix, and without it CI would block on things
nothing can action.

### 8. Unrelated pre-existing test failure fixed (`delete.test.js`)

`test/routes/api/players/delete.test.js` pinned `DATE = '2026-09-15'` and started failing the
competition-ended gate once that date passed. Confirmed pre-existing by running it against a clean
`git archive HEAD` checkout. Fixed by freezing the clock with `vi.useFakeTimers({ toFake: ['Date'] })`

- only `Date` is faked, leaving timer-driven async alone. This was blocking `deploy.sh`, which runs
  `npm test` and rolls back on failure, so the hardening could not ship past it.

## Testing

`npm run check:ci` (0 errors, 0 warnings), `npm run lint`, and `npm test` (44 + 20 files,
1372 + 323 tests) all pass.

New unit tests: `test/lib/server/league.test.js` (traversal hosts, reserved names, length floor,
hyphen edges, the legitimate case) and `test/lib/server/requestIp.test.js` (IPv4 with port,
rotating ports collapsing to one key, bracketed and bare IPv6, the `unknown` sentinel).

The runtime was verified by building the image and running it under the full flag set against a
copy of the data directory:

- `/app` write → `EROFS`; `/tmp` writable; uid/gid `65532`; both mounts writable
- sharp resized 1400x1400 → 512x512 webp under the read-only rootfs, settling the libvips-temp question
- a real player registration through the API landed on disk, and `app.log` was written by 65532
- `../../pirates`, `..%2Fpirates`, `a/b`, `api` (reserved), `ab` (too short) and `-bad` all resolved
  to `league=none`, while the legitimate host still resolved to `league=pirates`
- four rotating source ports collapsed to one `ip=41.126.237.163`; `[2001:db8::1]:443` unwrapped
  to `2001:db8::1`

## Assumptions and limitations

- **Resource limits are a starting point.** 1g / 1.5 CPU / 256 pids is generous for this workload
  but unverified under production load. Watch `docker stats leagr` after rollout.
- **The host mounts needed a one-time `chown` and it has been done (2026-09-18).** This was the
  one thing that would have broken production. Contrary to the assumption that Docker Desktop
  presents Windows bind mounts as writable to any uid, `C:/leagr/data` carries real POSIX
  ownership: league directories were mode 755 and files 644, all owned by root, because every
  container to date ran as uid 0. As 65532 the app could read everything but write nothing, so it
  would have started cleanly, served pages, and failed every registration, draw, score and ranking
  write.

    A shallow probe misses this - writing to `/app/data` itself succeeds because that directory is
    mode 777. The probe must write _inside_ a league directory and to an _existing_ file.

    Fixed by chowning both trees to 65532 from a root container (368 entries under `data`, 4 under
    `logs`). Safe to do while the old container is live, since root ignores permission bits. The
    pre-existing `app.log` was root-owned and unwritable too; it was archived to
    `app.log.pre-hardening-2026-09-18` and the app recreates it fresh.

    New files inherit 65532 from the container, so this does not need repeating - but anything that
    drops root-owned files into the mounts again (a restore, a file copied in from Windows, a
    root container) reintroduces it.

- **`deploy.sh` cannot detect this class of failure.** Its verification is `docker ps -q` - "is the
  container running" - after which the error trap is released and the backup container is deleted.
  A container that boots but cannot write its mounts passes. `logger.ensureLogDir` and
  `writeToFile` both swallow errors and fall back to console, so the logs would be quiet about it
  too. Probe the mounts before cutting over rather than relying on the deploy to catch it.
- **Digest pinning needs periodic refresh** or the images stop receiving upstream patches. Re-resolve
  with `docker buildx imagetools inspect <tag> --format '{{.Manifest.Digest}}'`.
- **Egress is not restricted.** A miner still has outbound network access; what has changed is that
  it has nowhere writable to persist, no capabilities, and a hard resource ceiling.
- The IIS `web.config` change (§3) is manual and outside the deploy script's rollback.

## Post-deploy note (2026-09-18 cutover)

Deployed as `leagr:2.29.3`. Verified live: `ReadonlyRootfs=true`, `User=65532`, `CapDrop=[ALL]`,
`no-new-privileges`, 1g/1.5cpu/256 pids, log rotation, `/tmp` tmpfs, and `netstat` showing
`127.0.0.1:3001` only with IIS connected through it. The remote secrets file was removed by the
script as intended.

One thing went wrong and is worth recording. `app.log` had been archived _before_ the deploy, but
the old root container was still running and recreated it by path on its next log write - so the
new nonroot container inherited a fresh root-owned file and could not write it. `writeToFile`
catches the `EACCES` and falls back to `console.error`, so the only visible symptom was `app.log`
stopping 15 seconds before `.State.StartedAt` while `docker logs leagr` filled with the error.

Fixed by archiving the file again with the new container already live, after which it recreated
`app.log` as uid 65532. **The ordering rule: `chown` the data tree before the deploy (root ignores
permission bits, so the old container is unaffected), but archive `app.log` after the new container
is running.**

Confirmed working on real traffic afterwards: `league=pirates` still resolves through IIS, and
client IPs now log without the ARR source port (`ip=196.39.167.29`), with repeated requests
collapsing to a single rate-limit identity.

## CI scan follow-up (2026-09-18)

The first CI run failed to even resolve the workflow: `aquasecurity/trivy-action@0.28.0` does not
exist. The tags are `v`-prefixed and the current release is `v0.36.0`; `docker/build-push-action@v6`
was stale too (that project is on v7). Both had been written from memory rather than checked.

Resolved by verifying against the GitHub API and then:

- **Dropping `build-push-action` entirely.** Nothing is being pushed, so a plain
  `run: docker build -t leagr:ci .` does the job without a third-party action or a buildx setup step.
- **Pinning `trivy-action` to a commit SHA** (`ed142fd...`, v0.36.0) rather than a tag. A tag is
  mutable and an action runs with access to the workflow token, so this is the same reasoning that
  put digests on the base images. Its input names were checked against the action definition at that
  exact SHA.
- **Renaming the job** from `lint-and-test` to `verify` / "Lint, test, build & scan", since it no
  longer only lints and tests. Note this changes the status-check name, so any branch protection
  rule requiring `lint-and-test` needs updating.

### The scan does not pass on the base image, and why it is ignored

Running Trivy locally with the CI settings exits 1: six HIGH/CRITICAL CVEs (one CRITICAL) in
`libssl3` 3.0.18, all `status: fixed`, so `ignore-unfixed` does not filter them. Re-resolving the
distroless digest does not help - the pinned digest is already the current `:nonroot` build, and
upstream has not rebuilt with the patched openssl.

They are ignored via a documented `.trivyignore`, on evidence rather than convenience: **Node
bundles its own OpenSSL (3.5.5), and nothing in the image links the Debian libssl3.** That was
verified by scanning every `.so`, `.node` and the node binary for a `libssl.so.3` reference - the
only match was `libssl.so.3` itself. All outbound TLS (Mailgun, OpenAI) goes through Node's OpenSSL.

Keeping `exit-code: 1` with a narrow ignore list preserves the signal: anything new still fails the
build. The alternative, `exit-code: 0`, would have made the scan permanently advisory. The entries
carry a re-check note and should be dropped when the base ships >= 3.0.20.

Verified locally with the exact CI settings: **exit 0**, with every npm package scanning clean.

## CI typecheck divergence (2026-09-18)

The next CI run failed `npm run check:ci` on a file this work never touched:

```
src/lib/server/teamLogoManager.js:208:25
Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
```

It passes locally and fails in CI because `svelte-kit sync` generates `.svelte-kit/ambient.d.ts`
from the environment variables present _at sync time_, and `.env.local` is gitignored. Locally that
file declares `export const OPENAI_API_KEY: string;`. In CI the variable is not declared at all, so
`env.OPENAI_API_KEY` falls through to the `[key: string]: string | undefined` index signature of
`$env/dynamic/private` - and `generateTeamLogo` takes `@param {string} apiKey`.

**The local typecheck is therefore systematically weaker than the gate.** Reproduced without
touching the working tree by checking out `git archive HEAD` into a temp directory (tracked files
only, so no `.env.local`), symlinking `node_modules`, and running `check:ci` there - same error,
same line.

Fixed by narrowing at the point of use rather than casting or loosening the callee signature, with
an early return in `generateLogosForDraw`:

```js
const apiKey = env.OPENAI_API_KEY;
if (!apiKey) {
    logger.info('[teamLogos] Skipping logo generation - OPENAI_API_KEY is not set', { date });
    return;
}
```

This also implements behaviour that `deploy.sh` and the README already claimed but which was never
actually there: `OPENAI_API_KEY` was read at exactly one site with no guard, so an unset key meant
one failed OpenAI request per team, each throwing into the per-team catch. It now skips once.

Verified with the fix applied in the CI-like tree: 2282 files, 0 errors, 0 warnings. Full suite
(1372 + 323) and lint pass locally.

## Ignore-list expiry (2026-09-18)

`.trivyignore` was converted to `.trivyignore.yaml` so the accepted `libssl3` findings carry an
`expired_at` (2027-01-15) and a per-entry `statement`. Without it the suppression is permanent and
silent: CI stays green whether the entries are still justified or long since unnecessary, and
nothing ever prompts a look.

Verified against Trivy 0.74.0 rather than assumed - both directions:

- with today's date: exit **0**, findings suppressed
- with the date rolled past: all six resurface, exit **1**, build fails

**Trivy gives no indication that an entry expired.** The CVE reappears exactly as though newly
discovered, with no reference to the statement or the lapsed date. A CRITICAL surfacing in January
will therefore look alarming and unrelated to this work, so the response procedure lives at the top
of the ignore file itself - the one place someone will actually be looking when it fires:

1. Re-resolve the distroless digest; if the base now ships the fix, pin it and delete the entries.
2. If still unpatched, **re-verify reachability** (the `libssl.so.3` ELF scan) before extending -
   do not trust the old statement.
3. Only then set a fresh `expired_at`.

The date is 2027-01-15 rather than a strict three months, to keep a surprise build failure out of
the December holiday period.

Worth noting a base-image bump is the _more likely_ trigger than the date: if distroless rebuilds
and the package is still vulnerable at a different version, the new CVE IDs will not be listed and
the scan goes red at that point instead. The same three steps apply.
