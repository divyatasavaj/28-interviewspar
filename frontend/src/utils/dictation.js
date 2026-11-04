/** Own one recognition session so late results cannot enter a later question. */
export function createDictation(Recognition, { onTranscript, onEnd, onError, onInterim = () => {}, onStart = () => {}, language = 'en-US' }) {
  const recognition = new Recognition();
  let active = true, stopping = false;
  let stopTimer, startTimer, settle;
  const ended = new Promise(resolve => { settle = resolve; });
  recognition.lang = language;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onstart = () => { clearTimeout(startTimer); if (active) onStart(); };
  recognition.onresult = event => {
    if (!active) return;
    let text = '', interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) text += event.results[i][0].transcript + ' ';
      else interim += event.results[i][0].transcript + ' ';
    }
    if (text.trim()) onTranscript(text.trim());
    onInterim(interim.trim());
  };
  recognition.onerror = event => { if (active) onError(event.error); };
  recognition.onend = () => { if (active) { active = false; clearTimeout(startTimer); clearTimeout(stopTimer); onInterim(''); onEnd(); settle({status:'ended'}); } };
  return {
    start() {
      startTimer = setTimeout(() => {
        if (!active) return;
        active = false; recognition.abort(); settle({status:'timeout'}); onError('start-timeout'); onEnd();
      }, 10000);
      recognition.start();
    },
    stop() {
      if (active && !stopping) {
        stopping = true;
        recognition.stop();
        stopTimer = setTimeout(() => {
          if (!active) return;
          active = false; recognition.abort(); settle({status:'timeout'}); onInterim(''); onError('finalization-timeout'); onEnd();
        }, 3000);
      }
      return ended;
    },
    abort() {
      active = false;
      clearTimeout(startTimer); clearTimeout(stopTimer); settle({status:'aborted'});
      recognition.onresult = recognition.onerror = recognition.onend = null;
      recognition.abort();
    },
  };
}
