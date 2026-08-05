# Backend services (Python)
#
# Per architecture.md the Intelligence Layer is Python (scikit-learn / Groq client).
# For STEP 0 the backend is Node/Express. These Python services are added in later
# steps and called by the Node API as needed:
#
# - llm_service.py      Groq/Gemini prompt + call wrappers (Step 1)
# - feature_extractor.py text/voice feature extraction (Step 6, 9)
# - classifier.py       trained model inference (Step 6)
# - adaptive_engine.py  BKT/IRT ability estimate + next-question selection (Step 7)
