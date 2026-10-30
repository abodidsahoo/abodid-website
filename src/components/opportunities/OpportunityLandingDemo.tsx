import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Bell,
  MapPin,
  Send,
  Pause,
  Paperclip,
  LockKeyhole,
  LayoutGrid,
  ArrowUpRight,
  MousePointer2,
  ArrowLeft,
  ArrowRight,
  Puzzle,
  Sparkles,
} from 'lucide-react';
import { OpportunityMark } from './OpportunityMark';
import { getOpportunityCategoryIconUrl } from '../../lib/opportunities/ui-helpers';
import '../../styles/opportunity-landing-preview.css';

const STEPS = ['Right-click', 'Extension', 'Voice notes', 'Grid view', 'Details'];

// Named examples are demo cards; dates and countdowns are illustrative.
const EXAMPLES = [
  { id: 'fellowship', title: 'Tokyo Creative Fellowship', organisation: 'Horizon Arts', category: 'fellowship', label: 'Fellowship', days: 12, deadline: '12 April 2027', location: 'Tokyo, Japan', funding: 'Studio + research support', nextAction: 'Prepare your portfolio and project proposal.' },
  { id: 'magnum', title: 'Magnum Photo Workshop, UK', organisation: 'Magnum Photos', category: 'event', label: 'Workshop', days: 3, deadline: '3 April 2027', location: 'London, UK', funding: 'See workshop details', nextAction: 'Select your strongest photographs and review the workshop brief.' },
  { id: 'grant', title: 'Creative Futures Grant, EU', organisation: 'Future Forms', category: 'grant', label: 'Grant', days: 28, deadline: '28 April 2027', location: 'Europe / remote', funding: 'Project funding', nextAction: 'Draft your project plan and a simple budget.' },
  { id: 'cambridge', title: 'AI for Science Summit, UK', organisation: 'University of Cambridge', category: 'conference', label: 'Conference', days: 18, deadline: '18 April 2027', location: 'Cambridge, UK', funding: 'See registration details', nextAction: 'Review the programme and plan who you’d like to meet.' },
  { id: 'chi', title: 'ACM CHI 2027, USA', organisation: 'ACM SIGCHI', category: 'conference', label: 'Conference', days: 21, deadline: '21 April 2027', location: 'Pittsburgh, USA', funding: 'See registration details', nextAction: 'Explore the programme and shortlist relevant sessions.' },
  { id: 'oxford', title: 'Oxford Research Meetup, UK', organisation: 'University of Oxford', category: 'event', label: 'Personal event', days: 18, deadline: '18 April 2027 · 4 pm', location: 'Oxford, UK', funding: 'Personal meetup', nextAction: 'Prepare a short introduction and your research questions.' },
];

function TelegramPreview() {
  return (
    <div className="otd-visual otd-telegram-visual">
      <div className="otd-telegram-layout">
        <div className="otd-phone">
          <div className="otd-phone-status"><span>9:41</span><i aria-hidden="true" /><span aria-hidden="true">▰</span></div>
          <div className="otd-telegram-header">
            <ArrowLeft size={16} aria-hidden="true" />
            <span className="otd-bot-avatar"><Send size={19} aria-hidden="true" /></span>
            <div><strong>Abodid Opportunity Tracker Bot</strong><span>bot · connected <Check size={9} aria-hidden="true" /></span></div>
          </div>
          <div className="otd-chat">
            <span className="otd-chat-date">TODAY</span>
            <p className="otd-chat-bubble is-incoming">You’re connected. Send a voice note, a link, or a few words.</p>
            <div className="otd-chat-bubble is-outgoing otd-voice-note">
              <div className="otd-voice-player" role="img" aria-label="Voice note halfway through: 14 of 28 seconds">
                <span className="otd-voice-pause"><Pause size={17} fill="currentColor" aria-hidden="true" /></span>
                <span className="otd-waveform" aria-hidden="true">
                  {[12,21,16,28,20,34,25,14,30,19,26,35,18,27,13,22,31,16,25,12,20,28,15,23].map((height, index) => <i key={index} style={{ height }} className={index < 12 ? 'is-played' : ''} />)}
                </span>
              </div>
              <span className="otd-voice-time">0:14 / 0:28 <span>Voice note ✓✓</span></span>
            </div>
            <div className="otd-chat-bubble is-incoming otd-bot-summary">
              <span><Check size={12} aria-hidden="true" /> Added to your radar</span>
              <strong>Tokyo Creative Fellowship</strong>
              <p>Tokyo, Japan · Apply by 12 Apr</p>
            </div>
            <p className="otd-chat-bubble is-outgoing">Oxford research meetup, UK.<br />18 April, 4 pm.</p>
            <span className="otd-chat-saved"><Check size={11} aria-hidden="true" /> Event saved, too.</span>
          </div>
          <div className="otd-phone-composer"><Paperclip size={16} aria-hidden="true" /><span>Message</span><Send size={17} aria-hidden="true" /></div>
          <div className="otd-phone-home" aria-hidden="true" />
        </div>
        <div className="otd-telegram-callouts">
          <div className="otd-callout"><span>01</span><strong>Connect once.</strong><p>Settings → Telegram.</p></div>
          <div className="otd-callout"><span>02</span><strong>Voice or text.</strong><p>A voice note, a link,<br />or the event details.</p></div>
          <div className="otd-callout"><span>03</span><strong>On your radar.</strong><p>Auto-transcribed,<br />summarized, and added.</p></div>
        </div>
      </div>
    </div>
  );
}


