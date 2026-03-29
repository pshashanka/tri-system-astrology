import { useState } from 'react';
import styles from '../styles/home.module.css';

export default function BirthForm({ onSubmit, loading }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [location, setLocation] = useState('');

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

      <div className={styles.formGroup}>
        <label htmlFor="birth-location" className={styles.label}>Birth Location</label>
        <input
          id="birth-location"
          type="text"
          className={styles.input}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, Country (e.g. London, UK)"
          required
        />
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
