# Clock explanation — release 1.49

Before the first active clock level (normally level 80), a blocking popup explains the countdown and move rules. It appears immediately, before the player can start taking tiles. A new acknowledgment marker also shows this explanation to existing players who have seen the old clock tip. After acknowledgment, normal starts and retries do not repeat it.

The complete explanation appears again in the loss popup after every clock timeout, alongside Retry and Menu. Dutch and English share the same behavior. Both popups and all their buttons fit a 360 × 640 phone without scrolling.

The explanation follows the existing game rules:

- The clock counts moves, not seconds; thinking takes no moves.
- Every tile removed from the board costs one move. A pair costs two, including a pair removed together by one tap.
- Merely revealing a face-down tile, blocked taps, Hint and Shuffle do not spend moves.
- Taking the clock tile with one move left is allowed. Its matching tile need not be taken yet. Taking it stops the countdown; leaving it on the board at zero loses the level.

No level arrangement, clock counter, route, difficulty target, progress or player reset changes in this release. The 1.48 measured levels remain the calibration baseline.

Regression checks cover an existing player's introduction at 80, acknowledgment persistence, no popup at 79, repeated timeout explanations, Retry/Menu behavior, small-phone fit in both languages, and actual move counting for peeking, blocked taps and a pair removed together. The existing final-allowed-move test remains in place.

All 92 offline tests passed. The fresh APK is version 1.49 (code 65), signed with the existing certificate and verified against the packaged game assets. Both small-phone popup states were visually inspected in Dutch and English.
