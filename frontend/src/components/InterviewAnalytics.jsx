/** Saved delivery observations, deliberately separate from answer-content evaluation. */
export default function InterviewAnalytics({delivery, summary = false}) {
  if (!delivery) return null;
  const value = (n,suffix='') => Number.isFinite(n) ? `${n}${suffix}` : 'Not measured';
  const items = [
    ['Speaking pace',value(delivery.words_per_minute,' words/min')],
    ['Transcript fillers',value(delivery.filler_count)],
    ['Pauses ≥0.5s',value(summary ? delivery.pause_count : delivery.audio?.pause_count)],
    ['Face present in samples',value(delivery.face_presence_percent,'%')],
    ['Interview tab visible',value(delivery.page_visible_percent,'%')],
    ['Confidence · self-rated',value(delivery.confidence_self_rating,' / 5')],
  ];
  return <section className="delivery-feedback">
    <h3 className="font-semibold text-lg">{summary ? 'Speaking, fluency & attention cues' : 'Delivery observations'}</h3>
    <p className="text-xs text-gray-600 mt-2">{summary ? `${delivery.answers_observed} answer(s) with observations. ` : ''}Practice observations, separate from your answer score.</p>
    <dl className="delivery-metrics">{items.map(([label,content])=><div key={label}><dt>{label}</dt><dd>{content}</dd></div>)}</dl>
    {!summary && <>
      <p className="text-xs text-gray-600">Microphone coverage: {value(delivery.audio_coverage_percent,'%')}. Centered framing: {value(delivery.centered_frame_percent,'%')}.</p>
      {delivery.filler_examples?.length > 0 && <p className="mt-2 text-sm">Recognized filler expressions: {delivery.filler_examples.join(', ')}.</p>}
      {delivery.possible_filler_count > 0 && <p className="mt-2 text-xs text-gray-600">Context-dependent expressions: {delivery.possible_filler_examples.join(', ')} ({delivery.possible_filler_count}). These may be meaningful words and are excluded from the filler count.</p>}
      {delivery.transcript_edited && <p className="mt-2 text-xs text-gray-600">The answer was edited or combined with typed text. Speech statistics use the original recognized words.</p>}
      {delivery.coaching?.length > 0 && <ul className="mt-3 list-disc pl-5 space-y-2 text-sm">{delivery.coaching.map(note=><li key={note}>{note}</li>)}</ul>}
    </>}
    <p className="mt-3 text-xs text-gray-600 leading-relaxed">Speech recognition can omit fillers. Microphone energy estimates pauses; noise can affect results. Camera presence and tab visibility do not measure attention, eye contact, or confidence. Pronunciation is not scored.</p>
  </section>;
}
