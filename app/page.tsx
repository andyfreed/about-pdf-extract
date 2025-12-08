'use client';

import { useState } from 'react';

export default function Home() {
  const [wordpressUrl, setWordpressUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [tocHtml, setTocHtml] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchCourses = async () => {
    if (!wordpressUrl) {
      setError('Please enter a WordPress URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        wordpress_url: wordpressUrl,
      });
      if (apiKey) {
        params.append('api_key', apiKey);
      }

      const response = await fetch(`/api/courses?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch courses');
      }

      setCourses(data.courses || []);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const processCourse = async (course: any) => {
    setProcessing(true);
    setError(null);
    setSelectedCourse(course);
    setTocHtml(null);

    try {
      const response = await fetch('/api/process-course', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          course_id: course.id,
          wordpress_url: wordpressUrl,
          api_key: apiKey || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process course');
      }

      setTocHtml(data.toc_html);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1>PDF Table of Contents Extractor</h1>
      
      <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <h2>Configuration</h2>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            WordPress URL:
          </label>
          <input
            type="text"
            value={wordpressUrl}
            onChange={(e) => setWordpressUrl(e.target.value)}
            placeholder="https://yoursite.com"
            style={{ width: '100%', padding: '8px', fontSize: '14px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            API Key (optional):
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Leave empty if not required"
            style={{ width: '100%', padding: '8px', fontSize: '14px' }}
          />
        </div>
        <button
          onClick={fetchCourses}
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Loading...' : 'Fetch Active Courses'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '15px', backgroundColor: '#fee', color: '#c33', borderRadius: '4px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {courses.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h2>Active Courses ({courses.length})</h2>
          <div style={{ display: 'grid', gap: '10px' }}>
            {courses.map((course) => (
              <div
                key={course.id}
                style={{
                  padding: '15px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 5px 0' }}>{course.title}</h3>
                  <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                    ID: {course.id} | Product ID: {course.product_id || 'N/A'}
                  </p>
                </div>
                <button
                  onClick={() => processCourse(course)}
                  disabled={processing}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: processing ? 'not-allowed' : 'pointer',
                  }}
                >
                  Extract TOC
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {processing && (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>Processing course: {selectedCourse?.title}...</p>
        </div>
      )}

      {tocHtml && (
        <div style={{ marginTop: '30px' }}>
          <h2>Table of Contents - {selectedCourse?.title}</h2>
          <div
            dangerouslySetInnerHTML={{ __html: tocHtml }}
            style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '20px' }}
          />
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={() => {
                const blob = new Blob([tocHtml], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `toc-${selectedCourse?.id}.html`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Download HTML
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
