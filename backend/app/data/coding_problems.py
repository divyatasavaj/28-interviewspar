# Hardcoded coding-problem bank (public data only; answers are run against private test
# cases in the code runner). Each problem has known solutions per language for the
# similarity check.

PROBLEMS = [
    {
        "id": "two_sum",
        "title": "Two Sum",
        "difficulty": "easy",
        "description": "Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.",
        "testCases": [
            {"input": "[[2,7,11,15],9]", "expected": "[0,1]"},
            {"input": "[[3,2,4],6]", "expected": "[1,2]"},
            {"input": "[[3,3],6]", "expected": "[0,1]"},
        ],
        "knownSolution": {
            "javascript": "function solve(nums, target) { for (let i = 0; i < nums.length; i++) { for (let j = i + 1; j < nums.length; j++) { if (nums[i] + nums[j] === target) return [i, j]; } } return []; }",
            "python": "def solve(nums, target):\n    for i in range(len(nums)):\n        for j in range(i + 1, len(nums)):\n            if nums[i] + nums[j] == target:\n                return [i, j]\n    return []",
        },
    },
    {
        "id": "reverse_string",
        "title": "Reverse a String",
        "difficulty": "easy",
        "description": "Write a function that reverses a string. Reverse it in place if possible (return a new reversed string is fine).",
        "testCases": [
            {"input": '"hello"', "expected": '"olleh"'},
            {"input": '"A man"', "expected": '"nam A"'},
            {"input": '""', "expected": '""'},
        ],
        "knownSolution": {
            "javascript": "function solve(s) { return s.split('').reverse().join(''); }",
            "python": "def solve(s):\n    return s[::-1]",
        },
    },
    {
        "id": "palindrome",
        "title": "Valid Palindrome",
        "difficulty": "easy",
        "description": "Given a string s, return true if it is a palindrome (forward == backward), ignoring case.",
        "testCases": [
            {"input": '"aba"', "expected": "true"},
            {"input": '"racecar"', "expected": "true"},
            {"input": '"hello"', "expected": "false"},
        ],
        "knownSolution": {
            "javascript": "function solve(s) { const t = s.toLowerCase(); return t === t.split('').reverse().join(''); }",
            "python": "def solve(s):\n    t = s.lower()\n    return t == t[::-1]",
        },
    },
    {
        "id": "fibonacci",
        "title": "Nth Fibonacci",
        "difficulty": "easy",
        "description": "Return the nth Fibonacci number (F(0)=0, F(1)=1). n is non-negative.",
        "testCases": [
            {"input": "0", "expected": "0"},
            {"input": "1", "expected": "1"},
            {"input": "10", "expected": "55"},
        ],
        "knownSolution": {
            "javascript": "function solve(n) { let a = 0, b = 1; for (let i = 0; i < n; i++) { const t = a + b; a = b; b = t; } return a; }",
            "python": "def solve(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a",
        },
    },
    {
        "id": "max_subarray",
        "title": "Max Subarray Sum (Kadane)",
        "difficulty": "medium",
        "description": "Given an integer array nums, find the contiguous subarray with the largest sum and return that sum.",
        "testCases": [
            {"input": "[[-2,1,-3,4,-1,2,1,-5,4]]", "expected": "6"},
            {"input": "[[1]]", "expected": "1"},
            {"input": "[[-1,-2,-3]]", "expected": "-1"},
        ],
        "knownSolution": {
            "javascript": "function solve(nums) { let best = -Infinity, cur = 0; for (const n of nums) { cur = Math.max(n, cur + n); best = Math.max(best, cur); } return best; }",
            "python": "def solve(nums):\n    best, cur = -float('inf'), 0\n    for n in nums:\n        cur = max(n, cur + n)\n        best = max(best, cur)\n    return best",
        },
    },
]


def public_problems() -> list[dict]:
    return [
        {
            "id": p["id"],
            "title": p["title"],
            "difficulty": p["difficulty"],
            "description": p["description"],
            "starter": {
                "javascript": "function solve(...args) {\n  // write your solution\n}",
                "python": "def solve(*args):\n    # write your solution\n    pass",
            },
        }
        for p in PROBLEMS
    ]


def get_problem(problem_id: str) -> dict:
    return next((p for p in PROBLEMS if p["id"] == problem_id), None)