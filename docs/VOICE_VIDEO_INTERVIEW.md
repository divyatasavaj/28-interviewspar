# Speech-only interview call

The supported `/interview/:sessionId` page fills the viewport with an interviewer
and local camera view. The call has no round list, written-answer field, code editor,
or confidence questionnaire. A browser **Full screen** button is available where
supported; the page already fills the viewport without browser fullscreen permission.

## Candidate journey

1. Choose the interview focus, feedback timing, and storage consent in setup.
2. In the call lobby choose the recognition locale and question voice, accept speech
   consent, and select **Join interview**. The camera connects by default; it may be
   disabled. Microphone speech recognition is required to answer.
3. The interviewer reads the question, then opens the microphone. Recognized words
   appear as read-only captions. **Pause microphone** waits for final words;
   **Continue speaking** appends more speech. **Record again** replaces the entire
   current answer and its delivery observations. Nothing can be typed into an answer.
4. **Send spoken answer** waits for final recognized words, saves the transcript and
   observations, and starts the next question automatically. Technical algorithm
   questions request a spoken explanation, example, complexity, and edge cases.
5. **End interview** opens the saved report. It does not submit an unsent answer.
   **Disconnect devices** stops camera/microphone and returns to the lobby.

Practice feedback is available in a compact **Previous answer feedback** control.
Assessment feedback appears only in the report. Device access requires joining again
after reload. Unsupported browsers or denied microphone permissions show a retry
message and block answer submission; there is no typed fallback. Skip/early finish
remain available. Each recording stops after ten minutes.

## Automatic observations

All computation uses browser observations and the recognized answer. No emotional,
identity, gaze, or pronunciation model runs. These are transparent coaching
heuristics, not independently validated measurements of a candidate's mental state.
Camera appearance is never used to infer confidence.

| Metric | Definition |
| --- | --- |
| Speaking pace | Recognized words / observed first-to-last speech span, including internal pauses. Requires complete recognition, ≥5 words, ≥5 seconds of span, ≥1 second of active energy, and ≥80% microphone coverage. |
| Transcript fillers | Whole expressions `um`, `uh`, `erm`, `er`, `hmm`, `you know`, `I mean`. Recognition may miss these; counts are not guaranteed disfluency counts. |
| Context-dependent words | `like`, `well`, `actually`, `basically`, `literally`, listed separately and excluded from filler totals. |
| Pauses | Energy gaps ≥500ms between active samples. Leading/trailing silence, gaps between attempts, and missing sampling intervals are excluded. Deliberate pauses can be useful. |
| Speech flow · estimate | `100 × (1 − pause_ms / speech_span_ms) × (1 − filler_count / word_count)`, rounded. A descriptive flow index, not a validated language-proficiency score. |
| Confidence cues | **Steady delivery** when pauses occupy ≤20% of speech span, fillers are ≤5 per 100 words, and pace is 90–190 words/minute; otherwise **Variable delivery**. Exact evidence is displayed. These thresholds are unvalidated coaching defaults, not a measurement of internal confidence. |
| Attention cues · presence | `face_presence_percent × page_visible_percent / 100`. Requires at least 10 valid camera samples and 10 seconds of tab observations in the same answer. This combines observable presence; it does not establish cognitive attention, eye contact, or integrity. |
| Face/framing | Native FaceDetector or bundled TinyFaceDetector, about twice per second while speaking. Centered framing requires one face within the central bounds. No face is distinct from unavailable detection. |
| Tab visibility | Event-based visible/hidden time only during the microphone answer turn. Hidden time is retained across timer throttling. |

Speech flow and confidence cues require complete recognition, ≥20 words, ≥10 seconds
of speech span, ≥3 seconds of energy-active audio, and ≥80% microphone coverage.
Short, silent, interrupted, or insufficiently observed answers show **Not measured**.
The microphone meter samples RMS about every 50ms; RMS ≥0.018 counts as active.
Background noise can count as energy, and device/browser behavior affects measurements.
Intervals longer than 250ms are missing coverage, not measured pauses.

Session speech metrics combine eligible answers' counts and durations, rather than
averaging rounded percentages. Attention estimates average only answers with both
camera and tab evidence, weighted by observed time. Skipped answers are excluded.
New reports no longer display historical confidence self-ratings. These observations
never alter answer correctness or difficulty adaptation.

## Data and API

Camera frames and raw audio are not saved or uploaded by InterviewSpar. Browser
recognition may send audio to the browser vendor. Online neural voice sends question
text to the configured TTS service; browser voice is the default. Local face detection
loads only when the camera is enabled and does not use an external CDN.

React starts sessions with `response_mode: "voice"`. The API requires a consented,
nonempty `delivery.transcript` equal to the submitted answer, and rejects written
replacements/code in those sessions. Browser observations cannot cryptographically
prove someone spoke. Text-mode API compatibility remains for existing integrations;
it is not exposed in the interview UI. `POST /api/interview/{id}/voice` upgrades an
owned older active session, preserving submitted answers and converting remaining
coding prompts to spoken problems. It is idempotent and uses a version check.

Generation ownership prevents old speech events from affecting a new answer.
Repeated stop requests share finalization; disconnect cancels queued playback and
late device permissions. Failed recognition or disconnecting before final words
arrive disables unsupported speech estimates until the answer is recorded again.

## Verification

Unit/API regressions cover threshold/null behavior, camera-independent confidence
cues, paired attention evidence, speech-only enforcement, complete technical voice
sessions, retries, and legacy upgrades. Browser checks use synthetic camera/audio and
controlled speech events. They establish wiring, persistence and UI behavior, not
real-device transcription accuracy, face-model accuracy, or audible voice quality.
See [site verification](SITE_TEST_REPORT.md) for actual results.

Start Vite on port 5173, leave port 8000 free, then run:

```sh
cd backend
CALL_ONLY=1 ../.venv/bin/python tests/live_site_check.py --browser --browser-only --headful
```

The runner uses a unique disposable database and confirms its deletion.
