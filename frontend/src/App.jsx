import { useState, useRef, useEffect, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import axios from 'axios';
import './index.css';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Simple Router
  if (currentPath === '/admin') {
    return <AdminDashboard />;
  }
  
  if (currentPath.startsWith('/download/')) {
    const fileId = currentPath.split('/download/')[1];
    return <DownloadScreen fileId={fileId} />;
  }

  return <UploadScreen />;
}

function UploadScreen() {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [resultLink, setResultLink] = useState('');
  const [expiryHours, setExpiryHours] = useState(24);
  const [pin, setPin] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isLightMode, setIsLightMode] = useState(false);
  const fileInputRef = useRef(null);

  const toggleTheme = () => {
    setIsLightMode(!isLightMode);
    if (!isLightMode) {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const onUploadClick = async () => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('expiryHours', expiryHours);
    if (pin) formData.append('pin', pin);
    if (recipientEmail) formData.append('recipientEmail', recipientEmail);

    try {
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });
      
      const link = `${window.location.origin}/download/${response.data.fileId}`;
      setResultLink(link);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Network error during upload');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const copyToClipboard = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(resultLink);
      alert('Link copied to clipboard!');
    } else {
      // Fallback for HTTP connections (like our AWS IP address)
      const textArea = document.createElement("textarea");
      textArea.value = resultLink;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert('Link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy', err);
        alert('Failed to copy. Please select the link text manually.');
      } finally {
        textArea.remove();
      }
    }
  };

  return (
    <div className="app-container">
      <div className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
        {isLightMode ? '🌙' : '☀️'}
      </div>
      <div className="glass-panel">
        <h1>Mini WeTransfer</h1>
        <p className="subtitle">Secure, temporary file sharing</p>

        {!resultLink ? (
          <>
            <div 
              className={`upload-area ${dragActive ? "drag-active" : ""}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                className="file-input" 
                onChange={handleChange}
              />
              <span className="upload-icon">☁️</span>
              {file ? (
                <p><strong>{file.name}</strong> ({(file.size / (1024*1024)).toFixed(2)} MB)</p>
              ) : (
                <p>Drag & drop your file here, or click to browse</p>
              )}
            </div>

            {file && (
              <div style={{ marginTop: '1.5rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Expires in (Hours): </label>
                  <select 
                    value={expiryHours} 
                    onChange={(e) => setExpiryHours(e.target.value)}
                    style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '0.5rem', borderRadius: '8px', marginLeft: '0.5rem' }}
                  >
                    <option value={1} style={{color: 'black'}}>1 Hour</option>
                    <option value={24} style={{color: 'black'}}>24 Hours</option>
                    <option value={72} style={{color: 'black'}}>3 Days</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Protect with PIN (Optional): </label>
                  <input 
                    type="text" 
                    placeholder="4-digit PIN"
                    maxLength="4"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '0.5rem', borderRadius: '8px', marginLeft: '0.5rem', width: '120px' }}
                  />
                </div>
                <div>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Email to (Optional): </label>
                  <input 
                    type="email" 
                    placeholder="friend@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '0.5rem', borderRadius: '8px', marginLeft: '0.5rem', width: '200px' }}
                  />
                </div>
              </div>
            )}

            {uploading && uploadProgress > 0 && (
              <div className="progress-container">
                <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            )}
            {uploading && <div className="progress-text">Uploading: {uploadProgress}%</div>}

            <button 
              className="btn-primary" 
              onClick={onUploadClick} 
              disabled={!file || uploading}
            >
              {uploading ? <span className="loader"></span> : 'Get Transfer Link'}
            </button>
          </>
        ) : (
          <div className="result-area">
            <h2>🎉 File Ready!</h2>
            <p style={{marginTop: '1rem', color: '#cbd5e1'}}>Share this link with anyone.</p>
            
            <div className="link-box">
              <span className="link-text">{resultLink}</span>
              <button className="btn-copy" onClick={copyToClipboard}>Copy</button>
            </div>

            <div className="qr-container" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.75rem', fontWeight: 500 }}>Scan to download</p>
              <div style={{ padding: '0.5rem', background: 'white', borderRadius: '8px' }}>
                <QRCodeCanvas 
                  value={resultLink} 
                  size={160}
                  bgColor={"#ffffff"}
                  fgColor={"#0f172a"}
                  level={"H"}
                  includeMargin={false}
                />
              </div>
            </div>

            <button 
              className="btn-primary" 
              style={{marginTop: '2rem', background: 'transparent', border: '1px solid var(--primary-color)'}}
              onClick={() => {
                setFile(null);
                setResultLink('');
              }}
            >
              Send another file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DownloadScreen({ fileId }) {
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [needsPin, setNeedsPin] = useState(false);
  const [pin, setPin] = useState('');

  const fetchFile = useCallback(async (currentPin = '') => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/download/${fileId}?pin=${currentPin}`);
      const data = await response.json();
      
      if (response.ok) {
        setNeedsPin(false);
        setMetadata(data.metadata);
        setDownloadUrl(data.downloadUrl);
      } else {
        if (data.requirePin) {
          setNeedsPin(true);
          if (currentPin) setError('Incorrect PIN. Try again.');
        } else {
          setError(data.error || 'Failed to find file');
        }
      }
    } catch (err) {
      console.error(err);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    // eslint-disable-next-line
    fetchFile();
  }, [fetchFile]);

  if (loading && !needsPin) return (
    <div className="app-container"><div className="glass-panel"><h2>Loading...</h2></div></div>
  );

  if (needsPin && !metadata) return (
    <div className="app-container">
      <div className="glass-panel">
        <h2>🔒 PIN Required</h2>
        <p style={{marginTop: '1rem', color: 'var(--text-secondary)'}}>This file is protected by a PIN code.</p>
        <div style={{ marginTop: '1.5rem' }}>
          <input 
            type="password" 
            placeholder="Enter PIN"
            maxLength="4"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '0.75rem', borderRadius: '8px', width: '100%', textAlign: 'center', letterSpacing: '0.5rem', fontSize: '1.5rem' }}
          />
        </div>
        {error && <p style={{color: '#f87171', marginTop: '1rem'}}>{error}</p>}
        <button className="btn-primary" onClick={() => fetchFile(pin)}>Unlock File</button>
      </div>
    </div>
  );

  if (error && !needsPin) return (
    <div className="app-container">
      <div className="glass-panel">
        <h2 style={{color: '#f87171'}}>⚠️ Oops!</h2>
        <p style={{marginTop: '1rem'}}>{error}</p>
        <button className="btn-primary" onClick={() => window.location.href = '/'}>Go Home</button>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <div className="glass-panel">
        <h1>Ready to Download</h1>
        <p className="subtitle">Someone sent you a file</p>

        <div className="file-info">
          <p><strong>Filename:</strong> {metadata.originalName}</p>
          <p><strong>Size:</strong> {(metadata.size / (1024*1024)).toFixed(2)} MB</p>
          <p><strong>Uploaded:</strong> {new Date(metadata.uploadedAt).toLocaleString()}</p>
          <p style={{color: '#a78bfa'}}><strong>Expires:</strong> {new Date(metadata.expiresAt * 1000).toLocaleString()}</p>
        </div>

        <button 
          className="btn-primary" 
          onClick={() => window.location.href = downloadUrl}
        >
          Download File
        </button>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch('/api/admin/files');
        if (response.ok) {
          const data = await response.json();
          setFiles(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, []);

  return (
    <div className="app-container" style={{ maxWidth: '800px' }}>
      <div className="glass-panel">
        <h1>Admin Dashboard</h1>
        <p className="subtitle">View all uploaded files</p>

        {loading ? (
          <span className="loader"></span>
        ) : (
          <div style={{ textAlign: 'left', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: '#a78bfa' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>File Name</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Size (MB)</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Downloads</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Expires</th>
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.fileId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.75rem 0.5rem', wordBreak: 'break-all' }}>{f.originalName}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{(f.size / (1024*1024)).toFixed(2)}</td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>{f.downloadCount || 0}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{new Date(f.expiresAt * 1000).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {files.length === 0 && <p style={{ marginTop: '2rem', textAlign: 'center' }}>No files found.</p>}
          </div>
        )}
        
        <button 
          className="btn-primary" 
          style={{marginTop: '2rem', background: 'transparent', border: '1px solid var(--primary-color)'}}
          onClick={() => window.location.href = '/'}
        >
          Back to Upload
        </button>
      </div>
    </div>
  );
}

export default App;
