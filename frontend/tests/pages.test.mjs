// Server component checks only: effects, browser interactions and layout are not exercised.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, matchRoutes } from 'react-router-dom';
import { createServer } from 'vite';

const pages = [
  ['Home', '/'], ['FeaturesPage', '/features'],
  ['PracticeTracksPage', '/practice-tracks'], ['StudentGuidePage', '/student-guide'],
  ['SubscriptionPage', '/pricing'], ['ResourcesPage', '/resources'],
  ['ContactPage', '/contact'], ['Login', '/login'], ['Signup', '/signup'],
  ['Dashboard', '/dashboard'], ['ResumeIntelligence', '/resume-intelligence'],
  ['AccountManagement', '/account'], ['InterviewType', '/interview-type'],
  ['StartInterviewPage', '/interview/start'], ['InterviewPage', '/interview/example'],
  ['InterviewReportPage', '/interview/example/report'], ['InterviewComplete', '/interview-complete'],
];
let server;
let routes;
const markup = new Map();
before(async () => {
  server = await createServer({
    server: { middlewareMode: true, ws: false },
    appType: 'custom',
    logLevel: 'error',
  });
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  routes = [...app.matchAll(/<Route\s+path="([^"]+)"/g)]
    .map(([, path]) => ({ path })).filter(({ path }) => path !== '*');
  const importedPages = [...app.matchAll(/from "\.\/pages\/([^"/]+)"/g)].map(([, name]) => name);
  assert.deepEqual(importedPages.sort(), pages.map(([name]) => name).sort(),
    'Every routed page must be included in the component checks');
});
after(async () => { await server?.close(); });

for (const [name, path] of pages) {
  test(`${name}: initial component renders and internal links resolve`, async () => {
    const { default: Page } = await server.ssrLoadModule(`/src/pages/${name}.jsx`);
    const html = renderToStaticMarkup(createElement(MemoryRouter,
      { initialEntries: [path] }, createElement(Page)));
    markup.set(name, html);
    assert.ok(html.length > 50, 'Expected visible page or loading state');
    if (pages.findIndex(([entry]) => entry === name) < 9) {
      assert.match(html, /<h1[ >]/, 'Public pages need a primary heading');
    }
    for (const [, href] of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
      if (href.startsWith('/') && !href.startsWith('//')) {
        assert.ok(matchRoutes(routes, new URL(href.replaceAll('&amp;', '&'), 'http://local').pathname),
          `Unmatched internal link on ${name}: ${href}`);
      }
    }
  });
}

for (const name of ['Login', 'Signup']) {
  test(`${name}: every authentication input has an associated label`, () => {
    const html = markup.get(name);
    const labels = new Set([...html.matchAll(/<label\b[^>]*for="([^"]+)"/g)].map(([, id]) => id));
    for (const [input] of html.matchAll(/<input\b[^>]*>/g)) {
      const id = input.match(/\bid="([^"]+)"/)?.[1];
      assert.ok(id && labels.has(id), 'Each sign-in/sign-up field needs a programmatically associated label');
    }
  });
}


test('active call exposes read-only speech and no round steps or confidence input', async () => {
  const {default:CallRoom}=await server.ssrLoadModule('/src/components/interview/CallRoom.jsx');
  const html=renderToStaticMarkup(createElement(MemoryRouter,{},createElement(CallRoom,{
    call:{enabled:true,status:'listening',voiceText:'A recognized answer',interim:'',audio:null},
    question:{id:'screening-1',prompt:'Explain one decision.'},progress:{current:1,total:9,answered:0},busy:false,
  })));
  assert.match(html,/Spoken answer transcript/);
  assert.match(html,/Send spoken answer/);
  assert.doesNotMatch(html,/<textarea|contenteditable|Self-rated confidence|Calibration|interview-rounds/);
});
