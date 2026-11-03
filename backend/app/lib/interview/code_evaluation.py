import os
import json
import asyncio

import re
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

from groq import Groq


class Language(str, Enum):
    JAVASCRIPT = "javascript"
    PYTHON = "python"
    TYPESCRIPT = "typescript"
    JAVA = "java"
    GO = "go"
    CPP = "cpp"


class ExecutionStatus(str, Enum):
    SUCCESS = "success"
    COMPILATION_ERROR = "compilation_error"
    RUNTIME_ERROR = "runtime_error"
    TIMEOUT = "timeout"
    MEMORY_LIMIT_EXCEEDED = "memory_limit_exceeded"


@dataclass
class TestCase:
    input: Any
    expected_output: Any
    description: str = ""


@dataclass
class ExecutionResult:
    status: ExecutionStatus
    stdout: str = ""
    stderr: str = ""
    execution_time_ms: float = 0
    memory_used_mb: float = 0
    passed: int = 0
    total: int = 0
    test_results: List[Dict] = None
    error_message: str = ""


@dataclass
class CodeEvaluation:
    execution_result: ExecutionResult
    ai_review: Optional[Dict] = None
    overall_score: float = 0.0
    correctness_score: float = 0.0
    complexity_score: float = 0.0
    style_score: float = 0.0
    edge_case_score: float = 0.0
    feedback: str = ""
    suggestions: List[str] = None


class CodeExecutor:
    """Compatibility adapter for the isolated execution service; never executes locally."""
    def __init__(self, timeout_seconds=10, memory_limit_mb=256):
        self.timeout_seconds=timeout_seconds
        self.memory_limit_mb=memory_limit_mb

    def execute(self, code, language, test_cases, function_signature=None):
        from app.safe_execution import execute_cases
        signature=function_signature or "solve()"
        match=re.search(r"(?:function\s+|def\s+)?([A-Za-z_]\w*)\s*\(", signature)
        name=match.group(1) if match else "solve"
        # v2 banks describe one structured input per case. Unsupported descriptive tests fail closed.
        cases=[{"args": [tc.input], "expected": tc.expected_output} for tc in test_cases]
        result=execute_cases(code,language.value,cases,name)
        return ExecutionResult(status=ExecutionStatus.SUCCESS if result["status"]=="evaluated" else ExecutionStatus.RUNTIME_ERROR,
            passed=result["passed"], total=result["total"], test_results=result["results"],
            error_message=result.get("message", ""))


class AICodeReviewer:
    """Uses LLM to review code quality"""
    
    def __init__(self):
        self.client = Groq(api_key=os.environ["GROQ_API_KEY"], timeout=12, max_retries=0) if os.environ.get("GROQ_API_KEY") else None
        self.model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
    
    def review_code(
        self, 
        code: str, 
        language: Language, 
        problem_description: str,
        test_results: List[Dict],
        function_signature: str = None
    ) -> Dict:
        """Review code and return quality assessment"""
        
        passed_tests = sum(1 for r in test_results if r.get('passed', False))
        total_tests = len(test_results)
        
        prompt = f"""You are an expert code reviewer. Analyze the following code submission.

**Problem:** {problem_description}

**Language:** {language.value}

**Function Signature:** {function_signature or 'Not provided'}

**Code:**
```{language.value}
{code}
```

**Test Results:** {passed_tests}/{total_tests} passed
{json.dumps(test_results, indent=2)}

Provide a JSON response with:
1. correctness_score (0-100): Based on test results and logic correctness
2. complexity_score (0-100): Time/space complexity appropriateness
3. style_score (0-100): Code readability, naming, structure
4. edge_case_score (0-100): Handling of edge cases
5. overall_score (0-100): Weighted average (correctness: 40%, complexity: 20%, style: 20%, edge_cases: 20%)
6. feedback: Detailed constructive feedback
7. suggestions: Array of specific improvement suggestions
8. strengths: Array of what was done well

Return ONLY valid JSON, no markdown."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=2000
            )
            
            content = response.choices[0].message.content.strip()
            content = content.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            
            return json.loads(content)
        except Exception as e:
            return {
                "correctness_score": 0,
                "complexity_score": 0,
                "style_score": 0,
                "edge_case_score": 0,
                "overall_score": 0,
                "feedback": "AI review unavailable; no quality score assigned.",
                "suggestions": ["Unable to perform AI review"],
                "strengths": []
            }


class CodeEvaluator:
    """Main evaluator combining execution and AI review"""
    
    def __init__(self):
        self.executor = CodeExecutor()
        self.reviewer = AICodeReviewer()
    
    def evaluate(
        self,
        code: str,
        language: Language,
        challenge,
        test_cases: List[TestCase] = None
    ) -> CodeEvaluation:
        """Evaluate code submission"""
        
        # Use challenge's test cases if not provided
        if test_cases is None:
            test_cases = [
                TestCase(input=tc.get('input'), expected_output=tc.get('expected'), description=tc.get('description', ''))
                for tc in challenge.test_cases
            ]
        
        # Execute code
        execution_result = self.executor.execute(code, language, test_cases, challenge.function_signature)
        
        # AI review if execution successful
        ai_review = None
        if execution_result.status == ExecutionStatus.SUCCESS:
            ai_review = self.reviewer.review_code(
                code=code,
                language=language,
                problem_description=challenge.prompt,
                test_results=execution_result.test_results or [],
                function_signature=challenge.function_signature
            )
        
        # Calculate scores
        correctness_score = (execution_result.passed / execution_result.total * 100) if execution_result.total > 0 else 0
        
        if ai_review:
            complexity_score = ai_review.get('complexity_score', 0)
            style_score = ai_review.get('style_score', 0)
            edge_case_score = ai_review.get('edge_case_score', 0)
            overall_score = ai_review.get('overall_score', 0)
            feedback = ai_review.get('feedback', '')
            suggestions = ai_review.get('suggestions', [])
        else:
            complexity_score = 0
            style_score = 0
            edge_case_score = 0
            overall_score = correctness_score  # Only correctness if no AI review
            feedback = "Code executed but AI review unavailable"
            suggestions = ["Enable AI review for detailed feedback"]
        
        return CodeEvaluation(
            execution_result=execution_result,
            ai_review=ai_review,
            overall_score=overall_score,
            correctness_score=correctness_score,
            complexity_score=complexity_score,
            style_score=style_score,
            edge_case_score=edge_case_score,
            feedback=feedback,
            suggestions=suggestions
        )


def create_code_evaluator() -> CodeEvaluator:
    return CodeEvaluator()