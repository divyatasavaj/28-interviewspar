// STEP 2 — Calibration question bank. 2-3 fixed medium-difficulty questions open every
// session before the adaptive engine (Step 7) turns on. Their scored results seed the
// initial ability estimate. Questions are hardcoded, per-domain, randomly sampled at runtime.
//
// Kept medium difficulty on purpose (cold-start baseline). Add more per domain as needed.

export const CALIBRATION_BANK = {
  "Software Engineering": [
    "Explain the difference between a process and a thread, with a short example.",
    "What is the time complexity of binary search, and when can you use it?",
    "Describe how you would debug a service that suddenly returns 500 errors in production.",
    "What is the difference between TCP and UDP? When would you pick one over the other?",
    "Explain what a REST API is and name two HTTP methods you use commonly.",
    "How does a hash map work, and what is a collision?",
    "What is the call stack, and what causes a stack overflow?",
    "Describe the difference between SQL and NoSQL databases with an example use case.",
    "What does 'idempotent' mean in the context of HTTP requests?",
    "Explain what a deadlock is and one way to prevent it.",
    "What is caching and when might it hurt more than help?",
    "Describe the difference between authentication and authorization.",
  ],
  "Data Science": [
    "What is the difference between supervised and unsupervised learning?",
    "Explain what overfitting is and one way to prevent it.",
    "What is a confusion matrix, and what do precision and recall tell you?",
    "Describe the bias-variance tradeoff in one or two sentences.",
    "What is the difference between a list and a NumPy array for numeric work?",
    "Explain what a p-value roughly represents.",
    "What is feature scaling and why might you need it?",
    "Describe the difference between a SQL JOIN and a GROUP BY.",
    "What is cross-validation and why use it?",
    "Explain the difference between correlation and causation.",
    "What is a neural network activation function for, briefly?",
    "How would you handle missing values in a dataset?",
  ],
  "Frontend": [
    "What is the difference between let, const, and var in JavaScript?",
    "Explain what the virtual DOM is and why frameworks use it.",
    "What are React hooks and name two you use often?",
    "Describe the difference between CSS flexbox and grid.",
    "What is a closure in JavaScript, with a brief example?",
    "Explain what 'debouncing' is and where you'd use it.",
    "What is the difference between controlled and uncontrolled inputs in React?",
    "How does the browser event loop handle async callbacks?",
    "What is CORS and when does it matter?",
    "Explain what a CSS specificity conflict is.",
    "What is memoization and how can it help rendering performance?",
    "Describe the difference between localStorage and sessionStorage.",
  ],
  "Backend": [
    "What is the difference between a monolith and microservices?",
    "Explain what database indexing does and a downside of over-indexing.",
    "What is an idempotency key in API design?",
    "Describe how you would design a rate limiter.",
    "What is eventual consistency in distributed systems?",
    "Explain the difference between a queue and a topic (pub/sub).",
    "What is a database transaction and ACID?",
    "How would you make an API backward-compatible when changing a response shape?",
    "What is connection pooling and why use it?",
    "Explain what a circuit breaker is.",
    "What is the difference between horizontal and vertical scaling?",
    "Describe how you'd secure a REST API.",
  ],
  "Product Management": [
    "How do you prioritize features when everything is urgent?",
    "Describe a time you used data to make a product decision.",
    "What is a north-star metric and why does it matter?",
    "How would you measure the success of a new feature?",
    "Explain the difference between a user story and a requirement.",
    "What is a minimum viable product (MVP)?",
    "How do you handle conflicting stakeholder requests?",
    "Describe how you'd reduce churn for a subscription product.",
    "What is A/B testing and when is it useful?",
    "How would you gather user feedback before building?",
    "Explain what opportunity cost means in roadmap planning.",
    "How do you define a good PRD?",
  ],
  // generic behavioral fallback (HR round)
  "HR": [
    "Tell me about yourself and your background.",
    "Describe a challenge you faced and how you handled it.",
    "Why are you interested in this role?",
    "Tell me about a time you worked in a team to solve a problem.",
    "What is one weakness you're working to improve?",
    "Describe a situation where you had a conflict with a colleague and how you resolved it.",
    "Where do you see yourself in three years?",
    "Tell me about a project you are proud of.",
    "How do you handle tight deadlines or pressure?",
    "What motivates you at work?",
    "Describe a time you received difficult feedback.",
    "Why should we move you to the next round?",
  ],
};

// pick `count` random unique questions for the given domain (falls back to HR bank)
export function getCalibrationQuestions(domain, count = 3) {
  const bank = CALIBRATION_BANK[domain] || CALIBRATION_BANK["HR"];
  const pool = [...bank];
  const out = [];
  while (out.length < count && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
