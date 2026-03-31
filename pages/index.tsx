import { useState } from 'react'
import BirthForm from '../components/BirthForm'
import ReadingResult from '../components/ReadingResult'
import styles from '../styles/home.module.css'

interface FormData {
  date: string;
  time: string;
  location: string;
}

interface ReadingData {
  birthData: {
    date: string;
    time: string;
    location: string;
    coordinates: { lat: number; lng: number };
  };
  charts: {
    western: any;
    vedic: any;
    chinese: any;
  };
  reading: {
    raw: string;
    sections: { vedic: string; western: string; chinese: string; synthesis: string };
    model: string;
    usage?: { total_tokens: number };
  };
}

function Home() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ReadingData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (formData: FormData) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate reading')
      }

      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <h1 className={styles.title}>✦ Tri-System Astrology</h1>
        <p className={styles.subtitle}>
          A comprehensive birth chart reading combining Vedic, Western, and Chinese astrology — synthesized by AI.
        </p>
      </div>

      <BirthForm onSubmit={handleSubmit} loading={loading} />

      {error && (
        <div className={styles.error}>
          <p>⚠ {error}</p>
        </div>
      )}

      {loading && (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingOrb} />
          <p>Calculating planetary positions and generating your reading…</p>
          <p className={styles.hint}>This may take 15–30 seconds</p>
        </div>
      )}

      <ReadingResult data={result} />
    </main>
  )
}

export default Home
