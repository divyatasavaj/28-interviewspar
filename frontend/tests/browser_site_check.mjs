// Opt-in Chrome acceptance checks. Run through backend/tests/live_site_check.py
// --browser so all writes use the runner's disposable MongoDB database.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
// Already supplied by the project's socket.io-client dependency tree.
import WebSocket from 'ws';
import {checkInterviewCall,installCallMedia} from './call_browser_checks.mjs';

const [baseUrl, fixture] = process.argv.slice(2);
assert.ok(baseUrl && fixture, 'The isolated API runner must supply the URL and synthetic PDF');
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname));
const profile = await mkdtemp(join(tmpdir(), 'interspars-chrome-'));
const artifacts = await mkdtemp(join(tmpdir(), 'interspars-browser-results-'));
const chrome = spawn(process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  ...(process.env.CHROME_HEADLESS === '0' ? [] : ['--headless=new']),
  '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--enable-automation',
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--disable-background-networking', '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
  '--disable-features=CalculateNativeWinOcclusion', 'about:blank',
], { stdio: 'ignore' });
const checks = [], failures = [], exceptions = [], serverErrors = [];
const apiRequestTimes = [];
let socket, serial = 0, phase = 'starting';
const pending = new Map();
function check(label, passed) {
  (passed ? checks : failures).push(label);
  console.log(`${passed ? 'PASS' : 'FAIL'} browser: ${label}`);
}
async function command(method, params = {}) {
  const id = ++serial;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome command timed out: ${method} (${phase})`)); }, 35000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, timeout: 10000 });
  if (result.exceptionDetails) throw new Error(`Browser evaluation failed: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`);
  return result.result.value;
}
async function waitFor(expression, label, timeout = 30000) {
  phase = `waiting for ${label}`;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
const hasText = text => `document.body?.textContent.includes(${JSON.stringify(text)})`;
const element = (selector, text = null) => `Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(e => {
  const r=e.getBoundingClientRect(); return r.width>0 && r.height>0 && getComputedStyle(e).visibility!=='hidden'
  && (${text === null ? 'true' : `e.textContent.trim().includes(${JSON.stringify(text)})`});
})`;
async function click(selector, text = null) {
  const lookup = element(selector, text);
  await waitFor(`!!(${lookup}) && !(${lookup}).disabled`, `clickable ${text || selector}`);
  phase = `scroll to ${text || selector}`;
  await evaluate(`void (${lookup}).scrollIntoView({block:'center',behavior:'instant'})`);
  phase = `locate ${text || selector}`;
  const rect = await evaluate(`(()=>{const e=${lookup}; const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', ...rect, button: 'left', clickCount: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', ...rect, button: 'left', clickCount: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0, buttons: 0 });
}
async function fill(selector, value) {
  await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`, selector);
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus();e.select();})()`);
  await command('Input.insertText', { text: value });
}
async function select(selector, value) {
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}); e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}
async function goto(path, ready = 'document.querySelector("h1")') {
  // Automated navigation is much faster than a person. Keep independent
  // scenarios below the real API's 120/minute limit; do not disable protection.
  while (apiRequestTimes.filter(t=>Date.now()-t<60000).length >= 75) {
    console.log('Browser pacing: waiting for the API request window before the next scenario.');
    const oldest = apiRequestTimes.find(t=>Date.now()-t<60000);
    await delay(Math.max(100,60050-(Date.now()-oldest)));
  }
  phase = `navigate to ${path}`;
  await command('Page.navigate', { url: new URL(path, baseUrl).href });
  await waitFor(`location.pathname===${JSON.stringify(new URL(path, baseUrl).pathname)} && (${ready})`, path);
}
async function viewport(width, height = 900) {
  await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
}
async function screenshot(name) {
  // Capture the settled design, rather than a half-transparent entrance frame.
  await command('Runtime.evaluate', {
    expression: `Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect.getComputedTiming().endTime)).map(a => a.finished.catch(() => {})))`,
    awaitPromise: true, timeout: 10000,
  });
  const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(join(artifacts, `${name}.png`), Buffer.from(shot.data, 'base64'));
}
async function savePdf(name) {
  const pdf = await command('Page.printToPDF', {printBackground:true});
  await writeFile(join(artifacts, `${name}.pdf`), Buffer.from(pdf.data, 'base64'));
  check(`${name} produces a PDF`, Buffer.from(pdf.data, 'base64').subarray(0,5).toString() === '%PDF-');
}
async function checkWorkspaceOrganization() {
  await viewport(390,844);
  await click('button[aria-label="Toggle menu"]');
  await click('#workspace-mobile-menu a','Personal profile');
  await waitFor(hasText('Profile Details'),'mobile profile');
  check('Mobile workspace navigation follows a link and closes',await evaluate('!document.querySelector("#workspace-mobile-menu")'));
  for (const tab of ['preferences','reports','resume','profile']) {
    await click(`nav[aria-label="Account sections"] a[href="/account?tab=${tab}"]`);
    await waitFor(`location.search==='?tab=${tab}'`,'account tab URL');
    await evaluate('window.__beforeReload=true');
    await command('Page.reload');
    await waitFor(`!window.__beforeReload && document.querySelector('nav[aria-label="Account sections"] a[aria-current="page"]')?.getAttribute('href')==='/account?tab=${tab}'`,'account tab reload');
    check(`Mobile ${tab} tab survives reload`,true);
  }
  await screenshot('account-profile-mobile');
  await goto('/account?tab=resume',hasText('Resume Upload & Parser'));
  const document = await command('DOM.getDocument');
  const input = await command('DOM.querySelector',{nodeId:document.root.nodeId,selector:'input[type="file"]'});
  await command('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[resolve(fixture)]});
  await click('input[type="checkbox"]');await click('button','Parse synthetic.pdf');
  await waitFor(hasText('Extracted Background Profile'),'organization resume');
  await goto('/dashboard',hasText('Open Resume Intelligence'));
  check('Dashboard shows one resume matching entry point',await evaluate(`!document.querySelector('#resume-tools input, #resume-tools select, #resume-tools textarea')`));
  await layout('mobile dashboard resume summary');await screenshot('dashboard-resume-mobile');
  await click('#resume-tools a','Open Resume Intelligence');
  await waitFor(hasText('What are you preparing for?'),'dedicated role tools');
  await click('button','Analyze');
  await waitFor(hasText('Score Unavailable'),'role result');
  await click('button','Job description');
  await fill('#jd-input-box','Required: Python, SQL, React and REST API development. Build dashboards and backend services with clear tests and documentation.');
  await click('button[type="submit"]');
  await waitFor(hasText('Requirement Coverage'),'JD result');
  check('Dashboard entry reaches both dedicated matching modes',true);
  await goto('/interview/start');await layout('mobile interview setup');await screenshot('setup-mobile');
  await viewport(1440);await screenshot('setup-desktop');
}
async function checkCodingRound() {
  await click('#practice a', 'Practice coding');
  await waitFor('document.querySelector("#interview-track")?.value==="coding" && document.querySelectorAll("#interview-domain option").length>4', 'coding-only setup');
  await select('#interview-domain', 'Frontend');
  await select('#interview-experience', 'junior');
  await click('#interview-save-consent');
  const liveReview = process.env.LIVE_CODE_REVIEW === '1';
  if (liveReview) await click('#interview-ai-consent');
  await click('button', 'Start interview');
  await waitFor(hasText('Class list builder'), 'first frontend exercise');
  await evaluate(installCallMedia());
  await click('button', 'Preview camera');
  await waitFor('document.querySelector("video").srcObject?.active', 'preflight camera');
  check('Coding-only lobby previews camera without a microphone check', await evaluate('!!document.querySelector(".call-stage--preview") && !document.body.textContent.includes("Check microphone")'));
  await click('input[aria-label="Coding observations consent"]');
  await click('button', 'Join interview');
  await waitFor('document.querySelector(".call-room--coding textarea")', 'coding editor');
  await waitFor('document.querySelector("video").srcObject?.active && document.querySelector("video").videoWidth>0', 'live coding camera');
  check('Coding starts with camera and no microphone', await evaluate('window.__callTest.starts===0 && !!document.querySelector("video").srcObject?.active'));
  await fill('#solution-code', 'function solve(classes) { return []; }');
  await select('[aria-label="Code language"]', 'python');
  await fill('#solution-code', 'def solve(classes): return []');
  await command('Page.reload');
  await waitFor('!window.__callTest && document.querySelector(".call-join")', 'reopened coding exercise');
  await evaluate(installCallMedia());
  await click('input[aria-label="Coding observations consent"]');
  await click('button', 'Join interview');
  await waitFor('document.querySelector("#solution-code")?.value==="def solve(classes): return []"', 'restored coding draft');
  check('Reload restores the code and selected language', await evaluate('document.querySelector(".coding-language select").value==="python"'));
  await select('[aria-label="Code language"]', 'javascript');
  check('Editor retains each language draft', await evaluate('document.querySelector("#solution-code").value==="function solve(classes) { return []; }"'));
  await click('button', 'Run samples');
  const mock = process.env.MOCK_CODE_RUNNER === '1';
  await waitFor(hasText(mock ? '1 of 2 sample tests passed' : 'Code execution is not configured'), 'sample results');
  check('Visible sample run has a clear result', true);
  await layout('desktop coding editor');
  await screenshot('coding-desktop');
  await viewport(390,844);
  await layout('mobile coding editor');
  await click('.coding-tabs button', 'Problem');
  check('Mobile workspace switches between problem, editor, and tests', await evaluate('document.querySelector(".coding-editor").dataset.panel==="problem"'));
  await click('.coding-tabs button', 'Tests');
  await screenshot('coding-mobile');
  await viewport(1440);
  await click('.call-observations summary');
  await waitFor(`Number(document.querySelector('.call-observations .delivery-live-stats strong')?.textContent)>0`, 'camera samples during coding');
  await click('.call-observations summary');
  await click('button', 'Submit solution');
  await waitFor(hasText('Search suggestions'), 'next frontend exercise');
  check('Submitting moves to the next domain exercise with the same camera', await evaluate('window.__callTest.starts===0 && document.querySelector("video").srcObject?.active'));
  await click('button', 'Skip exercise');
  await waitFor(hasText('Your interview feedback'), 'coding-only report');
  check('Coding-only finishes directly and clears the saved draft', await evaluate(`location.pathname.endsWith('/report') && window.__callTest.starts===0 && ${hasText('Coding test results')} && !Object.keys(sessionStorage).some(key=>key.startsWith('interviewspar-code-draft:'))`));
  check('Report overview links to the submitted exercise', await evaluate('document.querySelector("#report-overview a")?.hash==="#answer-1"'));
  await click('#answer-1 summary');
  check('Report retains code, grading, and coding observations', await evaluate(`${hasText('JavaScript solution')} && ${hasText('Face present in camera samples')} && ${hasText(mock ? 'Hidden tests 1/3' : 'Code execution is not configured')}`));
  if (liveReview) check('Opted-in coding report includes live Groq review', await evaluate('!!document.querySelector(".coding-report strong")'));
  check('Practice this again links to coding-only setup', await evaluate('Array.from(document.querySelectorAll("#report-overview a")).some(link=>new URL(link.href).searchParams.get("track")==="coding")'));
  await screenshot('coding-report');
  await click('button','Delete this interview');
  await click('dialog button','Cancel');
  check('Cancelling deletion keeps the saved interview', await evaluate('location.pathname.endsWith("/report") && !document.querySelector("dialog[open]")'));
  await click('button','Delete this interview');
  await click('dialog button','Permanently delete');
  await waitFor('location.pathname==="/dashboard"', 'coding report deletion');
}
async function checkRolePractice() {
  await goto('/account?tab=resume',hasText('Resume Upload & Parser'));
  const document = await command('DOM.getDocument');
  const input = await command('DOM.querySelector',{nodeId:document.root.nodeId,selector:'input[type="file"]'});
  await command('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[resolve(fixture)]});
  await click('input[type="checkbox"]');
  await click('button','Parse synthetic.pdf');
  await waitFor(hasText('Extracted Background Profile'),'role-fit resume');
  await goto('/resume-intelligence',hasText('Compare role fit'));
  check('Role fit compares demonstrated and missing requirements for each available role',
    await evaluate('document.querySelectorAll("#role-fit article").length===5'));
  await viewport(390,844);
  await layout('mobile role comparison');
  await screenshot('role-fit-mobile');
  await viewport(1440);
  await click('#role-fit button','Review Backend Developer');
  await waitFor('!!document.querySelector("#skill-evidence a[href*=topic]")','resume gap link');
  await layout('desktop role evidence');
  await click('#skill-evidence a','Practice this gap');
  await waitFor('document.querySelector("#practice-topic")?.value', 'prefilled practice skill');
  const topic = await evaluate('document.querySelector("#practice-topic").value');
  check('Resume gap opens a preselected practice topic', Boolean(topic));
  await click('#interview-save-consent');
  await click('button','Start interview');
  await waitFor(hasText('Question 1 of 3'),'focused practice call');
  await evaluate(installCallMedia());
  await click('button','Check microphone');
  await waitFor(hasText('Microphone access confirmed'),'microphone check');
  check('Spoken preflight releases its microphone stream', await evaluate('window.__callTest.streams.every(stream=>stream.getTracks().every(track=>track.readyState==="ended"))'));
  await click('input[aria-label="Speech recognition consent"]');
  await click('button','Join interview');
  await waitFor('document.querySelector(".call-avatar-listening")','focused spoken question');
  await evaluate("window.__callTest.emit('I would explain the trade-off and give one example of its result.')");
  await click('button','Review transcript');
  await click('button','Send spoken answer');
  await waitFor(hasText('Question 2 of 3'),'focused practice advancement');
  await click('button','End interview');
  await waitFor(hasText('Your interview feedback'),'focused practice report');
  check('Focused practice report links back to the same topic', await evaluate(`Array.from(document.querySelectorAll('#report-overview a')).some(link=>new URL(link.href).searchParams.get('topic')===${JSON.stringify(topic)})`));
}
async function checkCombinedPractice() {
  await goto('/interview/start?coding=1','document.querySelector("#coding-practice")?.checked');
  await select('#interview-domain','Frontend');
  await select('#interview-experience','junior');
  await click('#interview-save-consent');
  await click('button','Start interview');
  await waitFor(hasText('Question 1 of 14'),'combined interview lobby');
  await evaluate(installCallMedia());
  await click('input[aria-label="Speech recognition consent"]');
  await click('button','Join interview');
  await waitFor('document.querySelector("video").srcObject?.active','combined camera');
  await click('button','Skip exercise');
  await waitFor(hasText('Question 2 of 14'),'combined second exercise');
  await click('button','Skip exercise');
  await waitFor('window.__callTest.starts===1 && document.querySelector(".call-avatar-listening")','combined speech handoff');
  check('Combined interview still starts speech after coding with camera connected',
    await evaluate('!document.querySelector("textarea") && !!document.querySelector("video").srcObject?.active'));
  await click('button','End interview');
  await waitFor(hasText('Your interview feedback'),'combined report');
}
async function layout(label) {
  const dimensions = await evaluate('({page:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth})');
  check(`${label} has no horizontal overflow`, dimensions.page <= dimensions.viewport + 1);
  const clippedControls = await evaluate(`Array.from(document.querySelectorAll('nav.fixed a, nav.fixed button')).filter(e=>{
    const r=e.getBoundingClientRect(), n=e.closest('nav').getBoundingClientRect();
    return r.width>0 && r.height>0 && (r.right>document.documentElement.clientWidth+1 || r.left<0 || r.bottom>n.bottom+1);
  }).length`);
  check(`${label} navigation controls fit the header`,clippedControls===0);
  if (dimensions.page > dimensions.viewport + 1) {
    // Only tag names and class names are recorded; never form values/tokens.
    const overflowing = await evaluate(`Array.from(document.querySelectorAll('body *')).filter(e=>{
      const r=e.getBoundingClientRect();return r.width>0 && r.right>innerWidth+1;
    }).slice(0,20).map(e=>({tag:e.tagName,class:e.className?.baseVal ?? e.className}))`);
    await writeFile(join(artifacts, `${label.replaceAll(/[^a-z0-9]/gi,'-')}-overflow.json`), JSON.stringify(overflowing,null,2));
  }
}

try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch { if (chrome.exitCode !== null) throw new Error('Chrome exited during startup'); await delay(100); }
  }
  assert.ok(port, 'Chrome debugging endpoint did not become ready');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const tab = tabs.find(t => t.type === 'page');
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.id) {
      const task = pending.get(msg.id);
      if (!task) return;
      clearTimeout(task.timer); pending.delete(msg.id);
      if (msg.error) task.reject(new Error(`Chrome ${msg.error.code}: ${msg.error.message}`));
      else task.resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      exceptions.push(msg.params.exceptionDetails.text);
    } else if (msg.method === 'Network.requestWillBeSent') {
      if(msg.params.request.url.startsWith(`${baseUrl}/api/`)) apiRequestTimes.push(Date.now());
    } else if (msg.method === 'Network.responseReceived') {
      const { url, status } = msg.params.response;
      if (url.startsWith(baseUrl) && status >= 500 && !url.includes('/tts/')) serverErrors.push({path:new URL(url).pathname,status});
      if (url.startsWith(baseUrl) && status === 429) {
        failures.push(`Unexpected rate limit: ${new URL(url).pathname}`);
        console.log(`FAIL browser: rate limit at ${new URL(url).pathname}`);
      }
    }
  };
  socket.onclose = () => {
    for(const task of pending.values()) {
      clearTimeout(task.timer); task.reject(new Error(`Chrome connection closed (${phase})`));
    }
    pending.clear();
  };
  await command('Page.enable'); await command('Runtime.enable'); await command('Network.enable');
  await command('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: artifacts });
  await viewport(1440);
  if (process.env.CALL_ONLY !== '1' && process.env.CODING_ONLY !== '1') {
  const publicPages = ['/', '/features', '/practice-tracks', '/student-guide', '/pricing', '/subscription', '/resources', '/contact', '/login', '/signup'];
  for (const path of publicPages) {
    await goto(path);
    await layout(`desktop ${path}`);
  }
  check('All public pages load with a primary heading', true);
  await goto('/');
  await click('button', 'HR & behavioral');
  check('Homepage question preview switches tracks', await evaluate(hasText('project that changed direction')));
  await click('button', 'Technical thinking');
  await command('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  check('Reduced motion stops decorative movement and button transitions', await evaluate(`
    getComputedStyle(document.querySelector('.practice-window')).animationName === 'none' &&
    getComputedStyle(document.querySelector('.hero-sky')).animationName === 'none' &&
    getComputedStyle(document.querySelector('.spar-button')).transitionDuration === '0s'
  `));
  await command('Emulation.setEmulatedMedia', {features:[]});
  await screenshot('home-desktop');
  await viewport(1024,768);
  await goto('/'); await layout('tablet home'); await screenshot('home-tablet');
  await viewport(1440);
  await goto('/student-guide');
  await click('button', 'Can I share my scorecards');
  await waitFor(hasText('choose Save as PDF'), 'FAQ answer');
  check('Student guide FAQ expands', true);
  await goto('/resources'); await click('button', 'DSA & Coding');
  check('Resource category filter changes cards', await evaluate('document.querySelectorAll("h3").length===1'));
  await click('button', 'Download study notes');
  for(let i=0;i<50 && !(await readdir(artifacts)).some(f=>f.endsWith('.md'));i++) await delay(100);
  check('Study notes download as Markdown', (await readdir(artifacts)).some(f=>f.endsWith('.md')));
  await viewport(390,844);
  for (const path of publicPages) { await goto(path); await layout(`mobile ${path}`); }
  await goto('/'); await screenshot('home-mobile');
  await click('button[aria-label="Toggle menu"]');
  await click('a', 'Contact Us');
  await waitFor('location.pathname==="/contact"', 'mobile navigation');
  check('Mobile navigation opens and follows a link', true);
  await viewport(1440);
  await command('Page.navigate', {url:new URL('/dashboard',baseUrl).href});
  await waitFor('location.pathname==="/login"', 'protected route sign-in redirect');
  check('Signed-out protected route redirects to login', true);
  }
  await goto('/signup');
  await fill('#signup-name','Browser Tester');
  await fill('#signup-email','browser@example.com');
  await fill('#signup-password','short');
  await click('button[type="submit"]');
  await waitFor(hasText('at least 8 characters'),'short-password message');
  await fill('#signup-password','Browser-test-password-826');
  await click('button[type="submit"]');
  await waitFor('location.pathname==="/dashboard" && document.querySelector("h1")','signed-in dashboard');
  check('Signup validation and successful registration', true);
  if (process.env.CODING_ONLY === '1') {
    await checkCodingRound();
    await checkRolePractice();
    await checkCombinedPractice();
  } else if (process.env.CALL_ONLY === '1') {
    await checkWorkspaceOrganization();
    await checkInterviewCall({goto,click,fill,select,waitFor,evaluate,check,command,screenshot,savePdf,viewport,layout,hasText});
  } else {
  check('Dashboard puts practice before resume matching',await evaluate(`document.querySelector('#practice').compareDocumentPosition(document.querySelector('#resume-tools')) & Node.DOCUMENT_POSITION_FOLLOWING`));
  await layout('desktop dashboard'); await screenshot('dashboard-desktop');
  await viewport(768,1024); await layout('tablet dashboard'); await screenshot('dashboard-tablet'); await viewport(1440);
  await goto('/account',hasText('Profile Details'));
  check('Account sections share workspace navigation',await evaluate(`!!document.querySelector('.workspace-nav') && document.querySelectorAll('nav[aria-label="Account sections"] a').length===4`));
  await fill('input[type="text"]','Browser Updated');
  await click('button','Save Changes');
  await waitFor(hasText('Profile details saved successfully'),'profile save');
  await goto('/account',hasText('Profile Details'));
  check('Profile changes survive reload', await evaluate('document.querySelector("input[type=text]").value==="Browser Updated"'));
  await screenshot('account-profile-desktop');
  await goto('/account?tab=resume',hasText('Resume Upload & Parser'));
  const document = await command('DOM.getDocument');
  const fileInput = await command('DOM.querySelector',{nodeId:document.root.nodeId,selector:'input[type="file"]'});
  await command('DOM.setFileInputFiles',{nodeId:fileInput.nodeId,files:[resolve(fixture)]});
  await waitFor(hasText('Parse synthetic.pdf'),'file selection');
  check('Resume upload remains disabled without consent',await evaluate(`(${element('button','Parse synthetic.pdf')}).disabled`));
  await click('input[type="checkbox"]'); await click('button','Parse synthetic.pdf');
  await waitFor(hasText('Extracted Background Profile'),'parsed resume');
  check('PDF file upload renders extracted skills',await evaluate(hasText('Python')));
  await viewport(390,844);
  await goto('/dashboard',hasText('Open Resume Intelligence'));
  check('Dashboard links to dedicated resume matching without duplicating its inputs',await evaluate(`!document.querySelector('#resume-tools input, #resume-tools select, #resume-tools textarea')`));
  await layout('mobile dashboard with a saved resume');
  await click('#resume-tools a','Open Resume Intelligence');
  await waitFor(hasText('What are you preparing for?'),'resume matching from the dashboard');
  await viewport(1440);
  await click('button','Analyze');
  await waitFor(hasText('Score Unavailable'),'provisional role result');
  check('Provisional role assessment renders unavailable score',true);
  await click('button','View assessment limitations');
  await waitFor(hasText('Hide assessment limitations'),'assessment limitations');
  await click('button','Job description');
  await fill('#jd-input-box','short');
  await click('button[type="submit"]');
  await waitFor(hasText('too short'),'JD minimum-length validation');
  await fill('#jd-input-box','Required: Python, SQL, React and REST API development. Build dashboards and backend services with clear tests and documentation.');
  await click('button[type="submit"]');
  await waitFor(`${hasText('Custom Job Description')} && ${hasText('Requirement Coverage')}`,'JD coverage result');
  check('Job-description validation and evidence matching',true);
  await screenshot('resume-intelligence-desktop');
  await viewport(390,844); await layout('mobile resume intelligence'); await screenshot('resume-intelligence-mobile');
  await viewport(1440);
  await goto('/account?tab=preferences',hasText('Interviewer Voice & Speech Preferences'));
  await click('button','Calm (-7%)'); await click('button','Save Preferences');
  await goto('/account?tab=preferences',hasText('Interviewer Voice & Speech Preferences'));
  check('Voice preferences survive reload',await evaluate('localStorage.getItem("interviewer_rate")==="-7%"'));
  await checkInterviewCall({goto,click,fill,select,waitFor,evaluate,check,command,screenshot,savePdf,viewport,layout,hasText});
  for (const [persona,count] of [['hr',9],['technical',13]]) {
    await goto(`/interview/start?persona=${persona}`,hasText('Start interview'));
    await waitFor('document.querySelectorAll("#interview-domain option").length>4','interview domains');
    check(`${persona} start link selects the intended track`,await evaluate(`document.querySelector('#interview-track').value===${JSON.stringify(persona)}`));
    if(persona==='hr') await select('#interview-feedback-mode','assessment');
    if(persona==='technical') await select('#interview-experience','senior');
    await click('#interview-save-consent'); await click('button','Start interview');
    await waitFor('document.querySelector("progress")','first interview question');
    const sessionPath = await evaluate('location.pathname');
    await goto('/dashboard',hasText('Resume interview'));
    await click('#practice a','Resume interview');
    await waitFor(`location.pathname===${JSON.stringify(sessionPath)} && document.querySelector("progress")`,'resume from dashboard');
    check(`${persona} dashboard resumes the saved session`,true);
    for(let i=0;i<count;i++) {
      assert.equal(await evaluate('document.querySelectorAll("h1").length'), 1, `${persona} question ${i+1} must replace the previous prompt`);
      const question = await evaluate('document.querySelector("h1").innerText');
      if(persona==='technical' && i===2) {
        check('Senior experience selection reaches the spoken question',question.includes('a trade-off, a failure mode'));
      }
      if(i===0) {
        await viewport(390,844); await layout(`mobile ${persona} interview`); await screenshot(`${persona}-interview-mobile`); await viewport(1440);
        await evaluate('window.__beforeReload = true');
        await command('Page.reload'); await waitFor('!window.__beforeReload && document.querySelector("progress")','interview reload');
        check(`${persona} active interview survives reload`,await evaluate(`document.querySelector('h1').innerText===${JSON.stringify(question)}`));
      }
      if(i===0) {
        await evaluate(installCallMedia());
        await click('input[aria-label="Speech recognition consent"]');await click('button','Join interview');
      }
      await waitFor('document.querySelector(".call-avatar-listening")','spoken question turn');
      if(question.includes('Explain your algorithm aloud'))check('Technical problem is answered aloud without a code editor',await evaluate('!document.querySelector("textarea")'));
      await evaluate(`window.__callTest.emit('For example I built an inventory dashboard because the team needed visibility. The result reduced manual checking, and I learned to document the tests.');`);
      await click('button','Review transcript');
      await click('button','Send spoken answer');
      await waitFor(`location.pathname.endsWith('/report') || (document.querySelector('h1')?.innerText!==${JSON.stringify(question)} && !${hasText('Saving answer')})`,'next interview question');
    }
    await waitFor(hasText('Your interview feedback'),'completed report');
    check(`${persona} entire interview and report`,await evaluate(hasText(`Answered ${count} of ${count}`)));
    await screenshot(`${persona}-report-desktop`);
    const pdf = await command('Page.printToPDF',{printBackground:true});
    await writeFile(join(artifacts,`${persona}-report.pdf`),Buffer.from(pdf.data,'base64'));
    check(`${persona} report produces a PDF`,Buffer.from(pdf.data,'base64').subarray(0,5).toString()==='%PDF-');
    await goto('/dashboard',hasText('View latest report'));
    await click('#practice a','View latest report');
    await waitFor(`location.pathname===${JSON.stringify(sessionPath + '/report')} && ${hasText('Your interview feedback')}`,'latest report from dashboard');
    check(`${persona} dashboard opens the completed report`,true);
    await goto('/account?tab=reports',hasText('View Report'));
    await click('button','View Report');
    await waitFor(hasText('Your interview feedback'),'saved history report');
    check(`${persona} saved report opens from account history`,await evaluate('location.pathname==="/interview-complete"'));
    await click('button','Delete this interview'); await click('dialog button','Permanently delete');
    await waitFor('location.pathname==="/dashboard"','interview deletion');
  }
  for (const path of ['/dashboard','/account?tab=profile','/account?tab=resume','/account?tab=reports','/account?tab=preferences','/interview-type','/interview/start']) {
    await viewport(390,844); await goto(path); await layout(`mobile ${path}`);
  }
  await viewport(1440);
  await goto('/interview/start',hasText('Start interview'));
  await click('#interview-save-consent'); await click('button','Start interview');
  await waitFor('document.querySelector("progress")','skip scenario');
  await evaluate(installCallMedia());await click('input[aria-label="Speech recognition consent"]');await click('button','Join interview');
  await waitFor('document.querySelector(".call-avatar-listening")','skip call joined');
  await click('button','Skip question');
  await waitFor(hasText('Question 2 of'),'skipped question');
  await click('button','End interview');
  await waitFor(hasText('Your interview feedback'),'early-completion report');
  check('Skipping and early completion keep skipped answers unscored',await evaluate(`${hasText('Not scored')} && ${hasText('1 skipped')} && document.querySelector('.report-qa summary')?.textContent.includes('Skipped')`));
  await click('button','Delete this interview'); await click('dialog button','Permanently delete');
  await waitFor('location.pathname==="/dashboard"','early-session deletion');
  await goto('/account?tab=resume',hasText('Extracted Background Profile'));
  await click('button','Delete saved resumes');
  await waitFor(`!${hasText('Extracted Background Profile')}`,'resume deletion');
  await goto('/resume-intelligence',hasText('Upload Resume'));
  check('Resume deletion produces the upload-empty state',await evaluate(hasText('Upload Resume')));
  await goto('/account',hasText('Profile Details'));
  await click('button','Change Password');
  await fill('#current-password','Browser-test-password-826');
  await fill('#new-password','Changed-browser-password-826');
  await click('button[type="submit"]','Update Password');
  await waitFor(hasText('Password changed successfully'),'password change');
  await waitFor(`!${hasText('Password changed successfully')}`,'password dialog close');
  check('Password change works through the account form',true);
  await click('button[aria-label="Account menu"]');
  await click('button','Logout');
  await waitFor('location.pathname==="/login"','logout');
  await fill('#login-email','browser@example.com');await fill('#login-password','wrong-password');
  await click('button[type="submit"]'); await waitFor('document.querySelector("[role=alert]")','invalid-login error');
  await fill('#login-password','Changed-browser-password-826');await click('button[type="submit"]');
  await waitFor('location.pathname==="/dashboard" && document.querySelector("h1")','valid login');
  check('Logout, invalid login and subsequent valid login',true);
  }
  check('No uncaught browser exceptions',exceptions.length===0);
  check('No unexpected HTTP 5xx responses',serverErrors.length===0);
} catch(error) {
  failures.push(error.message);
  console.log(`FAIL browser: ${error.message}`);
  if(socket?.readyState===WebSocket.OPEN) {
    try {
      await screenshot('failure');
      await writeFile(join(artifacts,'failure-visible-text.txt'),await evaluate('document.body.innerText'));
    } catch { /* Preserve the original failure. */ }
  }
} finally {
  socket?.close();
  const exited = new Promise(resolve=>chrome.once('exit',resolve));
  chrome.kill('SIGTERM');
  await Promise.race([exited,delay(5000)]);
  if(chrome.exitCode===null && chrome.signalCode===null) { chrome.kill('SIGKILL'); await exited; }
  await rm(profile,{recursive:true,force:true});
  const result={checks,failures,exceptions,serverErrors,artifacts};
  await writeFile(join(artifacts,'results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({browser_checks:checks.length,failures,artifacts}));
  process.exitCode=failures.length ? 1 : 0;
}
