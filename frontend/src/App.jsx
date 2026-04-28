import { useState, useRef, useEffect } from 'react';
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
  const [resultLink, setResultLink] = useState('');
  const [expiryHours, setExpiryHours] = useState(24);
  const fileInputRef = useRef(null);

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

    const formData = new FormData();
    formData.append('file', file);
    formData.append('expiryHours', expiryHours);

    try {
      const response = await fetch('http://localhost:5000/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      if (response.ok) {
        const link = `${window.location.origin}/download/${data.fileId}`;
        setResultLink(link);
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
      alert('Network error during upload');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(resultLink);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="app-container">
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
              <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
                <label style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>Expires in (Hours): </label>
                <select 
                  value={expiryHours} 
                  onChange={(e) => setExpiryHours(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem', borderRadius: '8px', marginLeft: '0.5rem' }}
                >
                  <option value={1} style={{color: 'black'}}>1 Hour</option>
                  <option value={24} style={{color: 'black'}}>24 Hours</option>
                  <option value={72} style={{color: 'black'}}>3 Days</option>
                </select>
              </div>
            )}

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

  useEffect(() => {
    const fetchFile = async () => {
      try {
        const response = await fetch(`http://localhost:5000/download/${fileId}`);
        const data = await response.json();
        
        if (response.ok) {
          setMetadata(data.metadata);
          setDownloadUrl(data.downloadUrl);
        } else {
          setError(data.error || 'Failed to find file');
        }
      } catch (err) {
        console.error(err);
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };
    fetchFile();
  }, [fileId]);

  if (loading) return (
    <div className="app-container"><div className="glass-panel"><h2>Loading...</h2></div></div>
  );

  if (error) return (
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
        const response = await fetch('http://localhost:5000/admin/files');
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
