# Visionex Arcade audio asset manifest

Last verified: 2026-08-02

## Licence and processing

The files below were downloaded from the original WAV download endpoint exposed by each Mixkit item. Mixkit states that its sound effects may be used in commercial and personal projects and that attribution is not required. The catalogue page and licence remain linked for auditability:

- Catalogue and usage statement: https://mixkit.co/free-sound-effects/
- Licence selector: https://mixkit.co/license/

Visionex converted each WAV to stereo MP3 at 48 kHz and 192 kbps, applying EBU R128 loudness normalization with a true-peak ceiling of -1.5 dBTP. The source WAV is not redistributed. SHA-256 hashes identify the exact production derivatives committed with the application.

## Approved production derivatives

| Registry ID | Mixkit item | Catalogue page | Production file | SHA-256 |
| --- | --- | --- | --- | --- |
| `ui-select` | 3124 — Modern technology select | https://mixkit.co/free-sound-effects/click/ | `ui-select.mp3` | `2ac7ec02d1a6a44c30e88698512ec3696396db6441c7fe1b3a84931495090800` |
| `button-confirm` | 2867 — Confirmation tone | https://mixkit.co/free-sound-effects/notification/ | `button-confirm.mp3` | `08289ab4f92ee6301b92ec3fe3095ac1d918ceed8aa3dbddfef028fc778f64de` |
| `puzzle-place` | 960 — Tile game reveal | https://mixkit.co/free-sound-effects/tile/ | `puzzle-place.mp3` | `8e05e244234af363bd826bdfff725557ff5fd2a98cfd57653f93bc0562c542e5` |
| `puzzle-success` | 2870 — Correct answer tone | https://mixkit.co/free-sound-effects/game-show/ | `puzzle-success.mp3` | `23021404b167b9be198b198f364641398852c247527fc664e20b292b0be51c89` |
| `puzzle-failure` | 946 — Wrong answer fail notification | https://mixkit.co/free-sound-effects/game-show/ | `puzzle-failure.mp3` | `ec219687506f5f86f7b1c9972597a3bf66eb246c90fd40c62293358f77de3bea` |
| `wood-piece-place` | 2182 — Wood hard hit | https://mixkit.co/free-sound-effects/wood/ | `wood-piece-place.mp3` | `542a0940f4ea63c921fbbc3b124b39476babae4c12e0a9f4acdad35cecb0c6f8` |
| `card-place` | 2001 — Poker card placement | https://mixkit.co/free-sound-effects/card/ | `card-place.mp3` | `f563490de67e9b2010f90de2688c52d64350ee5731906bfca422c20d4a12f3ad` |
| `car-engine-idle` | 1535 — Car ignition | https://mixkit.co/free-sound-effects/car/ | `car-engine-idle.mp3` | `3e0bfadfa7ce6df29de84f69d5a13bed95ff32b4a9bb944a8902be62d78709bd` |
| `car-engine-acceleration` | 1560 — Transport car start | https://mixkit.co/free-sound-effects/car/ | `car-engine-acceleration.mp3` | `978f0d371fb73e3acc2b6d6961ed4b70ba232770839ac0cb878e4375ac9ec741` |
| `jungle-ambience` | 2434 — Birds in the jungle | https://mixkit.co/free-sound-effects/jungle/ | `jungle-ambience.mp3` | `ac5742cc327c8dcba965284bf9f8b3fd4429704258bdb1a987b0ec61dcd1fef1` |
| `kitchen-ambience` | 1831 — Gas stove hum | https://mixkit.co/free-sound-effects/kitchen/ | `kitchen-ambience.mp3` | `0a4709185a2e12d68242008a00197ee5c9f2cd04efab7cf4ed4f620bdd9fe827` |
| `natural-victory` | 502 — Auditorium moderate applause and cheering | https://mixkit.co/free-sound-effects/win/ | `natural-victory.mp3` | `780d507a18ac5cd9036d12d9f2e426e45bec0b38d6d9810edef7d7f4645b8fc5` |
| `natural-failure` | 633 — Game over dark orchestra | https://mixkit.co/free-sound-effects/game-over/ | `natural-failure.mp3` | `0bc956dd059610dcd8d2e6564d94d38380bcca3f5e57c99aec6aa780a1374ed1` |

## Approval boundary

This manifest approves only the thirteen files listed above. Narration, children's voices, adaptive music, dice, chess, gear-shift, brake, and tyre assets remain blocked in the registry until a matching licensed recording is acquired and reviewed. No preview URL or undocumented sound is an approved fallback.

## Freesound CC0 derivatives (added 2026-10-25)

Found through Openverse (https://api.openverse.org), filtered to CC0 / public-domain licences, so no attribution is required. Source files are Freesound preview MP3s (128 kbps), the best quality available without a Freesound account, so the delivered 192 kbps MP3 carries no more detail than its source. Each clip was trimmed to the sound itself, given a 4 ms fade-in and 40 ms fade-out, converted to stereo 48 kHz and encoded as 192 kbps MP3. Sustained sounds were loudness-normalised (EBU R128, -18 LUFS, -1.5 dBTP); single impacts (dice, capture, gear) were peak-normalised to about -1.8 dBFS, because a short impact cannot reach -18 LUFS without clipping. The measured integrated loudness is listed.

| Registry ID | Freesound item | Creator | Licence | Landing page | Trim | Integrated | Production file | SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dice-roll` | dice roll_wooden table_1.wav | ekfink | CC0 1.0 | https://freesound.org/people/ekfink/sounds/235484 | 0.15 s, 1.9 s | -25.7 LUFS | `dice-roll.mp3` | `13c1b4c63a23e058b868c90f58aa93b549224b047a165349437d02de4712b925` |
| `chess-piece-move` | Chess Pieces hitting wooden board.wav | XfiXy8 | CC0 1.0 | https://freesound.org/people/XfiXy8/sounds/467282 | 0 s, 0.9 s | -19.4 LUFS | `chess-piece-move.mp3` | `b2858b141c1ec1e984599b8cca914a563cbb2a740cf038d8295c8010a082075c` |
| `chess-piece-capture` | Forcefully knocking over chess piece, with roll FINAL.wav | mht23SD | CC0 1.0 | https://freesound.org/people/mht23SD/sounds/707342 | 0.10 s, 0.7 s | -29.3 LUFS | `chess-piece-capture.mp3` | `7e3e2e55e991017c29ebf886f9593fea0311fa0e1ec09fdb7ea0d81aa7f9dbf4` |
| `car-gear-shift` | Column Gear Select Up (mono).wav | E-Audio | CC0 1.0 | https://freesound.org/people/E-Audio/sounds/118243 | whole, 0.73 s | -19.6 LUFS | `car-gear-shift.mp3` | `e58b2327850a72897d09988792aef58545782d91796e1722237db71451bb3a9b` |
| `car-tire-screech` | [SFX] car screech 2 | waveplaySFX | CC0 1.0 | https://freesound.org/people/waveplaySFX/sounds/233558 | 0 s, 1.15 s | -18.2 LUFS | `car-tire-screech.mp3` | `cd75326f3b50f6eacf3ab67c69008f08bcbea1ee6d878378b38725adfbe350cb` |

Not covered: `car-brake` has no approved source yet. The one CC0 candidate found ("Truck Brakes", 27 s, continuous) could not be checked for fit without listening, so it was not shipped.
