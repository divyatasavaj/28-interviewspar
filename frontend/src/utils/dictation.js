/** Own one recognition session so late results cannot enter a later question. */
export function createDictation(Recognition, { onTranscript, onEnd, onError }) {
  const recognition = new Recognition();
  let active = true;
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.onresult = event => {
    if (!active) return;
    let text = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) text += event.results[i][0].transcript + ' ';
    }
    if (text.trim()) onTranscript(text.trim());
  };
  recognition.onerror = () => { if (active) onError(); };
  recognition.onend = () => { if (active) { active = false; onEnd(); } };
  return {
    start() { recognition.start(); },
    stop() { if (active) recognition.stop(); },
    abort() {
      active = false;
      recognition.onresult = recognition.onerror = recognition.onend = null;
      recognition.abort();
    },
  };
}
