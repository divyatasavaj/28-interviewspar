# flow.md — InterviewSpar Backend Functions & Flow

Backend-only reference: every core function, what it does, and the end-to-end flow connecting them. No UI details — this is the logic layer only. Database: **MongoDB**.

---

## 1. Modules & Functions

### Module: Auth & User Management
- `create_user(name, email, password)` — registers a new student account
- `login_user(email, password)` — authenticates and returns a session token
- `get_user_profile(user_id)` — fetches personal details, resume status, past sessions
- `update_profile(user_id, fields)` — edits personal details
- `change_password(user_id, old_password, new_password)`
- `logout_user(user_id)`

### Module: Resume Handling
- `upload_resume(user_id, file)` — stores the uploaded PDF, links it to the user
- `parse_resume_text(file)` — extracts raw text from the PDF
- `extract_resume_summary(raw_text)` — condenses resume into structured points (projects, skills, experience) for use as LLM context

### Module: Question Bank
- `get_calibration_questions(domain)` — returns 2-3 fixed baseline questions for session start
- `get_next_question(student_ability, domain, difficulty, question_type)` — pulls the best-fit question from the bank based on current ability estimate
- `get_question_reference(question_id)` — retrieves the stored verified answer/checklist/test cases/reasoning path tied to that question
- `add_question(domain, difficulty, type, question_text, reference_data)` — admin/dev function to grow the bank

### Module: Adaptive Engine (BKT/IRT)
- `initialize_ability_estimate(user_id, calibration_results)` — seeds per-topic ability from calibration answers
- `update_ability_estimate(user_id, topic, answer_result)` — updates ability estimate after every scored answer
- `select_next_difficulty(user_id, topic)` — decides whether the next question in that topic should be easier or harder
- `get_ability_profile(user_id)` — returns the full per-topic ability breakdown (used for the radar-chart-style data and reports)

### Module: AI Interview Engine (LLM)
- `generate_interview_question(context, mode)` — asks the LLM to generate the next question/follow-up, respecting Practice/Assessment mode rules
- `generate_resume_followup(resume_summary, conversation_context)` — generates a live, resume-specific question
- `call_llm(prompt, provider="groq")` — wraps the actual API call, with automatic fallback to Gemini if Groq fails/rate-limits
- `build_system_prompt(persona, mode)` — constructs the interviewer persona + rules (HR/Technical, Practice/Assessment)

### Module: Answer Capture
- `capture_text_answer(session_id, question_id, text, timestamp)`
- `capture_code_answer(session_id, question_id, code, keystroke_log)`
- `capture_voice_transcript(session_id, question_id, transcript, word_timestamps)`
- `record_response_latency(question_shown_at, answer_submitted_at)`

### Module: Answer Verification
- `route_verification_method(question_type)` — decides which check applies (test-case / checklist / LLM-RAG / quality-only)
- `run_code_test_cases(code, test_cases)` — executes submitted code, returns pass/fail per test case
- `keyword_precheck(answer_text, checklist_terms)` — fast, free check for obvious cases
- `llm_verify_answer(question, reference_answer, student_answer)` — RAG-style: sends question + stored reference + student answer to the LLM for a grounded comparison
- `verify_logical_puzzle(question, reference_reasoning_path, student_answer)` — checks final answer + reasoning steps
- `verify_trick_question(question, key_insight, student_answer)` — checks if the student caught the trap
- `verify_resume_consistency(resume_claim, live_answer)` — checks depth/match, not correctness

### Module: Fluency & Delivery Scoring
- `detect_filler_words(transcript)` — counts "um," "uh," "like," etc.
- `detect_pauses(word_timestamps)` — measures gaps between speech segments
- `check_grammar(transcript)` — runs transcript through LanguageTool, returns error count
- `compute_fluency_score(filler_count, pause_data, grammar_errors)` — combines the three into one fluency score
- `classify_mistake_type(answer_features)` — LLM-as-judge call that tags delivery issues (rambling, no-structure, underselling, silent-coding, etc.)
- `generate_explainability_note(mistake_tag, feature_values)` — attaches the specific feature values behind a given tag

### Module: Anti-Cheat Monitoring
- `log_face_event(session_id, event_type, timestamp)` — no-face / multi-face / face-left-frame
- `log_tab_switch(session_id, timestamp)`
- `log_fullscreen_exit(session_id, timestamp)`
- `log_copy_paste(session_id, question_id, pasted_content_length)`
- `check_code_similarity(code, known_solutions_bank)` — token-overlap comparison, flags high similarity
- `flag_latency_anomaly(response_latency, question_complexity_baseline)`
- `compile_integrity_summary(session_id)` — aggregates all flags for that session

### Module: Session Management
- `start_session(user_id, domain, round_type, difficulty, duration, mode)` — creates a new session record, kicks off calibration
- `advance_session(session_id)` — moves the session to the next question via the adaptive engine
- `end_session(session_id)` — closes the session, triggers report compilation
- `get_session_history(user_id)` — returns list of past sessions for the profile/dashboard

### Module: Report Generation
- `compile_session_report(session_id)` — pulls together ability profile, all answer scores, mistake tags, fluency data, integrity flags
- `generate_pdf_report(session_report)` — renders the compiled report into a downloadable PDF
- `get_report(session_id)` — fetches a stored report for viewing

