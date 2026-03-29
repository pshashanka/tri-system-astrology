import { useState } from 'react';
import styles from '../styles/home.module.css';

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
          {content.split('\n').map((line, i) => {
            if (line.startsWith('### ')) return <h4 key={i}>{line.slice(4)}</h4>;
            if (line.startsWith('**') && line.endsWith('**')) return <p key={i}><strong>{line.slice(2, -2)}</strong></p>;
            if (line.trim() === '') return <br key={i} />;
            return <p key={i}>{line}</p>;
          })}
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
          {birthData.coordinates.lat.toFixed(4)}°N, {birthData.coordinates.lng.toFixed(4)}°E
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
