# Voice/video interview and delivery feedback

The supported `/interview/:sessionId` screen now includes the call experience.
It uses the same owned, versioned FastAPI interview and MongoDB report as typed
practice. The retired `pages/Interview.jsx` and `/api/video` routes are not activated.

## Candidate journey

1. Start an HR or technical interview as usual.
2. In **Your interview call**, choose an English recognition locale and browser or
   online neural question voice. Accept the voice/observation consent, then select
   **Join voice interview**. The interviewer speaks the question and opens the
   microphone when playback ends successfully.
3. Optionally select **Turn camera on**. The preview and face detector run locally.
   Camera failure or an unavailable detector does not prevent spoken/typed answers.
4. Confirmed recognized words append to the answer field; interim words appear as
   live captions. **Stop and review** ends recognition and waits for final words.
   **Submit answer** also waits for final words before saving and advancing. The
   next question is spoken automatically while voice mode remains active.
5. Review saved delivery observations alongside answer-content feedback. Assessment
   mode keeps previous-answer feedback in the final report.

Use **Leave voice mode** to release microphone/camera resources and continue typing.
Navigating away, completing the interview, or cancelling a pending permission
request also releases resources. Reloaded sessions retain submitted answers and
reports, but require joining voice mode again before accessing devices. Unsaved
text/recordings are not restored. Each recording stops after ten minutes.

Browser recognition may send microphone audio to its browser/vendor service.
InterviewSpar stores the submitted answer and consented numerical summaries, not
raw audio or camera frames. Online neural voice sends the question text to the
configured Edge TTS service; browser voice is the default and does not require
that service. Neither the avatar nor local face detection uses an external CDN.

## Measurement definitions

| Observation | Definition and limit |
| --- | --- |
| Transcript fillers | Whole expressions `um`, `uh`, `erm`, `er`, `hmm`, `you know`, `I mean` in the original recognized text. Recognition can omit or mishear them; these are coaching cues, not penalties. |
| Context-dependent words | `like`, `well`, `actually`, `basically`, `literally` are listed separately. They may be meaningful and are excluded from the filler count. |
| Microphone activity | Local Web Audio RMS sampled about every 50ms. RMS ≥0.018 marks an energy-active sample. It estimates speech activity; it cannot distinguish a speaker from every background sound. Browser audio processing is disabled for this meter. |
| Pauses | Energy gaps ≥500ms between active samples. Leading/trailing silence and gaps between separate recording attempts are excluded. Long missing sampling intervals are missing coverage, not pauses. |
| Speaking pace | Recognized word count divided by the observed first-to-last speech span, including internal pauses. Available only for a complete recognized transcript, ≥5 words, ≥5 seconds of span, ≥1 second of active energy and ≥80% audio coverage. |
| Audio coverage | Successfully sampled duration divided by capture duration. Browser suspension, a busy device, or unavailable audio can reduce coverage. |
| Face presence/framing | Native face detection where available, otherwise bundled TinyFaceDetector. Observations are sampled about twice per second. Centered framing requires exactly one detected face within the central framing bounds. No identity, emotion, gaze, or eye-contact model runs. |
| Page visibility | Visible/hidden elapsed time while the microphone answer turn is active, with visibility events preserving hidden duration across timer throttling. This describes the tab, not the candidate's attention. |
| Confidence | Optional candidate self-rating from 1–5. No inferred psychological-confidence percentage is fabricated. |

Short, silent, unavailable, or insufficiently observed samples remain **Not
measured** where a metric cannot be supported. Camera-off and detector-unavailable
states produce no samples, rather than a zero attention score. Normal pauses are
not treated as evidence of nervousness. Pronunciation and emotional confidence are
not measured; independent labeled recordings would be needed to validate stronger
claims across devices, accents, noise, and environments.

Reports use the original recognized word counts for delivery even when the final
answer is edited, and label that distinction. Summary pace combines eligible
spoken spans; camera percentages combine sample counts; self-ratings average only
answers with a rating. Skipped answers have no delivery evaluation. These metrics
do not change answer correctness, difficulty adaptation, or the hiring-related
limitations on existing scores.

## Engineering and verification

`useInterviewCall` owns playback/recognition generations and invalidates old
callbacks on question changes. `createDictation.stop()` waits for the recognition
end event with a bounded finalization timeout. Concurrent stop requests share the
same result; another recording cannot start until final words are handled. Leaving
during finalization cancels queued question playback. A recognition failure or
finalization timeout disables pace estimates for that answer; the user reviews
the captured transcript before submission. `useWebcam` releases late permission
results. `FaceDetection` loads its model only when the camera is active and never
uses pixel brightness as a substitute for face detection.

The optional `delivery` field on `/api/interview/answer` requires explicit consent,
bounded integer observations, and consistent duration/sample relationships. The
server derives report metrics; arbitrary client score fields are rejected. These
are still client-reported observations, not tamper-proof proctoring evidence.
Metrics share the interview's ownership, retry, persistence and deletion lifecycle.

Unit/API checks cover pauses, filler boundaries, missing data, transcript editing,
weighted summaries, consent/validation, final-word flushing, cancellation, visibility
timing and persistence. Browser checks use synthetic camera frames, a deterministic
Web Audio stream, and controlled speech-recognition/playback events. They test the
actual UI, media handling, bundled model loading and saved report integration; they
do not establish real microphone transcription accuracy or audible voice quality.
See `SITE_TEST_REPORT.md` for the run results and current limitations.

The optional focused browser command is:

```sh
cd backend
CALL_ONLY=1 ../.venv/bin/python tests/live_site_check.py --browser --browser-only --headful
```

As with the full runner, start Vite on port 5173 first and leave port 8000 free.
The runner creates and removes its own disposable database.
