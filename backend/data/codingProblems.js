// STEP 4 — coding problem bank (self-written, ~6 DSA problems).
// Each has a starter for JS + Python, test cases, and a server-side known solution
// (used later by the Step 8 similarity check — intentionally NOT exposed to the client).

export const CODING_PROBLEMS = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    description:
      "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to target. You may assume exactly one solution exists.",
    starter: {
      javascript: "function solve(nums, target) {\n  // your code\n}",
      python: "def solve(nums, target):\n    # your code\n    pass",
    },
    testCases: [
      { input: "[[2,7,11,15], 9]", expected: "[0,1]" },
      { input: "[[3,2,4], 6]", expected: "[1,2]" },
      { input: "[[3,3], 6]", expected: "[0,1]" },
    ],
    knownSolution: {
      javascript:
        "function solve(nums, target) {\n  const m = new Map();\n  for (let i=0;i<nums.length;i++){\n    if (m.has(target-nums[i])) return [m.get(target-nums[i]), i];\n    m.set(nums[i], i);\n  }\n}",
      python:
        "def solve(nums, target):\n    m = {}\n    for i, n in enumerate(nums):\n        if target - n in m: return [m[target-n], i]\n        m[n] = i",
    },
  },
  {
    id: "reverse-string",
    title: "Reverse a String",
    difficulty: "Easy",
    description: "Return the reverse of the input string `s`.",
    starter: {
      javascript: "function solve(s) {\n  // your code\n}",
      python: "def solve(s):\n    # your code\n    pass",
    },
    testCases: [
      { input: '"hello"', expected: '"olleh"' },
      { input: '"InterviewSpar"', expected: '"rapSweivretnI"' },
      { input: '""', expected: '""' },
    ],
    knownSolution: {
      javascript: "function solve(s) { return s.split('').reverse().join(''); }",
      python: "def solve(s): return s[::-1]",
    },
  },
  {
    id: "fibonacci",
    title: "Nth Fibonacci",
    difficulty: "Easy",
    description: "Return the nth Fibonacci number (0-indexed: fib(0)=0, fib(1)=1).",
    starter: {
      javascript: "function solve(n) {\n  // your code\n}",
      python: "def solve(n):\n    # your code\n    pass",
    },
    testCases: [
      { input: "0", expected: "0" },
      { input: "1", expected: "1" },
      { input: "10", expected: "55" },
    ],
    knownSolution: {
      javascript: "function solve(n) { let a=0,b=1; for(let i=0;i<n;i++){[a,b]=[b,a+b];} return a; }",
      python: "def solve(n):\n    a,b=0,1\n    for _ in range(n): a,b=b,a+b\n    return a",
    },
  },
  {
    id: "fizzbuzz",
    title: "FizzBuzz",
    difficulty: "Easy",
    description:
      "Return a list of strings for 1..n where multiples of 3 are 'Fizz', multiples of 5 are 'Buzz', and multiples of both are 'FizzBuzz'.",
    starter: {
      javascript: "function solve(n) {\n  // your code\n}",
      python: "def solve(n):\n    # your code\n    pass",
    },
    testCases: [
      { input: "5", expected: '["1","2","Fizz","4","Buzz"]' },
      { input: "15", expected: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]' },
    ],
    knownSolution: {
      javascript:
        "function solve(n){const r=[];for(let i=1;i<=n;i++){let s='';if(i%3===0)s+='Fizz';if(i%5===0)s+='Buzz';r.push(s||String(i));}return r;}",
      python:
        "def solve(n):\n    r=[]\n    for i in range(1,n+1):\n        s=''\n        if i%3==0: s+='Fizz'\n        if i%5==0: s+='Buzz'\n        r.append(s or str(i))\n    return r",
    },
  },
  {
    id: "anagram",
    title: "Valid Anagram",
    difficulty: "Easy",
    description: "Return true if strings `a` and `b` are anagrams (same letters, different order).",
    starter: {
      javascript: "function solve(a, b) {\n  // your code\n}",
      python: "def solve(a, b):\n    # your code\n    pass",
    },
    testCases: [
      { input: '["listen","silent"]', expected: "true" },
      { input: '["hello","world"]', expected: "false" },
      { input: '["aabb","abab"]', expected: "true" },
    ],
    knownSolution: {
      javascript: "function solve(a,b){return a.split('').sort().join('')===b.split('').sort().join('');}",
      python: "def solve(a,b): return sorted(a)==sorted(b)",
    },
  },
  {
    id: "palindrome",
    title: "Palindrome Check",
    difficulty: "Easy",
    description: "Return true if string `s` reads the same forwards and backwards (ignore case).",
    starter: {
      javascript: "function solve(s) {\n  // your code\n}",
      python: "def solve(s):\n    # your code\n    pass",
    },
    testCases: [
      { input: '"racecar"', expected: "true" },
      { input: '"hello"', expected: "false" },
      { input: '"Level"', expected: "true" },
    ],
    knownSolution: {
      javascript: "function solve(s){s=s.toLowerCase();return s===s.split('').reverse().join('');}",
      python: "def solve(s): s=s.lower(); return s==s[::-1]",
    },
  },
];

// public view (no known solutions, no leaking answers)
export function publicProblems() {
  return CODING_PROBLEMS.map(({ id, title, difficulty, description, starter }) => ({
    id,
    title,
    difficulty,
    description,
    starter,
  }));
}

export function getProblem(id) {
  return CODING_PROBLEMS.find((p) => p.id === id);
}
