import {useEffect,useRef,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {logout} from '../api/auth';
import Brand from './Brand';
import UiIcon from './UiIcon';

const mainLinks=[['Dashboard','/dashboard'],['Preparation','/preparation'],['Resume intelligence','/resume-intelligence'],['Reports','/account?tab=reports']];
const accountLinks=[['Personal profile','/account?tab=profile'],['Resume & projects','/account?tab=resume'],['Voice & preferences','/account?tab=preferences']];

export default function DashboardNavbar({name}) {
  const [menuOpen,setMenuOpen]=useState(false),[profileOpen,setProfileOpen]=useState(false);
  const location=useLocation(),navigate=useNavigate(),root=useRef(null),accountButton=useRef(null),menuButton=useRef(null);
  useEffect(()=>{setMenuOpen(false);setProfileOpen(false);},[location.key]);
  useEffect(()=>{
    if (!menuOpen && !profileOpen) return;
    const close=e=>{if(e.key==='Escape'){setMenuOpen(false);setProfileOpen(false);(profileOpen?accountButton:menuButton).current?.focus();}};
    const outside=e=>{if(!root.current?.contains(e.target)){setMenuOpen(false);setProfileOpen(false);}};
    document.addEventListener('keydown',close);document.addEventListener('pointerdown',outside);
    return()=>{document.removeEventListener('keydown',close);document.removeEventListener('pointerdown',outside);};
  },[menuOpen,profileOpen]);
  async function signOut(){try{await logout();}catch{/* Local token is cleared even offline. */}finally{navigate('/login');}}
  const active=to=>location.pathname+location.search===to || (to==='/account?tab=profile' && location.pathname==='/account' && !location.search);
  const link=([label,to])=><Link key={to} to={to} aria-current={active(to)?'page':undefined} onClick={()=>{setMenuOpen(false);setProfileOpen(false);}}>{label}</Link>;
  return <nav ref={root} className="workspace-nav fixed top-0 left-0 right-0 z-50" aria-label="Workspace">
    <div className="workspace-nav-inner"><Brand to="/dashboard"/>
      <div className="workspace-links">{mainLinks.map(link)}</div>
      <div className="workspace-actions">{location.pathname !== '/dashboard' && <Link to="/interview-type" className="spar-button"><UiIcon name="mic"/>New interview</Link>}
        <div className="workspace-account"><button ref={accountButton} className="account-trigger" aria-label="Account menu" aria-expanded={profileOpen} aria-controls="workspace-account-menu" onClick={()=>setProfileOpen(v=>!v)}><span>{name?.charAt(0).toUpperCase() || 'U'}</span>Account<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg></button>
          {profileOpen && <div id="workspace-account-menu" className="workspace-dropdown"><p className="workspace-menu-title">{name || 'Your account'}</p>{accountLinks.map(link)}<button className="signout-control" onClick={signOut}>Logout</button></div>}
        </div>
      </div>
      <button ref={menuButton} className="workspace-menu-toggle" aria-label="Toggle menu" aria-expanded={menuOpen} aria-controls="workspace-mobile-menu" onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?'Close':'Menu'}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={menuOpen?'m6 6 12 12M6 18 18 6':'M4 6h16M4 12h16M4 18h16'}/></svg></button>
    </div>
    {menuOpen && <div id="workspace-mobile-menu" className="workspace-mobile-menu"><p className="workspace-menu-title">Your workspace</p>{mainLinks.map(link)}<Link to="/interview-type">New interview</Link><p className="workspace-menu-title">Account</p>{accountLinks.map(link)}<button className="signout-control" onClick={signOut}>Logout</button></div>}
  </nav>;
}
