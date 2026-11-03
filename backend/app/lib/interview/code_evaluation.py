import os
import json
import asyncio
import tempfile
import subprocess
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
    """Executes code in a sandboxed environment"""
    
    def __init__(self, timeout_seconds: int = 10, memory_limit_mb: int = 256):
        self.timeout_seconds = timeout_seconds
        self.memory_limit_mb = memory_limit_mb
    
    def execute(self, code: str, language: Language, test_cases: List[TestCase], function_signature: str = None) -> ExecutionResult:
        if language == Language.JAVASCRIPT or language == Language.TYPESCRIPT:
            return self._execute_javascript(code, test_cases, function_signature)
        elif language == Language.PYTHON:
            return self._execute_python(code, test_cases, function_signature)
        else:
            return ExecutionResult(
                status=ExecutionStatus.RUNTIME_ERROR,
                error_message=f"Language {language} not supported yet"
            )
    
    def _execute_javascript(self, code: str, test_cases: List[TestCase], function_signature: str = None) -> ExecutionResult:
        # Create a test runner
        test_runner = self._build_js_test_runner(code, test_cases, function_signature)
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
            f.write(test_runner)
            temp_file = f.name
        
        try:
            import time
            start = time.time()
            result = subprocess.run(
                ['node', temp_file],
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds
            )
            execution_time = (time.time() - start) * 1000
            
            return self._parse_js_result(result, execution_time, len(test_cases))
        except subprocess.TimeoutExpired:
            return ExecutionResult(
                status=ExecutionStatus.TIMEOUT,
                error_message=f"Execution timed out after {self.timeout_seconds}s"
            )
        except Exception as e:
            return ExecutionResult(
                status=ExecutionStatus.RUNTIME_ERROR,
                error_message=str(e)
            )
        finally:
            try:
                os.unlink(temp_file)
            except:
                pass
    
    def _build_js_test_runner(self, code: str, test_cases: List[TestCase], function_signature: str = None) -> str:
        # Extract function name from signature or use default
        func_name = "solution"
        if function_signature:
            import re
            match = re.search(r'function\s+(\w+)|(\w+)\s*=', function_signature)
            if match:
                func_name = match.group(1) or match.group(2)
        
        test_code = f"""
{code}

const testCases = {json.dumps([{'input': tc.input, 'expected': tc.expected_output, 'description': tc.description} for tc in test_cases])};

let passed = 0;
let total = testCases.length;
const results = [];

for (let i = 0; i < testCases.length; i++) {{
    const tc = testCases[i];
    try {{
        let result;
        if (Array.isArray(tc.input)) {{
            result = {func_name}(...tc.input);
        }} else if (typeof tc.input === 'object' && tc.input !== null) {{
            result = {func_name}(tc.input);
        }} else {{
            result = {func_name}(tc.input);
        }}
        
        const isEqual = JSON.stringify(result) === JSON.stringify(tc.expected);
        if (isEqual) passed++;
        
        results.push({{
            testCase: i + 1,
            description: tc.description,
            input: tc.input,
            expected: tc.expected,
            actual: result,
            passed: isEqual
        }});
    }} catch (e) {{
        results.push({{
            testCase: i + 1,
            description: tc.description,
            input: tc.input,
            expected: tc.expected,
            actual: null,
            passed: false,
            error: e.message
        }});
    }}
}}

console.log(JSON.stringify({{ passed, total, results }}));
"""
        return test_code
    
    def _parse_js_result(self, result: subprocess.CompletedProcess, execution_time: float, total_tests: int) -> ExecutionResult:
        if result.returncode != 0:
            return ExecutionResult(
                status=ExecutionStatus.RUNTIME_ERROR,
                stderr=result.stderr,
                execution_time_ms=execution_time,
                error_message=result.stderr[:500]
            )
        
        try:
            output = json.loads(result.stdout.strip().split('\n')[-1])
            passed = output.get('passed', 0)
            results = output.get('results', [])
            
            return ExecutionResult(
                status=ExecutionStatus.SUCCESS,
                stdout=result.stdout,
                execution_time_ms=execution_time,
                passed=passed,
                total=total_tests,
                test_results=results
            )
        except json.JSONDecodeError:
            return ExecutionResult(
                status=ExecutionStatus.RUNTIME_ERROR,
                stdout=result.stdout,
                execution_time_ms=execution_time,
                error_message="Failed to parse test output"
            )
    
    def _execute_python(self, code: str, test_cases: List[TestCase], function_signature: str = None) -> ExecutionResult:
        func_name = "solution"
        if function_signature:
            import re
            match = re.search(r'def\s+(\w+)', function_signature)
            if match:
                func_name = match.group(1)
        
        test_code = f"""
{code}

import json

test_cases = {json.dumps([{'input': tc.input, 'expected': tc.expected_output, 'description': tc.description} for tc in test_cases])}

passed = 0
total = len(test_cases)
results = []

for i, tc in enumerate(test_cases):
    try:
        if isinstance(tc['input'], list):
            result = {func_name}(*tc['input'])
        elif isinstance(tc['input'], dict):
            result = {func_name}(**tc['input'])
        else:
            result = {func_name}(tc['input'])
        
        is_equal = result == tc['expected']
        if is_equal:
            passed += 1
        
        results.append({{
            'testCase': i + 1,
            'description': tc['description'],
            'input': tc['input'],
            'expected': tc['expected'],
            'actual': result,
            'passed': is_equal
        }})
    except Exception as e:
        results.append({{
            'testCase': i + 1,
            'description': tc['description'],
            'input': tc['input'],
            'expected': tc['expected'],
            'actual': None,
            'passed': False,
            'error': str(e)
        }})

print(json.dumps({{'passed': passed, 'total': total, 'results': results}}))
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(test_code)
            temp_file = f.name
        
        try:
            import time
            start = time.time()
            result = subprocess.run(
                ['python3', temp_file],
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds
            )
            execution_time = (time.time() - start) * 1000
            
            if result.returncode != 0:
                return ExecutionResult(
                    status=ExecutionStatus.RUNTIME_ERROR,
                    stderr=result.stderr,
                    execution_time_ms=execution_time,
                    error_message=result.stderr[:500]
                )
            
            output = json.loads(result.stdout.strip().split('\n')[-1])
            passed = output.get('passed', 0)
            results = output.get('results', [])
            
            return ExecutionResult(
                status=ExecutionStatus.SUCCESS,
                stdout=result.stdout,
                execution_time_ms=execution_time,
                passed=passed,
                total=total_tests,
                test_results=results
            )
        except subprocess.TimeoutExpired:
            return ExecutionResult(
                status=ExecutionStatus.TIMEOUT,
                error_message=f"Execution timed out after {self.timeout_seconds}s"
            )
        except Exception as e:
            return ExecutionResult(
                status=ExecutionStatus.RUNTIME_ERROR,
                error_message=str(e)
            )
        finally:
            try:
                os.unlink(temp_file)
            except:
                pass


class AICodeReviewer:
    """Uses LLM to review code quality"""
    
    def __init__(self):
        self.client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
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
                "feedback": f"AI review failed: {str(e)}",
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
            overall_score = correctness_score * 0.4  # Only correctness if no AI review
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