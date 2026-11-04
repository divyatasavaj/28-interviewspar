import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Features from "../components/Features";
import UiIcon from "../components/UiIcon";

export default function Home() {
  return <div className="site-home min-h-screen font-sans">
    <Navbar/>
    <main><Hero/><section className="home-strip" aria-label="Ways to practice"><div>{[['chat','HR & behavioral practice'],['code','Technical questions'],['file','Resume evidence'],['chart','Saved feedback']].map(([icon,label])=><span key={label}><UiIcon name={icon}/>{label}</span>)}</div></section><Features/></main>
    <footer className="site-footer"><p>InterviewSpar · A little more prepared.</p><div className="flex flex-wrap gap-6"><Link to="/student-guide">Student guide</Link><Link to="/resources">Resources</Link><Link to="/contact">Contact us</Link></div></footer>
  </div>;
}
