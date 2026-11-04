import { Link } from "react-router-dom";
import UiIcon from "./UiIcon";

const features = [
  {icon:'chat',title:'Find your own words.',description:'Think through HR, technical and behavioral questions. Practice explaining your approach, one answer at a time.',to:'/practice-tracks',action:'Explore interview practice'},
  {icon:'file',title:'Let your experience show.',description:'Explore the skills and projects documented in your resume. Compare the written evidence with a role or job description.',to:'/resume-intelligence',action:'Explore resume intelligence'},
  {icon:'chart',title:'Take something forward.',description:'Review saved answers and feedback. Text indicators describe keyword and length cues; technical correctness is shown separately when evaluated.',to:'/account?tab=reports',action:'See your practice reports'},
];
export default function Features() {
  return <section className="home-features" id="how-it-works">
    <div className="home-features-header"><div><p className="section-kicker">Make practice part of your next step</p><h2>From “I know this”<br/>to “here’s how I’d explain it.”</h2></div><p>Choose a focus, give it a try, and leave with something useful to work on. Start exactly where you are.</p></div>
    <div className="grid md:grid-cols-3 gap-5">{features.map((feature,i)=><article className="feature-tile" key={feature.title}><div className="tile-top"><UiIcon name={feature.icon}/><span>0{i+1}</span></div><h3>{feature.title}</h3><p>{feature.description}</p><Link to={feature.to}>{feature.action}<UiIcon name="arrow"/></Link></article>)}</div>
    <div className="home-cta"><div><p className="section-kicker mb-3">Your next answer starts here</p><h3>You don’t have to feel ready to begin.</h3><p>A question, a little space to think, and your first attempt.</p></div><Link className="spar-button shrink-0" to="/interview/start">Give it a try<UiIcon name="arrow"/></Link></div>
  </section>;
}
