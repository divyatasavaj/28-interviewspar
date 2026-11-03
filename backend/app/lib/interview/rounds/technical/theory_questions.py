from app.lib.interview.question_schema import (
    TechnicalQuestion, QuestionType, DifficultyLevel, TechnicalRole,
    ValidationRule, ValidationRuleType
)


def create_technical_question(
    qid: str,
    role: TechnicalRole,
    prompt: str,
    difficulty: DifficultyLevel,
    qtype: QuestionType,
    skills_tested: list[str],
    expected_keywords: list[str] = None,
    reference_answer: str = None
) -> TechnicalQuestion:
    return TechnicalQuestion(
        id=qid,
        role=role,
        question_type=qtype,
        difficulty=difficulty,
        prompt=prompt,
        skills_tested=skills_tested,
        reference_solution=reference_answer,
        validation_rules=[
            ValidationRule(
                rule_type=ValidationRuleType.LANGUAGE_ENFORCEMENT,
                parameters={'allowed_languages': ['en']},
                error_message="Please respond in English.",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
            ValidationRule(
                rule_type=ValidationRuleType.RELEVANCE_CHECK,
                parameters={'threshold': 0.35, 'expected_keywords': expected_keywords or []},
                error_message="Your answer doesn't address the technical question. Please focus on the key concepts.",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
            ValidationRule(
                rule_type=ValidationRuleType.COMPLETENESS_CHECK,
                parameters={'min_words': 30},
                error_message="Please provide a more detailed technical answer.",
                severity="warning",
                retry_allowed=True,
                max_retries=2
            ),
        ],
        order=0
    )


# ============================================================
# JUNIOR FRONTEND THEORY QUESTIONS
# ============================================================
JUNIOR_FRONTEND_QUESTIONS = [
    create_technical_question(
        qid="jfe_q01",
        role=TechnicalRole.JUNIOR_FRONTEND,
        prompt="Explain the difference between `let`, `const`, and `var` in JavaScript. When would you use each?",
        difficulty=DifficultyLevel.EASY,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["JavaScript fundamentals", "Scope", "Hoisting"],
        expected_keywords=["scope", "hoisting", "block", "function", "reassign", "constant"],
        reference_answer="var is function-scoped and hoisted. let and const are block-scoped. const cannot be reassigned. Use const by default, let when reassignment needed, avoid var."
    ),
    create_technical_question(
        qid="jfe_q02",
        role=TechnicalRole.JUNIOR_FRONTEND,
        prompt="What is the Virtual DOM in React? How does it improve performance?",
        difficulty=DifficultyLevel.EASY,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["React", "Virtual DOM", "Reconciliation"],
        expected_keywords=["virtual dom", "reconciliation", "diffing", "render", "performance", "batch"],
        reference_answer="Virtual DOM is a lightweight copy of the real DOM. React uses it to compute minimal changes (diffing) and batch updates, reducing expensive DOM operations."
    ),
    create_technical_question(
        qid="jfe_q03",
        role=TechnicalRole.JUNIOR_FRONTEND,
        prompt="Explain the difference between props and state in React. When does a component re-render?",
        difficulty=DifficultyLevel.EASY,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["React", "Props", "State", "Lifecycle"],
        expected_keywords=["props", "state", "immutable", "mutable", "re-render", "parent", "child", "setState"],
        reference_answer="Props are immutable inputs from parent. State is mutable internal data. Component re-renders when state changes, parent re-renders, or props change."
    ),
    create_technical_question(
        qid="jfe_q04",
        role=TechnicalRole.JUNIOR_FRONTEND,
        prompt="What are React Hooks? Explain useState, useEffect, and useContext with examples.",
        difficulty=DifficultyLevel.MEDIUM,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["React Hooks", "State management", "Side effects", "Context"],
        expected_keywords=["hook", "useState", "useEffect", "useContext", "dependency", "cleanup", "provider"],
        reference_answer="Hooks let you use state and lifecycle in functional components. useState manages state. useEffect handles side effects with cleanup. useContext consumes context values."
    ),
    create_technical_question(
        qid="jfe_q05",
        role=TechnicalRole.JUNIOR_FRONTEND,
        prompt="How does CSS Flexbox differ from CSS Grid? When would you use each?",
        difficulty=DifficultyLevel.MEDIUM,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["CSS", "Flexbox", "Grid", "Layout"],
        expected_keywords=["flexbox", "grid", "one-dimensional", "two-dimensional", "axis", "alignment", "gap"],
        reference_answer="Flexbox is one-dimensional (row or column). Grid is two-dimensional (rows and columns). Use Flexbox for simple alignment, Grid for complex layouts."
    ),
]


# ============================================================
# SENIOR FRONTEND THEORY QUESTIONS
# ============================================================
SENIOR_FRONTEND_QUESTIONS = [
    create_technical_question(
        qid="sfe_q01",
        role=TechnicalRole.SENIOR_FRONTEND,
        prompt="Explain React's reconciliation algorithm (Fiber). How does it enable concurrent rendering?",
        difficulty=DifficultyLevel.HARD,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["React internals", "Fiber", "Concurrent mode", "Scheduling"],
        expected_keywords=["fiber", "reconciliation", "work", "priority", "interrupt", "concurrent", "scheduler", "lane"],
        reference_answer="Fiber breaks rendering into units of work with priorities. Scheduler can interrupt, pause, resume work. Enables concurrent features like Suspense, useTransition."
    ),
    create_technical_question(
        qid="sfe_q02",
        role=TechnicalRole.SENIOR_FRONTEND,
        prompt="Compare state management solutions: Redux, Zustand, Jotai, React Context. When to use each?",
        difficulty=DifficultyLevel.MEDIUM,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["State management", "Architecture", "Performance", "DX"],
        expected_keywords=["redux", "zustand", "jotai", "context", "boilerplate", "selector", "atomic", "global"],
        reference_answer="Redux: large apps, devtools, middleware. Zustand: simple, minimal boilerplate. Jotai: atomic, fine-grained. Context: low-frequency, simple state. Avoid Context for high-frequency updates."
    ),
    create_technical_question(
        qid="sfe_q03",
        role=TechnicalRole.SENIOR_FRONTEND,
        prompt="How would you optimize a React application with performance issues? List specific techniques and tools.",
        difficulty=DifficultyLevel.HARD,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["Performance", "Profiling", "Optimization", "Bundle analysis"],
        expected_keywords=["memo", "useMemo", "useCallback", "lazy", "suspense", "profiler", "bundle", "codesplit", "virtualize"],
        reference_answer="Profile with React DevTools Profiler. Use React.memo, useMemo, useCallback. Code-split with lazy/Suspense. Virtualize lists. Optimize bundle size. Avoid inline functions/objects in render."
    ),
]


# ============================================================
# JUNIOR BACKEND THEORY QUESTIONS
# ============================================================
JUNIOR_BACKEND_QUESTIONS = [
    create_technical_question(
        qid="jbe_q01",
        role=TechnicalRole.JUNIOR_BACKEND,
        prompt="Explain the difference between SQL and NoSQL databases. When would you choose each?",
        difficulty=DifficultyLevel.EASY,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["Databases", "SQL", "NoSQL", "Data modeling"],
        expected_keywords=["relational", "non-relational", "schema", "acid", "base", "scalability", "joins", "document"],
        reference_answer="SQL: relational, schema, ACID, complex queries, joins. NoSQL: flexible schema, horizontal scaling, eventual consistency (BASE), document/key-value/graph. Choose SQL for consistency, NoSQL for scale/flexibility."
    ),
    create_technical_question(
        qid="jbe_q02",
        role=TechnicalRole.JUNIOR_BACKEND,
        prompt="What is REST? Explain the main HTTP methods and status codes.",
        difficulty=DifficultyLevel.EASY,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["REST API", "HTTP", "Status codes"],
        expected_keywords=["rest", "get", "post", "put", "patch", "delete", "200", "201", "400", "404", "500", "idempotent"],
        reference_answer="REST: architectural style for APIs. GET: retrieve, POST: create, PUT: replace, PATCH: partial update, DELETE: remove. 200 OK, 201 Created, 400 Bad Request, 404 Not Found, 500 Server Error."
    ),
    create_technical_question(
        qid="jbe_q03",
        role=TechnicalRole.JUNIOR_BACKEND,
        prompt="Explain database indexing. How does a B-tree index work? What are the trade-offs?",
        difficulty=DifficultyLevel.MEDIUM,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["Databases", "Indexing", "B-tree", "Performance"],
        expected_keywords=["index", "b-tree", "lookup", "logarithmic", "write", "overhead", "composite", "covering"],
        reference_answer="B-tree provides O(log n) lookups by maintaining sorted tree structure. Trade-offs: faster reads, slower writes (index maintenance), storage overhead. Composite indexes for multi-column queries."
    ),
    create_technical_question(
        qid="jbe_q04",
        role=TechnicalRole.JUNIOR_BACKEND,
        prompt="What is JWT? How does it work? What are the security considerations?",
        difficulty=DifficultyLevel.MEDIUM,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["Authentication", "JWT", "Security", "Tokens"],
        expected_keywords=["jwt", "header", "payload", "signature", "secret", "expiration", "refresh", "https", "xss", "csrf"],
        reference_answer="JWT: JSON Web Token with header, payload, signature. Stateless auth. Security: use HTTPS, short expiration, secure secret, validate signature, avoid sensitive data in payload, implement refresh tokens."
    ),
]


# ============================================================
# SENIOR BACKEND THEORY QUESTIONS
# ============================================================
SENIOR_BACKEND_QUESTIONS = [
    create_technical_question(
        qid="sbe_q01",
        role=TechnicalRole.SENIOR_BACKEND,
        prompt="Design a distributed rate limiter for a microservices architecture. Consider consistency, latency, and failure modes.",
        difficulty=DifficultyLevel.HARD,
        qtype=QuestionType.SYSTEM_DESIGN,
        skills_tested=["Distributed systems", "Rate limiting", "Consistency", "Architecture"],
        expected_keywords=["token bucket", "sliding window", "redis", "consistent hashing", "local cache", "fallback", "latency"],
        reference_answer="Use Redis with sliding window log or token bucket. Local in-memory cache for latency. Consistent hashing for sharding. Fallback to local limiting if Redis unavailable. Consider eventual consistency trade-offs."
    ),
    create_technical_question(
        qid="sbe_q02",
        role=TechnicalRole.SENIOR_BACKEND,
        prompt="Explain the CAP theorem. How do you choose between consistency and availability in practice?",
        difficulty=DifficultyLevel.HARD,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["CAP theorem", "Distributed systems", "Trade-offs", "Architecture"],
        expected_keywords=["consistency", "availability", "partition tolerance", "cp", "ap", "eventual", "strong", "quorum", "raft", "paxos"],
        reference_answer="CAP: can only guarantee 2 of 3. In practice, partitions are rare. Choose CP for financial data (strong consistency). Choose AP for high availability (eventual consistency). Use quorum reads/writes for balance."
    ),
    create_technical_question(
        qid="sbe_q03",
        role=TechnicalRole.SENIOR_BACKEND,
        prompt="How would you design a system to handle 1M requests/second with sub-100ms latency? Discuss caching, database, and architecture patterns.",
        difficulty=DifficultyLevel.HARD,
        qtype=QuestionType.SYSTEM_DESIGN,
        skills_tested=["High scale", "Caching", "Database", "Architecture", "Latency"],
        expected_keywords=["cache", "redis", "cdn", "read replica", "sharding", "async", "queue", "load balancer", "stateless"],
        reference_answer="Multi-layer caching (CDN, Redis, local). Read replicas for DB. Async processing with queues. Stateless services for horizontal scaling. Connection pooling. Database sharding. Monitor p99 latency."
    ),
]


# ============================================================
# FULLSTACK THEORY QUESTIONS
# ============================================================
FULLSTACK_QUESTIONS = [
    create_technical_question(
        qid="fs_q01",
        role=TechnicalRole.FULLSTACK,
        prompt="How do you handle authentication in a fullstack app? Compare session-based vs token-based approaches.",
        difficulty=DifficultyLevel.MEDIUM,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["Authentication", "Sessions", "JWT", "Security"],
        expected_keywords=["session", "cookie", "jwt", "token", "csrf", "xss", "httponly", "secure", "refresh", "stateless"],
        reference_answer="Sessions: server-side, cookies, CSRF protection needed. JWT: stateless, scalable, but token revocation harder. Use short-lived access tokens + refresh tokens. HttpOnly, Secure, SameSite cookies."
    ),
    create_technical_question(
        qid="fs_q02",
        role=TechnicalRole.FULLSTACK,
        prompt="Explain the differences between SSR, SSG, and CSR. When would you use each in a Next.js application?",
        difficulty=DifficultyLevel.MEDIUM,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["Rendering", "Next.js", "Performance", "SEO"],
        expected_keywords=["ssr", "ssg", "csr", "getServerSideProps", "getStaticProps", "seo", "ttfb", "hydration", "isr"],
        reference_answer="CSR: client renders, good for dashboards. SSR: server renders each request, good for dynamic SEO. SSG: build-time, fastest, good for static content. ISR: incremental static regeneration. Next.js supports all."
    ),
]


# ============================================================
# DEVOPS THEORY QUESTIONS
# ============================================================
DEVOPS_QUESTIONS = [
    create_technical_question(
        qid="do_q01",
        role=TechnicalRole.DEVOPS,
        prompt="Explain the difference between Docker and Kubernetes. How do they work together?",
        difficulty=DifficultyLevel.MEDIUM,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["Docker", "Kubernetes", "Containerization", "Orchestration"],
        expected_keywords=["docker", "container", "image", "kubernetes", "pod", "service", "deployment", "orchestration", "scaling"],
        reference_answer="Docker: container runtime, builds images. Kubernetes: orchestrates containers (pods), handles scaling, networking, storage, self-healing. Docker builds, K8s runs."
    ),
    create_technical_question(
        qid="do_q02",
        role=TechnicalRole.DEVOPS,
        prompt="What is Infrastructure as Code (IaC)? Compare Terraform, CloudFormation, and Pulumi.",
        difficulty=DifficultyLevel.MEDIUM,
        qtype=QuestionType.TECHNICAL_THEORY,
        skills_tested=["IaC", "Terraform", "CloudFormation", "Pulumi", "DevOps"],
        expected_keywords=["iac", "terraform", "cloudformation", "pulumi", "state", "declarative", "imperative", "hcl", "provider"],
        reference_answer="IaC: manage infrastructure via code. Terraform: declarative, HCL, multi-cloud, state file. CloudFormation: AWS-only, JSON/YAML. Pulumi: imperative, general-purpose languages (TS/Python/Go)."
    ),
]


# ============================================================
# ALL THEORY QUESTIONS MAP
# ============================================================
ALL_THEORY_QUESTIONS = {
    TechnicalRole.JUNIOR_FRONTEND: JUNIOR_FRONTEND_QUESTIONS,
    TechnicalRole.SENIOR_FRONTEND: SENIOR_FRONTEND_QUESTIONS,
    TechnicalRole.JUNIOR_BACKEND: JUNIOR_BACKEND_QUESTIONS,
    TechnicalRole.SENIOR_BACKEND: SENIOR_BACKEND_QUESTIONS,
    TechnicalRole.FULLSTACK: FULLSTACK_QUESTIONS,
    TechnicalRole.DEVOPS: DEVOPS_QUESTIONS,
    TechnicalRole.MOBILE: [],
    TechnicalRole.ML_AI: [],
    TechnicalRole.QA_TEST: [],
    TechnicalRole.DATA_ENGINEER: [],
    TechnicalRole.SECURITY: [],
    TechnicalRole.ENGINEERING_MANAGER: [],
}


def get_theory_questions_for_role(role: TechnicalRole) -> list[TechnicalQuestion]:
    return ALL_THEORY_QUESTIONS.get(role, [])


def get_all_theory_questions() -> list[TechnicalQuestion]:
    all_q = []
    for questions in ALL_THEORY_QUESTIONS.values():
        all_q.extend(questions)
    return all_q