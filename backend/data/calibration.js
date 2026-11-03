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
  "System Design": [
    "Design a URL shortener like bit.ly. Consider scale, analytics, and custom aliases.",
    "Design a pastebin service. Handle expiration, privacy, and high write throughput.",
    "Design a rate limiter for an API. Compare token bucket vs sliding window approaches.",
    "Design a notification system for a social app. Support push, email, in-app, and preferences.",
    "Design a distributed cache. Address eviction, consistency, and hot keys.",
    "Design a chat application like WhatsApp. Handle presence, delivery receipts, and groups.",
    "Design a search autocomplete system. Optimize for latency and relevance.",
    "Design a file storage service like Dropbox. Handle sync, versioning, and sharing.",
    "Design a video streaming platform. Address CDN, adaptive bitrate, and encoding.",
    "Design a ticket booking system. Handle concurrency, seat locking, and payments.",
    "Design an API gateway. Cover routing, auth, rate limiting, and observability.",
    "Design a logging and metrics platform. Handle ingestion, storage, and query at scale.",
    "Design a recommendation system. Cover candidate generation, ranking, and freshness.",
  ],
  "DevOps": [
    "Explain the difference between CI and CD. What tools have you used?",
    "What is infrastructure as code? Name two tools and a benefit of each.",
    "Describe how you would set up zero-downtime deployments.",
    "What is a container and how does it differ from a virtual machine?",
    "Explain the purpose of a load balancer and name two algorithms.",
    "What is blue-green deployment and when would you use it?",
    "How do you handle secrets management in a CI/CD pipeline?",
    "Describe the difference between monitoring, logging, and tracing.",
    "What is Kubernetes and what problem does it solve?",
    "Explain what a service mesh does (e.g., Istio, Linkerd).",
    "How would you design a disaster recovery plan for a critical service?",
    "What is GitOps and how does it relate to Kubernetes?",
  ],
  "Mobile": [
    "What is the difference between native and cross-platform development?",
    "Explain the mobile app lifecycle (iOS/Android).",
    "What are the main challenges in mobile app performance optimization?",
    "Describe how you handle offline-first data synchronization.",
    "What is deep linking and how do you implement it?",
    "Explain the difference between hot reload and hot restart in Flutter.",
    "How do you handle push notifications on iOS vs Android?",
    "What is app sandboxing and why does it matter for security?",
    "Describe your approach to mobile app testing (unit, UI, integration).",
    "What are the key considerations for mobile app accessibility?",
    "How do you manage app versioning and backward compatibility?",
    "Explain the role of app store review guidelines in release planning.",
  ],
  "QA": [
    "What is the difference between unit, integration, and end-to-end tests?",
    "Explain the test pyramid and why it matters.",
    "What is test-driven development (TDD) and what are its benefits?",
    "Describe how you would test a REST API.",
    "What is a flaky test and how do you handle it?",
    "Explain the difference between black-box and white-box testing.",
    "How do you approach test data management?",
    "What is contract testing and when would you use it?",
    "Describe your strategy for regression testing in a CI/CD pipeline.",
    "What is the difference between verification and validation?",
    "How do you measure test coverage and what is a good target?",
    "Explain the role of QA in a shift-left testing approach.",
  ],
  "Security": [
    "Explain the OWASP Top 10 and name three vulnerabilities.",
    "What is the difference between authentication and authorization?",
    "Describe how you would secure a REST API against common attacks.",
    "What is a JWT and what are its security considerations?",
    "Explain the difference between symmetric and asymmetric encryption.",
    "What is CSRF and how do you prevent it?",
    "Describe the principle of least privilege with an example.",
    "What is a security audit and what does it typically cover?",
    "How do you handle sensitive data in logs and error messages?",
    "Explain what a threat model is and how you create one.",
    "What is DevSecOps and how does it differ from traditional security?",
    "Describe the difference between SAST, DAST, and IAST.",
  ],
  "ML Engineering": [
    "What is the difference between batch and online inference?",
    "Explain feature store and why it's useful in ML pipelines.",
    "Describe how you would monitor model drift in production.",
    "What is A/B testing for ML models and how do you set it up?",
    "Explain the difference between model training and model serving.",
    "What is data versioning and why does it matter for ML?",
    "Describe how you handle model rollback in production.",
    "What is the difference between feature engineering and feature selection?",
    "Explain the concept of model observability.",
    "How do you ensure reproducibility in ML experiments?",
    "What is a feature pipeline and how does it differ from a training pipeline?",
    "Describe the challenges of deploying LLMs in production.",
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

// SCREENING QUESTIONS — basic qualification check (Stage 1 from Question Pipeline)
export const SCREENING_QUESTIONS = [
  "What is your highest level of education completed?",
  "How many years of professional experience do you have in your target domain?",
  "Are you legally authorized to work in the country where this role is based?",
  "What is your current notice period / availability to start?",
  "What are your salary expectations for this role?",
];

export function getScreeningQuestions(count = 3) {
  const pool = [...SCREENING_QUESTIONS];
  const out = [];
  while (out.length < count && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

// SYSTEM DESIGN EVALUATION RUBRICS — key dimensions to assess
export const SYSTEM_DESIGN_RUBRICS = {
  "requirements_clarification": {
    weight: 0.15,
    description: "Asks clarifying questions: functional/non-functional, scale, constraints",
    keywords: ["scale", "users", "qps", "latency", "availability", "consistency", "functional", "non-functional"]
  },
  "high_level_design": {
    weight: 0.20,
    description: "Draws architecture diagram, identifies major components and data flow",
    keywords: ["api", "database", "cache", "queue", "load balancer", "service", "component", "flow"]
  },
  "data_model": {
    weight: 0.15,
    description: "Defines schema, entities, relationships, and access patterns",
    keywords: ["table", "schema", "entity", "relation", "index", "primary key", "foreign key", "nosql", "document"]
  },
  "scalability": {
    weight: 0.20,
    description: "Addresses horizontal scaling, partitioning, sharding, replication",
    keywords: ["shard", "partition", "replica", "horizontal", "vertical", "scale out", "load balance"]
  },
  "reliability": {
    weight: 0.15,
    description: "Covers failure modes, redundancy, retries, circuit breakers, disaster recovery",
    keywords: ["failover", "redundant", "retry", "circuit breaker", "backup", "disaster", "recovery", "sla"]
  },
  "tradeoffs": {
    weight: 0.15,
    description: "Explicitly discusses CAP, latency vs consistency, cost vs performance",
    keywords: ["tradeoff", "cap", "consistency", "availability", "partition", "latency", "cost", "compromise"]
  },
};

export function evaluateSystemDesignAnswer(answerText) {
  const text = (answerText || "").toLowerCase();
  const scores = {};
  let totalWeighted = 0;
  let totalWeight = 0;
  
  for (const [dimension, rubric] of Object.entries(SYSTEM_DESIGN_RUBRICS)) {
    const matches = rubric.keywords.filter(k => text.includes(k)).length;
    const score = Math.min(1, matches / Math.max(2, rubric.keywords.length * 0.3));
    scores[dimension] = {
      score: Math.round(score * 100),
      matchedKeywords: rubric.keywords.filter(k => text.includes(k)),
      description: rubric.description
    };
    totalWeighted += score * rubric.weight;
    totalWeight += rubric.weight;
  }
  
  const overall = totalWeight > 0 ? Math.round((totalWeighted / totalWeight) * 100) : 0;
  return { overall, dimensions: scores };
}
