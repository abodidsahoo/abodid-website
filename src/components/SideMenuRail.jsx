import React, { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Breadcrumbs from "./Breadcrumbs";
import ThemeToggle from "./ThemeToggle.jsx";

const primaryLinks = [
  { href: "/research", label: "Research" },
  { href: "/photography", label: "Photography" },
  { href: "/films", label: "Filmmaking" },
  { href: "/blog", label: "Writing" },
  { href: "/about", label: "About Me" },
];

const secondaryGroups = [
  {
    title: "Resources",
    links: [
      { href: "/resources", label: "Curated Resources" },
      { href: "/bsa-schedule", label: "BSA Conference" },
      { href: "/moodboard", label: "Visual Moodboard" },
      { href: "/photography-portfolio", label: "Photography Portfolio" },
      { href: "/research/obsidian-vault", label: "Obsidian Vault" },
      { href: "/research/second-brain", label: "Second Brain Club" },
    ],
  },
  {
    title: "Work With Me",
    links: [
      { href: "/services", label: "Services" },
      { href: "/workshops", label: "Workshops" },
      { href: "/fundraising", label: "Fundraising" },
      { href: "/collaboration", label: "Collaboration" },
    ],
  },
  {
    title: "Credentials",
    links: [
      { href: "/awards", label: "Awards" },
      { href: "/experience", label: "Experience" },
      { href: "/press", label: "Press" },
      {
        href: "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/cv/Abodid%20Sahoo%20-%20Photography%20&%20AI%20-%20CV.pdf",
        label: "CV",
        target: "_blank",
      },
    ],
  },
  {
    title: "Contact",
    links: [
      { href: "mailto:hello@abodid.com", label: "hello@abodid.com" },
      { href: "tel:+919439094370", label: "+91 94390 94370 (IN)" },
      { href: "tel:+447522258768", label: "+44 7522 258768 (UK)" },
    ],
  },
];

const ease = [0.22, 1, 0.36, 1];

const socialLinks = [
  {
    href: "https://www.instagram.com/abodid.sahoo",
    label: "Instagram",
    target: "_blank",
    iconClass: "fa-brands fa-instagram",
  },
  {
    href: "https://uk.linkedin.com/in/abodidsahoo",
    label: "LinkedIn",
    target: "_blank",
    iconClass: "fa-brands fa-linkedin",
  },
  {
    href: "https://vimeo.com/abodidsahoo",
    label: "Vimeo",
    target: "_blank",
    iconClass: "fa-brands fa-vimeo",
  },
  {
    href: "https://github.com/abodidsahoo",
    label: "GitHub",
    target: "_blank",
    iconClass: "fa-brands fa-github",
  },
];

const SideMenuRail = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [headerOffset, setHeaderOffset] = useState(80);
  const progressBarRef = useRef(null);

  useEffect(() => {
    const syncHeaderOffset = () => {
      const nav = document.querySelector(".fixed-nav");
      const navHeight = nav?.getBoundingClientRect().height;
      setHeaderOffset(Math.round(navHeight || (window.innerWidth <= 768 ? 70 : 80)));
    };

    syncHeaderOffset();
    window.addEventListener("resize", syncHeaderOffset);

    return () => {
      window.removeEventListener("resize", syncHeaderOffset);
    };
  }, []);

  // Scroll Progress Effect
  useEffect(() => {
    const progressBar = progressBarRef.current;
    if (!progressBar || typeof window === 'undefined') return undefined;

    let frameId = 0;
    let resizeObserver;

    const updateProgress = () => {
      frameId = 0;

      const doc = document.documentElement;
      const maxScroll = Math.max(doc.scrollHeight - doc.clientHeight, 0);
      const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      const clampedProgress = Math.min(Math.max(progress, 0), 1);

      progressBar.style.transform = `scaleY(${clampedProgress})`;
    };

    const requestProgressUpdate = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(updateProgress);
    };

    requestProgressUpdate();
    window.addEventListener('scroll', requestProgressUpdate, { passive: true });
    window.addEventListener('resize', requestProgressUpdate);
    window.addEventListener('load', requestProgressUpdate);

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(requestProgressUpdate);
      resizeObserver.observe(document.body);
    }

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('scroll', requestProgressUpdate);
      window.removeEventListener('resize', requestProgressUpdate);
      window.removeEventListener('load', requestProgressUpdate);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const closeMenu = () => setIsOpen(false);
  const toggleMenu = () => setIsOpen((current) => !current);

  return (
    <>
      <div
        className={`side-menu-shell ${isOpen ? "is-open" : ""}`}
        style={{
          "--header-offset": `${headerOffset}px`,
          "--side-menu-top": `0px`,
          "--side-panel-height": `100vh`,
        }}
      >
        <div className="side-menu-rail">
          <div className="rail-top-group">
            <button
              type="button"
              className="rail-action-btn rail-action-top"
              aria-controls="side-menu-panel"
              aria-expanded={isOpen}
              aria-label={isOpen ? "Close site menu" : "Open site menu"}
              onClick={toggleMenu}
            >
              <span className="side-menu-rail-top" aria-hidden="true">
                <span className="hamburger-line" />
                <span className="hamburger-line" />
                <span className="hamburger-line" />
              </span>
            </button>
            <ThemeToggle />
          </div>

          <div className="rail-bottom-group">
            <div className="vertical-breadcrumbs-wrapper">
               <Breadcrumbs variant="vertical" />
            </div>
            
            <button
               type="button"
               className="rail-action-btn rail-action-bottom"
               aria-controls="side-menu-panel"
               aria-expanded={isOpen}
               onClick={toggleMenu}
               aria-label={isOpen ? "Close site menu" : "Open site menu"}
            >
               <span className="side-menu-rail-label">Menu</span>
            </button>
          </div>

          <div className="side-menu-scroll-track" aria-hidden="true">
            <div ref={progressBarRef} className="side-menu-scroll-bar" />
          </div>
        </div>

        <AnimatePresence>
          {isOpen && (
            <>
              <motion.button
                type="button"
                className="side-menu-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease }}
                onClick={closeMenu}
                aria-label="Close side menu"
              />

              <motion.aside
                id="side-menu-panel"
                className="side-menu-panel"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.45, ease }}
                aria-label="Site menu"
              >
                <div className="side-menu-main">
                  {primaryLinks.map((link) => (
                    <SideMenuLink
                      key={link.href}
                      href={link.href}
                      className="side-menu-primary-link"
                      onClick={closeMenu}
                      slide={10}
                    >
                      {link.label}
                    </SideMenuLink>
                  ))}
                </div>

                <div className="side-menu-secondary">
                  <div className="side-menu-secondary-grid">
                    <div className="side-menu-column">
                      {secondaryGroups.slice(0, 2).map((group) => (
                        <div className="side-menu-group" key={group.title}>
                          <div className="side-menu-group-title">{group.title}</div>
                          {group.links.map((link) => (
                            <SideMenuLink
                              key={`${group.title}-${link.href}`}
                              href={link.href}
                              target={link.target}
                              rel={link.target === "_blank" ? "noreferrer" : undefined}
                              className="side-menu-secondary-link"
                              onClick={closeMenu}
                              slide={8}
                            >
                              {link.label}
                            </SideMenuLink>
                          ))}
                        </div>
                      ))}
                    </div>

                    <div className="side-menu-column side-menu-column-right">
                      <div className="side-menu-group" key="credentials">
                        <div className="side-menu-group-title">{secondaryGroups[2].title}</div>
                        {secondaryGroups[2].links.map((link) => (
                          <SideMenuLink
                            key={`${secondaryGroups[2].title}-${link.href}`}
                            href={link.href}
                            target={link.target}
                            rel={link.target === "_blank" ? "noreferrer" : undefined}
                            className="side-menu-secondary-link"
                            onClick={closeMenu}
                            slide={8}
                          >
                            {link.label}
                          </SideMenuLink>
                        ))}
                      </div>

                      <div className="side-menu-group" key="contact">
                        <div className="side-menu-group-title">{secondaryGroups[3].title}</div>
                        {secondaryGroups[3].links.map((link) => (
                          <SideMenuLink
                            key={`${secondaryGroups[3].title}-${link.href}`}
                            href={link.href}
                            target={link.target}
                            rel={link.target === "_blank" ? "noreferrer" : undefined}
                            className="side-menu-secondary-link"
                            onClick={closeMenu}
                            slide={8}
                          >
                            {link.label}
                          </SideMenuLink>
                        ))}
                      </div>

                      <div className="side-menu-social-links" aria-label="Social links">
                        {socialLinks.map((link) => (
                          <motion.a
                            key={link.label}
                            href={link.href}
                            target={link.target}
                            rel="noreferrer"
                            className="side-menu-social-link"
                            aria-label={link.label}
                            title={link.label}
                            onClick={closeMenu}
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.12, ease: "easeOut" }}
                          >
                            <i className={link.iconClass} aria-hidden="true" />
                          </motion.a>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>

      <style suppressHydrationWarning>{`
        :root {
          --app-rail-width: 76px;
        }
        @media (max-width: 768px) {
          :root {
            --app-rail-width: 66px;
          }
        }

        body {
          padding-left: var(--app-rail-width);
          overflow-x: hidden;
        }

        .fixed-nav {
          left: var(--app-rail-width) !important;
          width: calc(100% - var(--app-rail-width)) !important;
        }

        .side-menu-shell {
          --rail-width: var(--app-rail-width);
          --panel-width: min(720px, calc(100vw - var(--app-rail-width)));
          --panel-gap: 0px;
          position: fixed;
          top: 0;
          left: 0;
          z-index: 10006;
          pointer-events: none;
        }

        .side-menu-shell > * {
          pointer-events: auto;
        }

        .side-menu-rail {
          position: relative;
          z-index: 10005;
          width: var(--rail-width);
          height: 100vh;
          border: 0;
          border-radius: 0;
          background: var(--color-brand-red);
          color: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 1.15rem 0.65rem 2.5rem; /* Increased bottom padding to lift Menu up slightly */
          box-shadow: 0 22px 44px rgba(0, 0, 0, 0.28);
          transition: box-shadow 0.25s ease, border-radius 0.25s ease;
        }

        .side-menu-rail:hover {
          box-shadow: 0 26px 50px rgba(0, 0, 0, 0.34);
        }

        .side-menu-scroll-track {
          position: absolute;
          top: 0;
          right: 0;
          width: 4px; /* thick white line */
          height: 100vh;
          background: transparent;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }

        .side-menu-shell.is-open .side-menu-scroll-track {
          opacity: 0;
        }

        .side-menu-scroll-bar {
          width: 100%;
          height: 100%;
          background: #ffffff;
          transform: scaleY(0);
          transform-origin: top center;
          will-change: transform;
        }

        .rail-action-btn {
          background: transparent;
          border: none;
          color: inherit;
          cursor: pointer;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }

        .side-menu-rail-top {
          position: relative;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .rail-top-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2.4rem;
          width: 100%;
        }

        .rail-bottom-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          width: 100%;
        }

        .vertical-breadcrumbs-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end; /* allows content to flow upwards if needed visually */
          width: 100%;
        }

        .hamburger-line {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 34px;
          height: 2px;
          border-radius: 999px;
          background: #fff;
          display: block;
          margin: 0;
          transform-origin: center;
          transition: transform 0.24s ease, opacity 0.18s ease;
          transform: translate(-50%, -50%);
        }

        .hamburger-line:nth-child(1) {
          transform: translate(-50%, calc(-50% - 8px));
        }

        .hamburger-line:nth-child(2) {
          transform: translate(-50%, -50%);
        }

        .hamburger-line:nth-child(3) {
          transform: translate(-50%, calc(-50% + 8px));
        }

        .side-menu-shell.is-open .hamburger-line:nth-child(1) {
          transform: translate(-50%, -50%) rotate(45deg);
        }

        .side-menu-shell.is-open .hamburger-line:nth-child(2) {
          opacity: 0;
        }

        .side-menu-shell.is-open .hamburger-line:nth-child(3) {
          transform: translate(-50%, -50%) rotate(-45deg);
        }

        .side-menu-rail-label {
          font-family: var(--font-ui);
          font-size: 0.84rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.62em;
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          line-height: 1;
          white-space: nowrap;
          transition: letter-spacing 0.25s ease;
        }

        .side-menu-shell.is-open .side-menu-rail-label {
          letter-spacing: 0.32em;
        }

        .side-menu-backdrop {
          position: fixed;
          inset: 0;
          border: 0;
          background: rgba(4, 4, 4, 0.18);
          z-index: 10002;
          cursor: pointer;
        }

        .side-menu-panel {
          position: fixed;
          top: var(--side-menu-top);
          left: var(--rail-width);
          width: var(--panel-width);
          height: var(--side-panel-height);
          display: grid;
          grid-template-rows: minmax(300px, 51%) 1fr;
          background: rgba(255, 255, 255, 0.92);
          z-index: 10003;
          border-radius: 0;
          overflow: hidden;
          border: none;
          box-shadow: 0 28px 70px rgba(0, 0, 0, 0.34);
          transform-origin: left center;
          cursor: auto !important;
        }

        .side-menu-main {
          background: var(--color-brand-red);
          color: #fff;
          padding: 2.45rem 2.5rem 2.55rem 2.9rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 1rem;
        }

        .side-menu-primary-link {
          color: inherit;
          text-decoration: none;
          font-family: var(--font-display);
          font-size: clamp(1.95rem, 2.65vw, 3rem);
          font-weight: 650;
          letter-spacing: -0.03em;
          line-height: 1.02;
          width: fit-content;
          display: block;
          cursor: pointer !important;
        }

        .side-menu-secondary {
          background: rgba(255, 255, 255, 0.96);
          color: #171717;
          padding: 1.7rem 2.3rem 1.85rem 2.85rem;
          overflow: hidden;
          display: block;
        }

        .side-menu-secondary-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 0.96fr);
          gap: 1.75rem;
          width: 100%;
          align-items: start;
        }

        .side-menu-column {
          display: flex;
          flex-direction: column;
          gap: 1.85rem;
        }

        .side-menu-column-right {
          justify-content: flex-start;
        }

        .side-menu-group {
          display: flex;
          flex-direction: column;
          gap: 0.24rem;
          min-width: 0;
        }

        .side-menu-group-title {
          font-family: var(--font-mono);
          font-size: 0.86rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #111;
          margin-bottom: 0.48rem;
        }

        .side-menu-secondary-link {
          color: #414141;
          text-decoration: none;
          font-family: var(--font-mono);
          font-size: 0.88rem;
          font-weight: 500;
          line-height: 1.48;
          width: fit-content;
          display: block;
          transition: color 0.2s ease, opacity 0.2s ease;
          cursor: pointer !important;
        }

        .side-menu-secondary-link:hover {
          color: var(--color-brand-red);
          opacity: 0.7;
        }

        .side-menu-social-links {
          display: flex;
          align-items: center;
          gap: 1.1rem;
          flex-wrap: wrap;
          justify-content: flex-start;
          padding-top: 0.55rem;
        }

        .side-menu-social-link {
          width: auto;
          height: auto;
          border: 0;
          color: #2d2d2d;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          transition: color 0.2s ease, opacity 0.2s ease, transform 0.2s ease;
          cursor: pointer !important;
        }

        .side-menu-social-link:hover {
          color: var(--color-brand-red);
          opacity: 0.8;
        }

        .side-menu-social-link i {
          font-size: 1.5rem;
          line-height: 1;
        }

        @media (max-width: 980px) {
          .side-menu-shell {
            --panel-width: min(540px, calc(100vw - 1rem));
            --panel-gap: 0px;
          }

          .side-menu-panel {
            grid-template-rows: auto 1fr;
          }

          .side-menu-main,
          .side-menu-secondary {
            padding-left: 1.6rem;
            padding-right: 1.6rem;
          }

          .side-menu-primary-link {
            font-size: clamp(1.55rem, 5.4vw, 2.2rem);
          }

          .side-menu-secondary {
            overflow: auto;
          }

          .side-menu-secondary-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .side-menu-shell {
            --rail-width: 66px;
            --panel-width: calc(100vw - 66px);
            --panel-gap: 0px;
          }

          .side-menu-rail {
            height: 100vh;
            border-radius: 0;
            padding-top: 0.95rem;
          }

          .hamburger-line {
            width: 28px;
            height: 2px;
          }

          .side-menu-rail-top {
            width: 28px;
            height: 28px;
          }

          .hamburger-line:nth-child(1) {
            transform: translate(-50%, calc(-50% - 6px));
          }

          .hamburger-line:nth-child(3) {
            transform: translate(-50%, calc(-50% + 6px));
          }

          .side-menu-shell.is-open .hamburger-line:nth-child(1) {
            transform: translate(-50%, -50%) rotate(45deg);
          }

          .side-menu-shell.is-open .hamburger-line:nth-child(3) {
            transform: translate(-50%, -50%) rotate(-45deg);
          }

          .side-menu-rail-label {
            font-size: 0.72rem;
            letter-spacing: 0.45em;
          }

          .side-menu-panel {
            left: var(--rail-width);
            border-radius: 0;
          }

          .side-menu-main {
            gap: 1.05rem;
            padding-top: 2rem;
            padding-bottom: 2rem;
          }

          .side-menu-secondary {
            gap: 1rem;
          }
        }
      `}</style>
    </>
  );
};

const SideMenuLink = ({ children, className, slide = 8, ...props }) => {
  return (
    <a className={className} {...props}>
      <motion.span
        style={{ display: "inline-block" }}
        transition={{ duration: 0.05, ease: "easeOut" }}
        whileHover={{ x: slide }}
      >
        {children}
      </motion.span>
    </a>
  );
};

export default SideMenuRail;
