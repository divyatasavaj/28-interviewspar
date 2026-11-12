export default function LoadingCards({ label = 'Loading…' }) {
  return <div role="status" className="loading-cards" aria-label={label}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true"/><div aria-hidden="true"/><div aria-hidden="true"/>
  </div>;
}