### Module: Feedback
- `submit_user_feedback(user_id, session_id, rating, comments)` — stores post-interview user satisfaction feedback
- `get_feedback_history(user_id)`

---

## 2. End-to-End Flow (Backend Perspective)

```
1. create_user() → login_user()
2. upload_resume() → parse_resume_text() → extract_resume_summary()
3. start_session(user_id, domain, round_type, difficulty, duration, mode)
      → get_calibration_questions(domain)

4. LOOP (calibration, then adaptive):
      a. get_next_question(...) OR generate_resume_followup(...)
      b. build_system_prompt(...) → generate_interview_question(...) → call_llm(...)
      c. Question delivered → capture_text_answer() / capture_code_answer() / capture_voice_transcript()
      d. record_response_latency(...)

      e. route_verification_method(question_type):
             - coding      → run_code_test_cases(...)
             - concept     → keyword_precheck(...) → if unclear → llm_verify_answer(...)
             - puzzle      → verify_logical_puzzle(...)
             - trick       → verify_trick_question(...)
             - behavioral  → classify_mistake_type(...) only (no correctness check)
             - resume q's  → verify_resume_consistency(...)

      f. detect_filler_words() + detect_pauses() + check_grammar() → compute_fluency_score()
      g. classify_mistake_type() → generate_explainability_note()

      h. In parallel throughout: log_face_event(), log_tab_switch(), log_fullscreen_exit(),
         log_copy_paste(), check_code_similarity(), flag_latency_anomaly()

      i. update_ability_estimate(user_id, topic, combined_result)
      j. select_next_difficulty(user_id, topic) → advance_session(session_id) → back to (a)

5. Session duration/question limit reached → end_session(session_id)
      → compile_integrity_summary(session_id)
      → compile_session_report(session_id)
      → generate_pdf_report(session_report)

6. submit_user_feedback(user_id, session_id, rating, comments)
7. get_session_history(user_id) / get_report(session_id) available anytime after, via profile/dashboard
```

---

## 3. Database — MongoDB Collections

MongoDB is document-based, so related data is grouped inside each document rather than spread across many linked tables.

### `users`
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string",
  "password_hash": "string",
  "resume": {
    "file_url": "string",
    "raw_text": "string",
    "summary": "string"
  },
  "created_at": "datetime"
}
```

### `questions`
```json
{
  "_id": "ObjectId",
  "domain": "string",
  "difficulty": "Easy | Medium | Hard",
  "type": "coding | concept | puzzle | trick | estimation | behavioral | resume_followup",
  "question_text": "string",
  "reference": {
    "test_cases": [ { "input": "...", "expected_output": "..." } ],
    "checklist": ["key point 1", "key point 2"],
    "reasoning_path": "string",
    "key_insight": "string"
  }
}
```

### `sessions`
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "domain": "string",
  "round_type": "HR | Technical",
  "mode": "Practice | Assessment",
  "difficulty": "string",
  "duration_minutes": 5,
  "started_at": "datetime",
  "ended_at": "datetime",
  "ability_profile": { "DSA": 0.8, "Communication": 0.65, "SystemDesign": 0.5 },
  "status": "in_progress | completed"
}
```

### `answers`
```json
{
  "_id": "ObjectId",
  "session_id": "ObjectId",
  "question_id": "ObjectId",
  "answer_text": "string",
  "code_submission": "string",
  "transcript": "string",
  "response_latency_ms": 4200,
  "correctness_result": { "passed": true, "test_case_results": [] },
  "mistake_tags": [ { "tag": "rambling", "feature_values": { "answer_length": 340, "star_detected": false } } ],
  "fluency_score": { "filler_count": 3, "pause_ms_total": 1200, "grammar_errors": 1, "score": 0.74 }
}
```

### `integrity_logs`
```json
{
  "_id": "ObjectId",
  "session_id": "ObjectId",
  "events": [
    { "type": "face_not_detected", "timestamp": "datetime" },
    { "type": "tab_switch", "timestamp": "datetime" },
    { "type": "copy_paste", "question_id": "ObjectId", "timestamp": "datetime" },
    { "type": "code_similarity_flag", "question_id": "ObjectId", "similarity_score": 0.87 }
  ]
}
```

### `reports`
```json
{
  "_id": "ObjectId",
  "session_id": "ObjectId",
  "user_id": "ObjectId",
  "compiled_report": { "overall_level": 78, "response_relevancy": 0.8, "communication": 0.75, "confidence": 0.7 },
  "pdf_url": "string",
  "generated_at": "datetime"
}
```

### `feedback`
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "session_id": "ObjectId",
  "rating": 4,
  "comments": "string",
  "submitted_at": "datetime"
}
```

---

## 4. Notes on MongoDB Fit
- Session + answers could be embedded as one document (answers as an array inside the session) instead of a separate collection — either works; separate collections shown above keep individual answer documents smaller and easier to query independently (e.g. "all answers tagged rambling across all sessions").
- No joins needed for the most common reads (get a session + its report) since related data is grouped by `session_id` reference, which MongoDB handles well at this project's scale.
- Free tier: MongoDB Atlas free tier (512MB) is more than sufficient — same storage math as before applies (each session's text data is only tens of KB, video is not stored for practice sessions).






- Frontend: npm run dev 
- Backend: uvicorn main:app --reload 