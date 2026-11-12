import { useEffect, useRef, useState } from "react"
import { NavLink, Link, useLocation } from "react-router-dom"
import { getToken } from "../api/auth"
import Brand from "./Brand"
import UiIcon from "./UiIcon"

const links = [
  ["Features", "/features"],
  ["Practice tracks", "/practice-tracks"],
  ["Resources", "/resources"],
  ["Pricing", "/pricing"],
]

export default function Navbar() {
  const [openFor, setOpenFor] = useState(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const location = useLocation()
  const menuButton = useRef(null)
  const nav = useRef(null)
  const open = openFor === location.key
  useEffect(() => setLoggedIn(Boolean(getToken())), [location.key])

  useEffect(() => {
    if (!open) return
    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setOpenFor(null)
        menuButton.current?.focus()
      }
    }
    function closeOutside(event) {
      if (!nav.current?.contains(event.target)) setOpenFor(null)
    }
    document.addEventListener("keydown", closeOnEscape)
    document.addEventListener("pointerdown", closeOutside)
    return () => {
      document.removeEventListener("keydown", closeOnEscape)
      document.removeEventListener("pointerdown", closeOutside)
    }
  }, [open])

  const navLinks = links.map(([label, path]) => <NavLink key={path} to={path}>{label}</NavLink>)
  const actions = loggedIn ? (
    <Link className="spar-button" to="/dashboard">Dashboard <UiIcon name="arrow" /></Link>
  ) : (
    <>
      <Link className="public-login" to="/login">Log in</Link>
      <Link className="spar-button" to="/signup">Start practicing <UiIcon name="arrow" /></Link>
    </>
  )

  return (
    <nav ref={nav} className="public-nav fixed top-0 left-0 right-0 z-50" aria-label="Main navigation">
      <div className="public-nav-inner">
        <Brand />
        <div className="public-nav-links">{navLinks}</div>
        <div className="public-nav-actions">{actions}</div>
        <button
          ref={menuButton}
          type="button"
          className="public-menu-toggle"
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls={open ? "public-mobile-menu" : undefined}
          onClick={() => setOpenFor(open ? null : location.key)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <div className="public-mobile-menu" id="public-mobile-menu">
          <NavLink to="/">Home</NavLink>
          {navLinks}
          <NavLink to="/student-guide">Student guide</NavLink>
          <NavLink to="/contact">Contact us</NavLink>
          <div className="public-nav-actions">{actions}</div>
        </div>
      )}
    </nav>
  )
}
