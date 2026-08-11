CALIBRATION_BANK = {
    "technical": [
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
    "hr": [
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
}

CALIBRATION_COUNT = 3


def get_calibration_questions(interview_type: str, count: int = CALIBRATION_COUNT) -> list[str]:
    bank = CALIBRATION_BANK.get(interview_type) or CALIBRATION_BANK["hr"]
    pool = list(bank)
    out = []
    while len(out) < count and pool:
        import random
        i = random.randint(0, len(pool) - 1)
        out.append(pool.pop(i))
    return out