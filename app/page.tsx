'use client';

import { useState, useMemo, useEffect, useRef } from 'react';

const WORDPRESS_URLS = [
  { label: 'Staging (bhfestagingurl.wpenginepowered.com)', value: 'https://bhfestagingurl.wpenginepowered.com/' },
  { label: 'Production (www.bhfe.com)', value: 'https://www.bhfe.com/' },
];

export default function Home() {
  const [wordpressUrl, setWordpressUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [courseSearchTerm, setCourseSearchTerm] = useState('');
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [tocHtml, setTocHtml] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCourseDropdown(false);
      }
    };

    if (showCourseDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showCourseDropdown]);

  const fetchCourses = async () => {
    if (!wordpressUrl) {
      setError('Please select a WordPress URL');
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedCourseId('');
    setSelectedCourse(null);
    setCourseSearchTerm('');
    setTocHtml(null);

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

  const filteredCourses = useMemo(() => {
    if (!courseSearchTerm) return courses;
    const searchLower = courseSearchTerm.toLowerCase();
    return courses.filter(course => 
      course.title.toLowerCase().includes(searchLower) ||
      course.id.toString().includes(searchLower) ||
      (course.product_id && course.product_id.toString().includes(searchLower))
    );
  }, [courses, courseSearchTerm]);

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourseId(courseId);
    const course = courses.find(c => c.id.toString() === courseId);
    setSelectedCourse(course || null);
    setCourseSearchTerm(course ? course.title : '');
    setShowCourseDropdown(false);
  };

  const processCourse = async () => {
    if (!selectedCourse) {
      setError('Please select a course');
      return;
    }

    setProcessing(true);
    setError(null);
    setTocHtml(null);

    try {
      const response = await fetch('/api/process-course', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          course_id: selectedCourse.id,
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
          <select
            value={wordpressUrl}
            onChange={(e) => setWordpressUrl(e.target.value)}
            style={{ width: '100%', padding: '8px', fontSize: '14px' }}
          >
            <option value="">Select a WordPress site...</option>
            {WORDPRESS_URLS.map((url) => (
              <option key={url.value} value={url.value}>
                {url.label}
              </option>
            ))}
          </select>
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
          disabled={loading || !wordpressUrl}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || !wordpressUrl ? 'not-allowed' : 'pointer',
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
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
          <h2>Select Course ({courses.length} available)</h2>
          <div ref={dropdownRef} style={{ position: 'relative', marginBottom: '15px' }}>
            <input
              type="text"
              value={courseSearchTerm}
              onChange={(e) => {
                setCourseSearchTerm(e.target.value);
                setShowCourseDropdown(true);
                if (!e.target.value) {
                  setSelectedCourseId('');
                  setSelectedCourse(null);
                }
              }}
              onFocus={() => setShowCourseDropdown(true)}
              placeholder="Search courses by name, ID, or product ID..."
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
            {showCourseDropdown && filteredCourses.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginTop: '4px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                }}
              >
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    onClick={() => handleCourseSelect(course.id.toString())}
                    style={{
                      padding: '12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      backgroundColor: selectedCourseId === course.id.toString() ? '#e3f2fd' : 'white',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedCourseId !== course.id.toString()) {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedCourseId !== course.id.toString()) {
                        e.currentTarget.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>{course.title}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      ID: {course.id} {course.product_id ? `| Product ID: ${course.product_id}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showCourseDropdown && filteredCourses.length === 0 && courseSearchTerm && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginTop: '4px',
                  padding: '12px',
                  zIndex: 1000,
                }}
              >
                No courses found matching "{courseSearchTerm}"
              </div>
            )}
          </div>
          {selectedCourse && (
            <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#e8f5e9', borderRadius: '4px', border: '1px solid #4caf50' }}>
              <div style={{ fontWeight: '500', marginBottom: '4px' }}>Selected: {selectedCourse.title}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                ID: {selectedCourse.id} {selectedCourse.product_id ? `| Product ID: ${selectedCourse.product_id}` : ''}
              </div>
            </div>
          )}
          <button
            onClick={processCourse}
            disabled={processing || !selectedCourse}
            style={{
              marginTop: '15px',
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: selectedCourse ? '#28a745' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: processing || !selectedCourse ? 'not-allowed' : 'pointer',
            }}
          >
            {processing ? 'Processing...' : 'Extract Table of Contents'}
          </button>
        </div>
      )}

      {processing && selectedCourse && (
        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fff3cd', borderRadius: '4px', marginBottom: '20px' }}>
          <p style={{ margin: 0 }}>Processing course: <strong>{selectedCourse.title}</strong>...</p>
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
