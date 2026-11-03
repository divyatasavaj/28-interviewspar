from app.lib.interview.question_schema import (
    HRQuestion, QuestionType, DifficultyLevel, ValidationRule, ValidationRuleType
)


HR_QUESTIONS = [
    HRQuestion(
        id="hr_001",
        question_type=QuestionType.BASIC_INFO,
        difficulty=DifficultyLevel.EASY,
        prompt="Welcome! To get started, could you please tell me your full name?",
        expected_format="First Last",
        validation_rules=[
            ValidationRule(
                rule_type=ValidationRuleType.LANGUAGE_ENFORCEMENT,
                parameters={'allowed_languages': ['en']},
                error_message="Please respond in English. Your answer appears to be in another language.",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
            ValidationRule(
                rule_type=ValidationRuleType.RELEVANCE_CHECK,
                parameters={'threshold': 0.3},
                error_message="That doesn't appear to be a name. Please provide your full name.",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
            ValidationRule(
                rule_type=ValidationRuleType.COMPLETENESS_CHECK,
                parameters={'expected_fields': ['name'], 'min_words': 2},
                error_message="Please provide your full name (first and last name).",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
        ],
        order=1
    ),
    HRQuestion(
        id="hr_002",
        question_type=QuestionType.BASIC_INFO,
        difficulty=DifficultyLevel.EASY,
        prompt="Thank you! What is your email address?",
        expected_format="user@domain.com",
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
                parameters={'threshold': 0.3},
                error_message="That doesn't appear to be an email address. Please provide a valid email.",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
            ValidationRule(
                rule_type=ValidationRuleType.COMPLETENESS_CHECK,
                parameters={'expected_fields': ['email'], 'min_words': 1},
                error_message="Please provide your email address.",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
        ],
        order=2
    ),
    HRQuestion(
        id="hr_003",
        question_type=QuestionType.BASIC_INFO,
        difficulty=DifficultyLevel.EASY,
        prompt="What is your phone number?",
        expected_format="+1-XXX-XXX-XXXX or similar format",
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
                rule_type=ValidationRuleType.COMPLETENESS_CHECK,
                parameters={'expected_fields': ['phone'], 'min_words': 1},
                error_message="Please provide your phone number.",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
        ],
        order=3
    ),
    HRQuestion(
        id="hr_004",
        question_type=QuestionType.BASIC_INFO,
        difficulty=DifficultyLevel.EASY,
        prompt="Which city and country are you currently based in?",
        expected_format="City, Country",
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
                parameters={'threshold': 0.3},
                error_message="Please provide a location (city and country).",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
            ValidationRule(
                rule_type=ValidationRuleType.COMPLETENESS_CHECK,
                parameters={'expected_fields': ['location'], 'min_words': 2},
                error_message="Please provide both city and country.",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
        ],
        order=4
    ),
    HRQuestion(
        id="hr_005",
        question_type=QuestionType.BASIC_INFO,
        difficulty=DifficultyLevel.EASY,
        prompt="How many years of professional experience do you have?",
        expected_format="Number (e.g., 3 years, 5 years)",
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
                parameters={'threshold': 0.3},
                error_message="Please provide a number representing years of experience.",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
            ValidationRule(
                rule_type=ValidationRuleType.COMPLETENESS_CHECK,
                parameters={'expected_fields': ['experience_years'], 'min_words': 1},
                error_message="Please provide your years of experience.",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
        ],
        order=5
    ),
    HRQuestion(
        id="hr_006",
        question_type=QuestionType.BEHAVIORAL,
        difficulty=DifficultyLevel.MEDIUM,
        prompt="Can you walk me through your most recent role and your key responsibilities?",
        expected_format="Detailed description of role, company, and responsibilities",
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
                parameters={'threshold': 0.4},
                error_message="Please describe your recent role and responsibilities.",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
            ValidationRule(
                rule_type=ValidationRuleType.COMPLETENESS_CHECK,
                parameters={'expected_fields': ['company', 'role'], 'min_words': 20},
                error_message="Please provide more details about your role, company, and responsibilities.",
                severity="warning",
                retry_allowed=True,
                max_retries=2
            ),
        ],
        order=6
    ),
    HRQuestion(
        id="hr_007",
        question_type=QuestionType.BEHAVIORAL,
        difficulty=DifficultyLevel.MEDIUM,
        prompt="What are your top 3 technical skills or areas of expertise?",
        expected_format="List of 3 skills with brief description of proficiency",
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
                parameters={'threshold': 0.3},
                error_message="Please list your technical skills.",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
            ValidationRule(
                rule_type=ValidationRuleType.COMPLETENESS_CHECK,
                parameters={'expected_fields': ['technology'], 'min_words': 10},
                error_message="Please provide at least 3 technical skills.",
                severity="warning",
                retry_allowed=True,
                max_retries=2
            ),
        ],
        order=7
    ),
    HRQuestion(
        id="hr_008",
        question_type=QuestionType.BEHAVIORAL,
        difficulty=DifficultyLevel.MEDIUM,
        prompt="Describe a challenging project you worked on. What was the challenge and how did you overcome it?",
        expected_format="STAR format: Situation, Task, Action, Result",
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
                parameters={'threshold': 0.4},
                error_message="Please describe a specific project and the challenge you faced.",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
            ValidationRule(
                rule_type=ValidationRuleType.COMPLETENESS_CHECK,
                parameters={'expected_fields': ['project_name', 'description'], 'min_words': 30},
                error_message="Please provide more details using the STAR format (Situation, Task, Action, Result).",
                severity="warning",
                retry_allowed=True,
                max_retries=2
            ),
        ],
        order=8
    ),
    HRQuestion(
        id="hr_009",
        question_type=QuestionType.BEHAVIORAL,
        difficulty=DifficultyLevel.MEDIUM,
        prompt="How do you handle tight deadlines or conflicting priorities?",
        expected_format="Description of approach with example",
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
                parameters={'threshold': 0.3},
                error_message="Please describe your approach to handling deadlines and priorities.",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
            ValidationRule(
                rule_type=ValidationRuleType.COMPLETENESS_CHECK,
                parameters={'min_words': 15},
                error_message="Please provide a more detailed answer with an example.",
                severity="warning",
                retry_allowed=True,
                max_retries=2
            ),
        ],
        order=9
    ),
    HRQuestion(
        id="hr_010",
        question_type=QuestionType.BEHAVIORAL,
        difficulty=DifficultyLevel.MEDIUM,
        prompt="Where do you see yourself in 3 years? What are your career goals?",
        expected_format="Career goals and aspirations",
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
                parameters={'threshold': 0.3},
                error_message="Please share your career goals and aspirations.",
                severity="error",
                retry_allowed=True,
                max_retries=2
            ),
            ValidationRule(
                rule_type=ValidationRuleType.COMPLETENESS_CHECK,
                parameters={'min_words': 15},
                error_message="Please provide more details about your career goals.",
                severity="warning",
                retry_allowed=True,
                max_retries=2
            ),
        ],
        order=10
    ),
]


def get_hr_questions() -> list[HRQuestion]:
    return list(HR_QUESTIONS)


def get_hr_question_by_id(question_id: str) -> HRQuestion | None:
    for q in HR_QUESTIONS:
        if q.id == question_id:
            return q
    return None