function ExampleWebsite({ extension = false }: { extension?: boolean }) {
  return (
    <div className={`otd-browser ${extension ? 'otd-browser-extension' : ''}`}>
      <div className="otd-browser-toolbar">
        <span className="otd-window-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="otd-address">
          <LockKeyhole size={11} />
          horizonarts.example/fellowship
        </span>
        <Puzzle size={16} className="otd-puzzle" />
        <span
          className={`otd-extension-icon ${extension ? 'otd-extension-highlight' : ''}`}
        >
          <OpportunityMark />
        </span>
      </div>
      <div className="otd-site-page">
        <div className="otd-site-header">
          <strong>Horizon Arts</strong>
          <span>Opportunities</span>
        </div>
        <span className="otd-site-label">RESEARCH / OPEN CALL</span>
        <h3>
          Tokyo Creative
          <br />
          Fellowship
        </h3>
        <p>Time and space to explore a new idea.</p>
        <p className="otd-site-location"><MapPin size={12} aria-hidden="true" /> Tokyo, Japan</p>
        <p className="otd-site-description">
          A six-week fellowship for artists working across research, moving
          image and emerging technology.
        </p>
        <p className="otd-site-deadline">
          Apply by <strong>12 April 2027</strong>
        </p>
      </div>
      {extension ? (
        <div className="otd-extension-popup">
          <div className="otd-popup-brand">
            <OpportunityMark /> OPPORTUNITY TRACKER
          </div>
          <div className="otd-popup-card">
            <span className="otd-small-label">CURRENT TAB</span>
            <strong>Tokyo Creative Fellowship</strong>
            <span className="otd-save-action">
              Save opportunity <span>↗</span>
            </span>
            <div className="otd-processing-point">
            <div className="otd-processing">
              <Sparkles size={16} />
              <span>
                Processing opportunity
                <span className="otd-processing-dots">…</span>
              </span>
            </div>
            <div className="otd-ai-callout"><strong>AI-powered</strong><span>smart data extraction and analysis.</span></div>
            </div>
            <small>Your page is captured. We’ll organize the details.</small>
          </div>
        </div>
      ) : (
        <div className="otd-mac-menu">
          <span>Back <small>⌘[</small></span>
          <span className="otd-menu-disabled">Forward <small>⌘]</small></span>
          <span>Reload <small>⌘R</small></span>
          <hr />
          <span>Save As… <small>⇧⌘S</small></span>
          <span>Print… <small>⌘P</small></span>
          <hr />
          <span className="otd-menu-save">
            <OpportunityMark /> Save page to opportunity tracker
          </span>
          <hr />
          <span>View Page Source <small>⌥⌘U</small></span>
          <span>Inspect <small>⌥⌘I</small></span>
          <MousePointer2
            className="otd-pointer"
            size={24}
            fill="#171717"
            stroke="#fff"
            strokeWidth={1.5}
          />
        </div>
      )}
    </div>
  );
}

