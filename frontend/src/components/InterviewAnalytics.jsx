/** Saved observations grouped by what was measured; definitions stay available. */
export default function InterviewAnalytics({delivery,summary=false}) {
  if(!delivery)return null;
  const value=(n,suffix='')=>Number.isFinite(n)?`${n}${suffix}`:'Not measured';
  const speech=[
    ['Speaking pace',value(delivery.words_per_minute,' words/min')],
    ['Transcript fillers',value(delivery.filler_count)],
    ['Pauses ≥0.5s',value(summary?delivery.pause_count:delivery.audio?.pause_count)],
    ['Speech flow · estimate',value(delivery.behavior?.fluency_score,' / 100')],
    ['Confidence cues',delivery.behavior?.confidence_cue || 'Not measured'],
  ];
  const presence=[
    ['Face present in samples',value(delivery.face_presence_percent,'%')],
    ['Interview tab visible',value(delivery.page_visible_percent,'%')],
    ['Attention cues · presence',value(delivery.behavior?.attention_cue_percent,'%')],
  ];
  const metrics=items=><dl className="delivery-metrics">{items.map(([label,content])=><div key={label}><dt>{label}</dt><dd>{content}</dd></div>)}</dl>;
  return <section className="delivery-feedback">
    <header className="delivery-heading"><h3>{summary?'Speaking, confidence & attention cues':'Delivery observations'}</h3><p>{summary?`${delivery.answers_observed} answer(s) with observations. `:''}Practice estimates, separate from your answer score.</p></header>
    <div className="delivery-groups"><section><h4>Speech & delivery</h4>{metrics(speech)}</section><section><h4>Camera & attention</h4>{metrics(presence)}</section></div>
    {!summary && delivery.coaching?.length>0 && <div className="delivery-coaching"><h4>What to try next</h4><ul>{delivery.coaching.map(note=><li key={note}>{note}</li>)}</ul></div>}
    <p className="delivery-limit">Confidence cues describe vocal delivery. Camera presence and tab visibility cannot establish actual attention or eye contact.</p>
    {delivery.behavior && !delivery.behavior.eligible_speech && <p className="delivery-limit">Speech flow and confidence cues need at least 20 recognized words, a 10-second speech span, and sufficient microphone coverage.</p>}
    <details className="measurement-details"><summary>Evidence, definitions & measurement limits</summary><div>
      {delivery.behavior && <><p>{delivery.behavior.note}</p>{delivery.behavior.confidence_basis?.length>0 && <p>Delivery evidence: {delivery.behavior.confidence_basis.join(' · ')}.</p>}<p>Speech flow combines the share of the speech span outside energy gaps with the recognized filler rate. Attention cues multiply sampled face presence by visible-tab time and require both measurements.</p></>}
      {!summary && <><p>Microphone coverage: {value(delivery.audio_coverage_percent,'%')}. Centered framing: {value(delivery.centered_frame_percent,'%')}.</p>
        {delivery.filler_examples?.length>0 && <p>Recognized filler expressions: {delivery.filler_examples.join(', ')}.</p>}
        {delivery.possible_filler_count>0 && <p>Context-dependent expressions: {delivery.possible_filler_examples.join(', ')} ({delivery.possible_filler_count}). These may be meaningful words and are excluded from the filler count.</p>}
        {delivery.transcript_edited && <p>The answer was edited or combined with typed text. Speech statistics use the original recognized words.</p>}</>}
      <p>Speech recognition can omit fillers. Microphone energy estimates pauses; noise can affect results. Pronunciation is not scored.</p>
    </div></details>
  </section>;
}
