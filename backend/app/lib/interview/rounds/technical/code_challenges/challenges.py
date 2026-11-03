from typing import Optional
from app.lib.interview.question_schema import (
    TechnicalQuestion, CodingChallenge, QuestionType, DifficultyLevel, TechnicalRole,
    ValidationRule, ValidationRuleType
)


def create_coding_challenge(
    challenge_id: str,
    role: TechnicalRole,
    title: str,
    prompt: str,
    difficulty: DifficultyLevel,
    starter_code: dict[str, str],
    function_signature: str,
    test_cases: list[dict],
    time_limit_seconds: int = 300,
    skills_tested: list[str] = None,
    reference_solution: str = None
) -> CodingChallenge:
    return CodingChallenge(
        id=challenge_id,
        role=role,
        question_type=QuestionType.CODING_CHALLENGE,
        difficulty=difficulty,
        prompt=prompt,
        skills_tested=skills_tested or [],
        reference_solution=reference_solution,
        test_cases=test_cases,
        time_limit_seconds=time_limit_seconds,
        starter_code=starter_code,
        function_signature=function_signature,
        input_format="Function parameters",
        output_format="Return value",
        validation_rules=[
            ValidationRule(
                rule_type=ValidationRuleType.LANGUAGE_ENFORCEMENT,
                parameters={'allowed_languages': ['en']},
                error_message="Please provide your solution in English.",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
        ],
        order=0
    )


# ============================================================
# JUNIOR FRONTEND CHALLENGES
# ============================================================
JUNIOR_FRONTEND_CHALLENGES = [
    create_coding_challenge(
        challenge_id="jfe_001",
        role=TechnicalRole.JUNIOR_FRONTEND,
        title="Filter and Transform Array",
        prompt="Write a function that takes an array of user objects and returns an array of names for users who are active and over 18 years old. Each user object has: { name: string, age: number, isActive: boolean }",
        difficulty=DifficultyLevel.EASY,
        starter_code={
            "javascript": "function getActiveAdultNames(users) {\n  // Your code here\n}",
            "python": "def get_active_adult_names(users):\n    # Your code here\n    pass"
        },
        function_signature="getActiveAdultNames(users: User[]): string[]",
        test_cases=[
            {"input": [{"name": "Alice", "age": 25, "isActive": True}, {"name": "Bob", "age": 17, "isActive": True}, {"name": "Charlie", "age": 30, "isActive": False}], "expected": ["Alice"]},
            {"input": [{"name": "John", "age": 20, "isActive": True}, {"name": "Jane", "age": 22, "isActive": True}], "expected": ["John", "Jane"]},
            {"input": [], "expected": []},
            {"input": [{"name": "Test", "age": 15, "isActive": False}], "expected": []}
        ],
        skills_tested=["Array methods", "Filtering", "TypeScript types"],
        reference_solution="function getActiveAdultNames(users) { return users.filter(u => u.isActive && u.age > 18).map(u => u.name); }"
    ),
    create_coding_challenge(
        challenge_id="jfe_002",
        role=TechnicalRole.JUNIOR_FRONTEND,
        title="Debounce Function",
        prompt="Implement a debounce function that delays invoking a function until after wait milliseconds have elapsed since the last time it was invoked.",
        difficulty=DifficultyLevel.MEDIUM,
        starter_code={
            "javascript": "function debounce(func, wait) {\n  // Your code here\n}",
            "python": "def debounce(func, wait):\n    # Your code here\n    pass"
        },
        function_signature="debounce(func: Function, wait: number): Function",
        test_cases=[
            {"description": "Should delay execution", "type": "behavioral"},
            {"description": "Should only execute once for rapid calls", "type": "behavioral"}
        ],
        skills_tested=["Closures", "Timers", "Function composition"],
        reference_solution="function debounce(func, wait) { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); }; }"
    ),
]


# ============================================================
# SENIOR FRONTEND CHALLENGES
# ============================================================
SENIOR_FRONTEND_CHALLENGES = [
    create_coding_challenge(
        challenge_id="sfe_001",
        role=TechnicalRole.SENIOR_FRONTEND,
        title="Virtual List Implementation",
        prompt="Implement a virtualized list component that efficiently renders only visible items from a large dataset. The component should handle dynamic item heights and smooth scrolling.",
        difficulty=DifficultyLevel.HARD,
        starter_code={
            "javascript": "class VirtualList {\n  constructor(container, items, itemHeight, renderItem) {\n    // Your code here\n  }\n}",
            "python": "# Python not typical for this challenge\n    pass"
        },
        function_signature="VirtualList(container: HTMLElement, items: T[], itemHeight: number | ((index: number) => number), renderItem: (item: T, index: number) => HTMLElement)",
        test_cases=[
            {"description": "Renders only visible items", "type": "behavioral"},
            {"description": "Handles scroll efficiently", "type": "behavioral"},
            {"description": "Supports dynamic heights", "type": "behavioral"}
        ],
        skills_tested=["DOM optimization", "Scroll events", "Memory management", "Performance"],
        reference_solution="// Implementation would use IntersectionObserver or scroll position calculation"
    ),
]


# ============================================================
# JUNIOR BACKEND CHALLENGES
# ============================================================
JUNIOR_BACKEND_CHALLENGES = [
    create_coding_challenge(
        challenge_id="jbe_001",
        role=TechnicalRole.JUNIOR_BACKEND,
        title="User Registration API",
        prompt="Write a function that validates user registration data. It should check: email format, password strength (min 8 chars, 1 uppercase, 1 lowercase, 1 number), and that passwords match. Return validation errors or success.",
        difficulty=DifficultyLevel.EASY,
        starter_code={
            "javascript": "function validateRegistration(data) {\n  // Your code here\n}",
            "python": "def validate_registration(data):\n    # Your code here\n    pass"
        },
        function_signature="validateRegistration(data: {email: string, password: string, confirmPassword: string}): {valid: boolean, errors: string[]}",
        test_cases=[
            {"input": {"email": "test@example.com", "password": "Password123", "confirmPassword": "Password123"}, "expected": {"valid": True, "errors": []}},
            {"input": {"email": "invalid", "password": "Password123", "confirmPassword": "Password123"}, "expected": {"valid": False, "errors": ["Invalid email format"]}},
            {"input": {"email": "test@example.com", "password": "weak", "confirmPassword": "weak"}, "expected": {"valid": False, "errors": ["Password too weak"]}},
            {"input": {"email": "test@example.com", "password": "Password123", "confirmPassword": "Different123"}, "expected": {"valid": False, "errors": ["Passwords do not match"]}}
        ],
        skills_tested=["Validation", "Regex", "Error handling"],
        reference_solution="function validateRegistration(data) { const errors = []; if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(data.email)) errors.push('Invalid email format'); if (data.password.length < 8 || !/[A-Z]/.test(data.password) || !/[a-z]/.test(data.password) || !/[0-9]/.test(data.password)) errors.push('Password too weak'); if (data.password !== data.confirmPassword) errors.push('Passwords do not match'); return { valid: errors.length === 0, errors }; }"
    ),
    create_coding_challenge(
        challenge_id="jbe_002",
        role=TechnicalRole.JUNIOR_BACKEND,
        title="Pagination Helper",
        prompt="Create a pagination helper function that takes total items, current page, and page size, and returns pagination metadata including total pages, hasNext, hasPrev, startIndex, endIndex.",
        difficulty=DifficultyLevel.EASY,
        starter_code={
            "javascript": "function paginate(totalItems, currentPage, pageSize) {\n  // Your code here\n}",
            "python": "def paginate(total_items, current_page, page_size):\n    # Your code here\n    pass"
        },
        function_signature="paginate(totalItems: number, currentPage: number, pageSize: number): PaginationMeta",
        test_cases=[
            {"input": {"totalItems": 100, "currentPage": 1, "pageSize": 10}, "expected": {"totalPages": 10, "hasNext": True, "hasPrev": False, "startIndex": 0, "endIndex": 9}},
            {"input": {"totalItems": 100, "currentPage": 10, "pageSize": 10}, "expected": {"totalPages": 10, "hasNext": False, "hasPrev": True, "startIndex": 90, "endIndex": 99}},
            {"input": {"totalItems": 0, "currentPage": 1, "pageSize": 10}, "expected": {"totalPages": 0, "hasNext": False, "hasPrev": False, "startIndex": 0, "endIndex": -1}}
        ],
        skills_tested=["Math", "Edge cases", "API design"],
        reference_solution="function paginate(totalItems, currentPage, pageSize) { const totalPages = Math.ceil(totalItems / pageSize); const startIndex = (currentPage - 1) * pageSize; const endIndex = Math.min(startIndex + pageSize - 1, totalItems - 1); return { totalPages, hasNext: currentPage < totalPages, hasPrev: currentPage > 1, startIndex, endIndex }; }"
    ),
]


# ============================================================
# SENIOR BACKEND CHALLENGES
# ============================================================
SENIOR_BACKEND_CHALLENGES = [
    create_coding_challenge(
        challenge_id="sbe_001",
        role=TechnicalRole.SENIOR_BACKEND,
        title="Rate Limiter Implementation",
        prompt="Implement a token bucket rate limiter that allows up to N requests per time window. The implementation should be thread-safe and support multiple keys (e.g., per user/IP).",
        difficulty=DifficultyLevel.HARD,
        starter_code={
            "javascript": "class TokenBucketRateLimiter {\n  constructor(capacity, refillRate) {\n    // Your code here\n  }\n  \n  async consume(key, tokens = 1) {\n    // Your code here\n  }\n}",
            "python": "import threading\nimport time\n\nclass TokenBucketRateLimiter:\n    def __init__(self, capacity, refill_rate):\n        # Your code here\n        pass\n    \n    def consume(self, key, tokens=1):\n        # Your code here\n        pass"
        },
        function_signature="TokenBucketRateLimiter(capacity: number, refillRate: number).consume(key: string, tokens?: number): Promise<boolean>",
        test_cases=[
            {"description": "Allows burst up to capacity", "type": "behavioral"},
            {"description": "Refills tokens over time", "type": "behavioral"},
            {"description": "Thread-safe for concurrent access", "type": "behavioral"},
            {"description": "Separate buckets per key", "type": "behavioral"}
        ],
        skills_tested=["Concurrency", "Data structures", "Time complexity", "Thread safety"],
        reference_solution="// Thread-safe implementation using locks or atomic operations"
    ),
]


# ============================================================
# FULLSTACK CHALLENGES
# ============================================================
FULLSTACK_CHALLENGES = [
    create_coding_challenge(
        challenge_id="fs_001",
        role=TechnicalRole.FULLSTACK,
        title="Real-time Chat Message Sync",
        prompt="Design a function that synchronizes chat messages between client and server. Handle optimistic updates, conflict resolution, and offline queue. Return the sync state.",
        difficulty=DifficultyLevel.MEDIUM,
        starter_code={
            "javascript": "function syncMessages(localMessages, serverMessages, pendingOutgoing) {\n  // Your code here\n}",
            "python": "def sync_messages(local_messages, server_messages, pending_outgoing):\n    # Your code here\n    pass"
        },
        function_signature="syncMessages(local: Message[], server: Message[], pending: Message[]): {synced: Message[], pending: Message[], conflicts: Message[]}",
        test_cases=[
            {"description": "Merges local and server messages", "type": "behavioral"},
            {"description": "Resolves conflicts by timestamp", "type": "behavioral"},
            {"description": "Preserves pending outgoing", "type": "behavioral"}
        ],
        skills_tested=["State sync", "Conflict resolution", "Offline-first"],
        reference_solution="// Merge by ID, use timestamp for conflicts, preserve pending"
    ),
]


# ============================================================
# DEVOPS CHALLENGES
# ============================================================
DEVOPS_CHALLENGES = [
    create_coding_challenge(
        challenge_id="do_001",
        role=TechnicalRole.DEVOPS,
        title="Infrastructure Health Check",
        prompt="Write a script that checks the health of multiple services (HTTP endpoints, databases, caches) and returns a summary. Support configurable timeouts, retries, and alerting thresholds.",
        difficulty=DifficultyLevel.MEDIUM,
        starter_code={
            "javascript": "async function healthCheck(services, options = {}) {\n  // Your code here\n}",
            "python": "async def health_check(services, options={}):\n    # Your code here\n    pass"
        },
        function_signature="healthCheck(services: ServiceConfig[], options?: HealthCheckOptions): Promise<HealthReport>",
        test_cases=[
            {"description": "Checks HTTP endpoints", "type": "behavioral"},
            {"description": "Handles timeouts gracefully", "type": "behavioral"},
            {"description": "Returns structured report", "type": "behavioral"}
        ],
        skills_tested=["Async programming", "Error handling", "Monitoring", "Configuration"],
        reference_solution="// Parallel checks with Promise.allSettled, timeout handling, structured output"
    ),
]


# ============================================================
# ALL CHALLENGES MAP
# ============================================================
ALL_CHALLENGES = {
    TechnicalRole.JUNIOR_FRONTEND: JUNIOR_FRONTEND_CHALLENGES,
    TechnicalRole.SENIOR_FRONTEND: SENIOR_FRONTEND_CHALLENGES,
    TechnicalRole.JUNIOR_BACKEND: JUNIOR_BACKEND_CHALLENGES,
    TechnicalRole.SENIOR_BACKEND: SENIOR_BACKEND_CHALLENGES,
    TechnicalRole.FULLSTACK: FULLSTACK_CHALLENGES,
    TechnicalRole.DEVOPS: DEVOPS_CHALLENGES,
    TechnicalRole.MOBILE: [],
    TechnicalRole.ML_AI: [],
    TechnicalRole.QA_TEST: [],
    TechnicalRole.DATA_ENGINEER: [],
    TechnicalRole.SECURITY: [],
    TechnicalRole.ENGINEERING_MANAGER: [],
}


def get_challenges_for_role(role: TechnicalRole) -> list[CodingChallenge]:
    return ALL_CHALLENGES.get(role, [])


def get_challenge_by_id(challenge_id: str) -> Optional[CodingChallenge]:
    for challenges in ALL_CHALLENGES.values():
        for c in challenges:
            if c.id == challenge_id:
                return c
    return None


def get_all_challenges() -> list[CodingChallenge]:
    all_challenges = []
    for challenges in ALL_CHALLENGES.values():
        all_challenges.extend(challenges)
    return all_challenges