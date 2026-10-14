# Pages deployment investigation — 14 October 2026

## Confirmed findings

- The repository uses branch-based Pages (`build_type: legacy`, `main`, `/`), with GitHub's generated `dynamic/pages/pages-build-deployment` workflow.
- Successful builds package and upload in roughly 8 seconds; artifact upload itself takes about 2 seconds.
- The failed artifact contains 499 entries, about 9.1 MB uncompressed / 4 MB compressed, and no symbolic or hard links. Compared with the preceding successful artifact, only `dash/index.html` differs.
- Permissions and the `github-pages` environment permit deployment from main. There is no required approval gate.
- The first failing release stalled in `updating_pages` until deploy-pages' default 600,000 ms timeout. This is after artifact upload and after GitHub accepted the Pages deployment.
- The later all-levels release failed with HTTP 400: an e341368 deployment was still in progress. A successful Actions rerun therefore did not ensure the repository's publishing state was immediately free for a new release.
- The 231826d rerun claimed Actions deploy was in progress while the Pages build record remained `errored` and the Pages deployment endpoint returned an empty status. Re-running Actions does not recreate the legacy Pages build record.
- Cache was ruled out: `dash/index.html` returned `X-Cache: MISS`, `Age: 0`, and still served the previous dashboard (Last-Modified 16:31:52 UTC).
- GitHub's public status API reported Pages and Actions operational; this does not rule out a repository-specific service problem.

## Recovery experiment

Cancelled the Pages deployment through the Pages API and separately cancelled the Actions run. Requested a new build with `POST /repos/dennis10276/oma-mahjong/pages/builds` instead of re-running Actions. This created a new Pages build record at 16:49:41 UTC, and a distinct Actions run, 38601378576. This fresh build also returned an empty deployment status for 231826d and did not publish. It was cancelled before the next controlled experiment.

## Interpretation and limits

The immediate failure is in GitHub's legacy Pages publishing/control state, not local compilation or uploading artifacts. The backend's exact internal cause is not exposed by the API. The earlier successful full rerun was recovery, not evidence of a permanent fix. Avoid repeatedly rerunning Actions against an errored Pages build record. A managed Actions Pages workflow with serialized deployments is a possible longer-term mitigation, but cannot by itself guarantee that GitHub's hosting backend never stalls.

## Evidence

- Original failing deployment: https://github.com/dennis10276/oma-mahjong/actions/runs/38595752346
- Following release rejected due to active deployment: https://github.com/dennis10276/oma-mahjong/actions/runs/38599303857
- Latest release and retries: https://github.com/dennis10276/oma-mahjong/actions/runs/38600133470
- Fresh Pages build experiment: https://github.com/dennis10276/oma-mahjong/actions/runs/38601378576
- Pages API: https://docs.github.com/en/rest/pages/pages
- deploy-pages timeout and cancellation logic: https://github.com/actions/deploy-pages/blob/v5/src/internal/deployment.js

## Controlled experiment: identical site, new commit identity

Created empty commit 391e3a65ff10f828fef945a9e9a9bf5164a341c6 on main. It has the exact same Git tree as 231826d; no site files changed. The new dynamic Pages run 38601600833 completed successfully in 37 seconds (16:51:15–16:51:52 UTC). The Pages build record is `built`, deployment status `succeed`, and a live request to `dash/index.html` includes both `ranking-status` and the moved all-levels table. Last-Modified is 16:51:45 UTC.

This strongly supports stale deployment state associated with the earlier commit/build identity, rather than a content or artifact problem. The exact cause of the initial GitHub backend stall remains unexposed. A successful later deployment is not a guarantee against another hosting-service incident.

Recovery for this observed failure mode: cancel the stuck Pages deployment and its Actions run, allow cancellation to complete, then publish a fresh commit identity (an empty commit if content is already correct). Verify Pages status and live content. Do not keep rerunning the same cancelled/errored legacy build or assume that increasing its timeout fixes the state.

Successful recovery: https://github.com/dennis10276/oma-mahjong/actions/runs/38601600833
