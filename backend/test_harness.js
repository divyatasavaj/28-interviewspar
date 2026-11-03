const code = `function solve(nums, target) { const m = new Map(); for (let i=0;i<nums.length;i++){ if (m.has(target-nums[i])) return [m.get(target-nums[i]), i]; m.set(nums[i], i); } }`;
const testCases = [{input:'[[2,7,11,15], 9]', expected:'[0,1]'}, {input:'[[3,2,4], 6]', expected:'[1,2]'}];
const casesJson = JSON.stringify(testCases);
const harness = [
  code,
  '(() => {',
  '  const cases = ' + casesJson + ';',
  '  for (const c of cases) {',
  '    let out;',
  '    try {',
  '      const args = JSON.parse(c.input);',
  '      out = solve(...(Array.isArray(args) ? args : [args]));',
  '    }',
  '    catch (e) { out = "<error " + e.message + ">"; }',
  '    const exp = JSON.parse(c.expected);',
  '    const pass = JSON.stringify(out) === JSON.stringify(exp);',
  '    console.log(pass ? "PASS" : "FAIL " + JSON.stringify(out) + " expected " + JSON.stringify(exp));',
  '  }',
  '})();',
].join('\n');
console.log(harness);
