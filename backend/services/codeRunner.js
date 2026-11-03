// Legacy adapter: user code is sent to the isolated provider, never executed on this host.
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export async function runCode({language,code,testCases}) {
  if (!process.env.JUDGE0_API_URL) return {error:'Isolated code execution is not configured.',status:'unavailable',passed:0,total:testCases.length,results:[]};
  const cases=testCases.map(c=>{const input=JSON.parse(c.input);return {args:Array.isArray(input)?input:[input],expected:JSON.parse(c.expected)};});
  return new Promise(resolve=>{
    const child=execFile(process.env.PYTHON_BIN || 'python3',[fileURLToPath(new URL('../app/safe_execution.py',import.meta.url))],{timeout:90000,maxBuffer:262144},(error,stdout)=>{
      if(error)return resolve({error:'Isolated execution unavailable.',status:'unavailable'});
      try {resolve(JSON.parse(stdout));}catch{resolve({error:'Invalid execution response.',status:'unavailable'});}
    });
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({code,language,cases}));
  });
}
