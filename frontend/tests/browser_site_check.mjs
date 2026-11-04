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
import {checkInterviewCall} from './call_browser_checks.mjs';

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
  await command('Page.bringToFront');
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
  if (process.env.CALL_ONLY !== '1') {
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
  if (process.env.CALL_ONLY === '1') {
    await checkInterviewCall({goto,click,fill,select,waitFor,evaluate,check,command,screenshot,viewport,layout,hasText});
  } else {
  await layout('desktop dashboard'); await screenshot('dashboard-desktop');
  await viewport(768,1024); await layout('tablet dashboard'); await screenshot('dashboard-tablet'); await viewport(1440);
  await goto('/account',hasText('Profile Details'));
  await fill('input[type="text"]','Browser Updated');
  await click('button','Save Changes');
  await waitFor(hasText('Profile details saved successfully'),'profile save');
  await goto('/account',hasText('Profile Details'));
  check('Profile changes survive reload', await evaluate('document.querySelector("input[type=text]").value==="Browser Updated"'));
  await goto('/account?tab=resume',hasText('Resume Upload & Parser'));
  const document = await command('DOM.getDocument');
  const fileInput = await command('DOM.querySelector',{nodeId:document.root.nodeId,selector:'input[type="file"]'});
  await command('DOM.setFileInputFiles',{nodeId:fileInput.nodeId,files:[resolve(fixture)]});
  await waitFor(hasText('Parse synthetic.pdf'),'file selection');
  check('Resume upload remains disabled without consent',await evaluate(`(${element('button','Parse synthetic.pdf')}).disabled`));
  await click('input[type="checkbox"]'); await click('button','Parse synthetic.pdf');
  await waitFor(hasText('Extracted Background Profile'),'parsed resume');
  check('PDF file upload renders extracted skills',await evaluate(hasText('Python')));
  await goto('/resume-intelligence',hasText('What are you preparing for?'));
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
  await checkInterviewCall({goto,click,fill,select,waitFor,evaluate,check,command,screenshot,viewport,layout,hasText});
  for (const [persona,count] of [['hr',9],['technical',13]]) {
    await goto(`/interview/start?persona=${persona}`,hasText('Start interview'));
    await waitFor('document.querySelectorAll("select option").length>4','interview domains');
    check(`${persona} start link selects the intended track`,await evaluate(`document.querySelectorAll('select')[1].value===${JSON.stringify(persona)}`));
    if(persona==='hr') await select('form label:nth-of-type(5) select','assessment');
    await click('input[type="checkbox"]'); await click('button','Start interview');
    await waitFor('document.querySelector("progress")','first interview question');
    for(let i=0;i<count;i++) {
      assert.equal(await evaluate('document.querySelectorAll("h1").length'), 1, `${persona} question ${i+1} must replace the previous prompt`);
      const question = await evaluate('document.querySelector("h1").innerText');
      if(i===0) {
        await viewport(390,844); await layout(`mobile ${persona} interview`); await screenshot(`${persona}-interview-mobile`); await viewport(1440);
        await evaluate('window.__beforeReload = true');
        await command('Page.reload'); await waitFor('!window.__beforeReload && document.querySelector("progress")','interview reload');
        check(`${persona} active interview survives reload`,await evaluate(`document.querySelector('h1').innerText===${JSON.stringify(question)}`));
      }
      if(await evaluate(`!!document.querySelector('textarea[aria-label="Your code"]')`)) {
        await select('select[aria-label="Code language"]','python');
        await fill('textarea[aria-label="Your code"]','def solve(nums, target):\n    return [0, 1]');
        await click('button','Run tests');
        await waitFor(hasText('not configured'),'coding unavailable message');
        check('Coding language/editor and unavailable-runner state',true);
      }
      await fill('form textarea','For example I built an inventory dashboard because the team needed visibility. The result reduced manual checking, and I learned to document the tests.');
      await click('button','Submit answer');
      await waitFor(`location.pathname.endsWith('/report') || (document.querySelector('h1')?.innerText!==${JSON.stringify(question)} && !${hasText('Saving answer')})`,'next interview question');
    }
    await waitFor(hasText('Your interview feedback'),'completed report');
    check(`${persona} entire interview and report`,await evaluate(hasText(`Answered ${count} of ${count}`)));
    await screenshot(`${persona}-report-desktop`);
    const pdf = await command('Page.printToPDF',{printBackground:true});
    await writeFile(join(artifacts,`${persona}-report.pdf`),Buffer.from(pdf.data,'base64'));
    check(`${persona} report produces a PDF`,Buffer.from(pdf.data,'base64').subarray(0,5).toString()==='%PDF-');
    await goto('/account?tab=reports',hasText('View Report'));
    await click('button','View Report');
    await waitFor(hasText('Your interview feedback'),'saved history report');
    check(`${persona} saved report opens from account history`,await evaluate('location.pathname==="/interview-complete"'));
    await click('button','Delete this interview');
    await waitFor('location.pathname==="/dashboard"','interview deletion');
  }
  for (const path of ['/dashboard','/account?tab=profile','/account?tab=resume','/account?tab=reports','/account?tab=preferences','/interview-type','/interview/start']) {
    await viewport(390,844); await goto(path); await layout(`mobile ${path}`);
  }
  await viewport(1440);
  await goto('/interview/start',hasText('Start interview'));
  await click('input[type="checkbox"]'); await click('button','Start interview');
  await waitFor('document.querySelector("progress")','skip scenario');
  await click('button','Skip question');
  await waitFor(hasText('Question 2 of'),'skipped question');
  await click('button','Finish and view report');
  await waitFor(hasText('Your interview feedback'),'early-completion report');
  check('Skipping and early completion keep skipped answers unscored',await evaluate(`${hasText('Not scored')} && ${hasText('skipped 1')}`));
  await click('button','Delete this interview');
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