export function OpportunityLandingDemo() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(EXAMPLES[0]);
  const detailsTitle = useRef<HTMLHeadingElement>(null);
  const cardButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingFocus = useRef<'details' | 'card' | null>(null);

  useEffect(() => {
    if (pendingFocus.current === 'details' && step === 4) detailsTitle.current?.focus({ preventScroll: true });
    if (pendingFocus.current === 'card' && step === 3) cardButtons.current[selected.id]?.focus({ preventScroll: true });
    pendingFocus.current = null;
  }, [step, selected]);

  const openExample = (example: (typeof EXAMPLES)[number]) => {
    pendingFocus.current = 'details';
    setSelected(example);
    setStep(4);
  };


  return (
    <section
      id="how-it-works"
      className="otl-walkthrough otd-demo"
      aria-labelledby="otl-walkthrough-title"
      tabIndex={-1}
    >
      <div className="otl-section-heading">
        <p className="otl-eyebrow">HOW IT WORKS</p>
        <h2 id="otl-walkthrough-title">Found an amazing opportunity?<span className="otd-walkthrough-tagline">Seamlessly keep track of it.</span></h2>
      </div>
      <div className="otd-preview">
        <ol className="otd-steps" role="list">
          {STEPS.map((label, index) => (
            <li key={label} aria-current={step === index ? 'step' : undefined}>
              <span>{String(index + 1).padStart(2, '0')}</span> {label}
            </li>
          ))}
        </ol>
      <div className="otd-controls">
        <button
          type="button"
          onClick={() => setStep((value) => (value + STEPS.length - 1) % STEPS.length)}
          aria-label="Previous walkthrough step"
          aria-controls="otl-demo-scenes"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setStep((value) => (value + 1) % STEPS.length)}
          aria-label="Next walkthrough step"
          aria-controls="otl-demo-scenes"
        >
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
        <p className="otl-sr-only" role="status" aria-atomic="true">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
        <div className="otd-scenes" id="otl-demo-scenes">
          <div className="otd-scene" hidden={step !== 0}>
            <div className="otd-caption">
              <h3>Found something worth keeping?</h3>
              <p>
                Right-click the page. Choose{' '}
                <strong>Save page to opportunity tracker.</strong>
              </p>
            </div>
            <div className="otd-visual">
              <ExampleWebsite />
            </div>
          </div>
          <div className="otd-scene" hidden={step !== 1}>
            <div className="otd-caption">
              <h3>Or use the extension.</h3>
              <p>
                Open it from your browser toolbar and choose{' '}
                <strong>Save opportunity.</strong>
              </p>
            </div>
            <div className="otd-visual">
              <ExampleWebsite extension />
            </div>
          </div>
          <div className="otd-scene" hidden={step !== 2}>
            <div className="otd-caption">
              <h3>Say it now. Find it later.</h3>
              <p>Connect Telegram. Drop a voice note or type an opportunity or event.</p>
            </div>
            <TelegramPreview />
          </div>
          <div className="otd-scene" hidden={step !== 3}>
            <div className="otd-caption">
              <h3>See everything in one grid.</h3>
              <p>A little space for every possibility. Click a card to look closer.</p>
            </div>
            <div className="otd-visual otd-grid-visual">
              <div className="otd-grid-toolbar">
                <div><h3>Your radar</h3><span>Sample opportunities &amp; events.</span></div>
                <span className="otd-grid-active"><LayoutGrid size={15} aria-hidden="true" /> Grid view</span>
              </div>
              <div className="otd-card-grid">
                {EXAMPLES.map((example) => (
                  <article key={example.id} className="otd-opportunity-card">
                    <span className={`otd-card-countdown ${example.days <= 3 ? 'is-soon' : ''}`}>
                      <i aria-hidden="true" />{example.days} days left
                    </span>
                    <h4>
                      <button
                        type="button"
                        ref={(node) => { cardButtons.current[example.id] = node; }}
                        onClick={() => openExample(example)}
                      >{example.title}</button>
                    </h4>
                    <div className="otd-card-context">
                      <p>{example.organisation}</p>
                      <span><MapPin size={11} aria-hidden="true" />{example.location}</span>
                    </div>
                    <footer>
                      <span className="otd-card-category">
                        <img src={getOpportunityCategoryIconUrl(example.category)} alt="" width="30" height="30" loading="lazy" />
                        <span>{example.label}</span>
                      </span>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </footer>
                  </article>
                ))}
              </div>
            </div>
          </div>
          <div className="otd-scene" hidden={step !== 4}>
            <div className="otd-caption">
              <h3>Open a card. Find your next move.</h3>
              <p>The deadline, the details, and what to do next — all together.</p>
            </div>
            <div className="otd-visual otd-review-visual">
              <div className="otd-detail-layout">
              <div className="otd-details-card">
                <div className="otd-details-intro">
                <div className="otd-details-topbar">
                  <span className="otd-reviewed"><Sparkles size={15} aria-hidden="true" /> Ready to review</span>
                  <button type="button" className="otd-back-to-grid" onClick={() => {
                    pendingFocus.current = 'card';
                    setStep(3);
                  }}><ArrowLeft size={14} aria-hidden="true" /> Back to grid</button>
                </div>
                <h3 ref={detailsTitle} tabIndex={-1}>{selected.title}</h3>
                <p>{selected.organisation}</p>
                </div>
                <dl>
                  <div><dt>Opportunity</dt><dd>{selected.label}</dd></div>
                  <div className="otd-field-highlight"><dt>Application deadline</dt><dd>{selected.deadline}</dd></div>
                  <div><dt>Location</dt><dd>{selected.location}</dd></div>
                  <div><dt>Funding</dt><dd>{selected.funding}</dd></div>
                </dl>
                <div className="otd-next-step"><span>Your next step</span><strong>{selected.nextAction}</strong></div>
                <div className="otd-demo-reminders">
                  <span><Bell size={13} aria-hidden="true" /> Remind me before</span>
                  <div><span><Check size={11} aria-hidden="true" />30 min</span><span><Check size={11} aria-hidden="true" />2 hours</span><span><Check size={11} aria-hidden="true" />1 day</span></div>
                </div>
              </div>
              <div className="otd-detail-callouts">
                <div className="otd-callout"><strong>The essentials.</strong><p>Date + place.</p></div>
                <div className="otd-callout"><strong>Your next move.</strong><p>One clear action.</p></div>
                <div className="otd-callout"><strong>A timely nudge.</strong><p>30 min · 2h · 1 day.</p></div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
