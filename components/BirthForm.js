import { useState, useEffect, useRef } from 'react';
import styles from '../styles/home.module.css';

export default function BirthForm({ onSubmit, loading }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [location, setLocation] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Fetch suggestions with debounce + AbortController to cancel stale requests
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (location.length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode-suggest?q=${encodeURIComponent(location)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(true);
        setActiveIndex(-1);
      } catch (err) {
        if (err.name !== 'AbortError') setSuggestions([]);
      }
    }, 300);
    return () => {
      clearTimeout(debounceRef.current);
      controller.abort();
    };
  }, [location]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectSuggestion(s) {
    setLocation(s.label);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function handleKeyDown(e) {
    if (!showSuggestions || !suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!date || !location) return;
    onSubmit({ date, time, location });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label htmlFor="birth-date" className={styles.label}>Birth Date</label>
        <input
          id="birth-date"
          type="date"
          className={styles.input}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          max={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="birth-time" className={styles.label}>Birth Time</label>
        <input
          id="birth-time"
          type="time"
          className={styles.input}
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <span className={styles.hint}>If unknown, noon (12:00) will be used</span>
      </div>

      <div className={styles.formGroup} ref={wrapperRef} style={{ position: 'relative' }}>
        <label htmlFor="birth-location" className={styles.label}>Birth Location</label>
        <input
          id="birth-location"
          type="text"
          className={styles.input}
          value={location}
          onChange={(e) => { setLocation(e.target.value); setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="City, Country (e.g. London, UK)"
          autoComplete="off"
          required
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className={styles.suggestions}>
            {suggestions.map((s, i) => (
              <li
                key={i}
                className={`${styles.suggestionItem} ${i === activeIndex ? styles.suggestionActive : ''}`}
                onMouseDown={() => selectSuggestion(s)}
              >
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={loading || !date || !location}
      >
        {loading ? (
          <span className={styles.spinner}>⟳ Consulting the stars…</span>
        ) : (
          '✦ Generate Reading'
        )}
      </button>
    </form>
  );
}
