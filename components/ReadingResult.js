import { useState } from 'react';
import styles from '../styles/home.module.css';

// Render inline markdown: **bold**, *italic*
function renderInline(text) {
  const parts = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3] !== undefined) parts.push(<em key={m.index}>{m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Render markdown text into React nodes
function MarkdownContent({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const nodes = [];
  let listItems = [];
  let i = 0;

  function flushList() {
    if (listItems.length) {
      nodes.push(<ul key={`ul-${i}`} className={styles.mdList}>{listItems}</ul>);
      listItems = [];
    }
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('## ')) {
      flushList();
      nodes.push(<h3 key={i} className={styles.mdH2}>{renderInline(trimmed.slice(3))}</h3>);
    } else if (trimmed.startsWith('### ')) {
      flushList();
      nodes.push(<h4 key={i} className={styles.mdH3}>{renderInline(trimmed.slice(4))}</h4>);
    } else if (/^[-*] /.test(trimmed)) {
      listItems.push(<li key={i}>{renderInline(trimmed.slice(2))}</li>);
    } else if (/^\d+\. /.test(trimmed)) {
      listItems.push(<li key={i}>{renderInline(trimmed.replace(/^\d+\.\s/, ''))}</li>);
    } else if (trimmed === '') {
      flushList();
    } else {
      flushList();
      nodes.push(<p key={i}>{renderInline(line)}</p>);
    }
    i++;
  }
  flushList();
  return <>{nodes}</>;
}

function Section({ title, icon, content, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.sectionHeader}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{icon} {title}</span>
        <span className={styles.chevron}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className={styles.sectionBody}>
          <MarkdownContent text={content} />
        </div>
      )}
    </div>
  );
}

function ChartSummary({ charts }) {
  if (!charts) return null;
  const { western, vedic, chinese } = charts;

  return (
    <div className={styles.chartSummary}>
      <div className={styles.summaryCard}>
        <h4>☉ Western</h4>
        <p>Sun: {western.sun.sign}</p>
        <p>Moon: {western.moon.sign}</p>
        <p>Rising: {western.ascendant.sign}</p>
      </div>
      <div className={styles.summaryCard}>
        <h4>🕉 Vedic</h4>
        <p>Lagna: {vedic.lagna.sign}</p>
        <p>Moon: {vedic.moon.sign} ({vedic.moon.nakshatra.name})</p>
        <p>Dasha: {vedic.dasha.mahadasha.planet}</p>
      </div>
      <div className={styles.summaryCard}>
        <h4>☯ Chinese</h4>
        <p>Animal: {chinese.animal}</p>
        <p>Day Master: {chinese.dayMaster.description}</p>
        <p>Year: {chinese.pillars.year.full}</p>
      </div>
    </div>
  );
}

export default function ReadingResult({ data }) {
  if (!data) return null;

  const { birthData, charts, reading } = data;

  return (
    <div className={styles.result}>
      <div className={styles.birthInfo}>
        <h3>Birth Chart Reading</h3>
        <p>
          {birthData.date} at {birthData.time} — {birthData.location}
        </p>
        <p className={styles.coords}>
          {Math.abs(birthData.coordinates.lat).toFixed(4)}°{birthData.coordinates.lat >= 0 ? 'N' : 'S'},
          {' '}{Math.abs(birthData.coordinates.lng).toFixed(4)}°{birthData.coordinates.lng >= 0 ? 'E' : 'W'}
        </p>
      </div>

      <ChartSummary charts={charts} />

      <div className={styles.readings}>
        <Section
          title="Vedic (Jyotish) Analysis"
          icon="🕉"
          content={reading.sections.vedic || 'No Vedic analysis generated.'}
          defaultOpen={true}
        />
        <Section
          title="Western (Tropical) Analysis"
          icon="☉"
          content={reading.sections.western || 'No Western analysis generated.'}
        />
        <Section
          title="Chinese (BaZi) Analysis"
          icon="☯"
          content={reading.sections.chinese || 'No Chinese analysis generated.'}
        />
        <Section
          title="Unified Synthesis"
          icon="✦"
          content={reading.sections.synthesis || 'No synthesis generated.'}
          defaultOpen={true}
        />
      </div>

      {reading.usage && (
        <p className={styles.meta}>
          Model: {reading.model} · Tokens: {reading.usage.total_tokens}
        </p>
      )}
    </div>
  );
}
