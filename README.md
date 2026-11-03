# Expression Reader MVP1

Browser-only webcam expression observation app from the supplied PRD. Static HTML/CSS/JavaScript, with locally hosted FaceAPI 1.7.15 and model weights (MIT; license in dist/vendor/LICENSE). No backend, uploaded camera frames, analytics, storage, face recognition, age or gender models.

Serve `public` over HTTPS (or localhost during development). There is no build step. Deploy to Vercel by importing the GitHub repo — see `vercel.json` for configuration.

## Product choices
- Indonesian interface, four displayed model categories: neutral → Netral, happy → Tersenyum, angry → Mengerutkan wajah, surprised → Tampak terkejut. These are approximate visible-expression proxies, not validated action-unit labels or emotion findings. Remaining model categories are withheld as uncertain.
- Display threshold 0.65, three consecutive matching estimates before display. These initial heuristics require user validation and are not calibrated probabilities.
- Single face only. Minimum detector score 0.65, minimum width 18% and height 22% of frame. Face-crop luminance below 42/255 prompts better lighting. Frame clipping and head angle are approximate visibility checks; there is no dedicated validated occlusion detector.
- Loop targets a maximum of 10 updates/second, yielding between analyses and adapting to actual device latency. Camera preview begins before model readiness. No claim of tested 3-second startup or 10 FPS across devices.
- Pause stops future analysis (already executing inference may finish but results are discarded); camera preview stays on. Hidden tab pauses automatically. End session and pagehide stop all tracks and clear in-memory face results, canvas, and timeline. Model weights may stay cached; camera data is never persisted.
- Timeline contains up to 20 expression transitions at least 3 seconds apart, session-only. Switching cameras ends/clears the old session.
- No operational analytics sent. This preserves privacy while product validation is still pending.

## Validation boundary
Syntax, local assets, model weight integrity and CPU inference, and mocked lifecycle/recovery tests can run in the execution environment. Real camera quality, actual browser WebGL performance, permission UI, responsive visual rendering, and WebMCP integration still need a supported browser and physical webcam. Validate Chrome/Edge desktop with one/multiple/no face, low light, partly obscured face, permission denial, pause/resume, camera switching, and end-session LED release before claiming launch readiness.

## Completed checks
JavaScript syntax and asset/manifest references passed. Actual bundled model weights loaded on TensorFlow CPU; blank input produced no face, landmark model produced 68 points, and expression outputs summed to one. Mocked integration checks passed for permission recovery, no/multiple-face gating, stable/uncertain results, pause/resume, camera track release, and history clearing. These are not accuracy or webcam performance measurements. Browser visual QA and WebMCP validation were unavailable.
