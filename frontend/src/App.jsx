import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  MapPin, Image as ImageIcon, Send, Clock, 
  CheckCircle, AlertTriangle, Building, 
  Search, FileText, Activity, Shield
} from 'lucide-react';

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:8000/api' : '/api';

function App() {
  const [activeTab, setActiveTab] = useState('report');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [location, setLocation] = useState('');
  const [context, setContext] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchComplaints();
    const interval = setInterval(fetchComplaints, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchComplaints = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/complaints`);
      setComplaints(response.data);
    } catch (err) {
      console.error('Failed to fetch complaints', err);
    }
  };

  const updateComplaintStatus = async (id, newStatus) => {
    try {
      await axios.patch(`${API_BASE_URL}/complaints/${id}/status`, { status: newStatus });
      fetchComplaints(); // Instantly refresh
    } catch (err) {
      alert("Failed to update status. Are you authorized?");
    }
  };

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview); // Memory efficiency
    };
  }, [preview]);

  const handleFileDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      handleFileSelection(droppedFile);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (selectedFile) => {
    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreview(objectUrl);
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation(`Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)}`),
      (error) => alert('Failed to get location. Please allow location access.')
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('Please select an image first!');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('location', location || 'Unknown Location');
    formData.append('extra_context', context);

    try {
      await axios.post(`${API_BASE_URL}/report`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFile(null);
      setPreview(null);
      setContext('');
      setLocation('');
      await fetchComplaints();
      setActiveTab('feed'); // Auto-switch to feed on success
    } catch (err) {
      alert('Failed to submit complaint. File too large or API error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- SUB COMPONENTS ---

  const renderIssueForm = () => (
    <form onSubmit={handleSubmit} className="upload-section" aria-label="Issue Reporting Form">
      <div 
        className={`drop-zone ${preview ? 'has-image' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current.click();
          }
        }}
        aria-label="Upload civic issue image"
      >
        {preview ? (
          <img src={preview} alt={`Preview of uploaded civic issue`} className="preview" />
        ) : (
          <>
            <ImageIcon className="icon-placeholder" aria-hidden="true" />
            <p>Click to browse or drag an image here safely</p>
          </>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileSelect}
          accept="image/*"
          style={{ display: 'none' }} 
          aria-hidden="true"
        />
      </div>

      <div className="input-group">
        <label htmlFor="context">Additional Details (Optional)</label>
        <textarea 
          id="context"
          placeholder="e.g. Broken for 3 weeks, causing severe traffic..."
          rows={3}
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </div>

      <div className="input-group">
        <label htmlFor="location">Exact Area / Location</label>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            id="location"
            type="text" 
            placeholder="e.g. Chinnapanahalli Main Road"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="button" className="location-btn" onClick={getLocation}>
            <MapPin size={18} /> GPS Detect
          </button>
        </div>
      </div>

      <button type="submit" className="submit-btn" disabled={isSubmitting || !file}>
        {isSubmitting ? (
           <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem' }}>
             <div className="loading-spinner"></div> Processing Image w/ AI...
           </span>
        ) : (
           <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem' }}>
             <Send size={20} /> File Official Report
           </span>
        )}
      </button>
    </form>
  );

  const renderPublicFeed = () => {
    // AREA AND TEXT FILTERING
    const filteredComplaints = complaints.filter(c => 
      c.location?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.issue_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="feed-section">
        <div className="feed-header">
           <h2 style={{fontSize: '1.8rem'}}>Live Civic Feed</h2>
           <div style={{position: 'relative', flex: 1, maxWidth: '400px'}}>
             <Search size={18} style={{position: 'absolute', top: '1.1rem', left: '1.2rem', color: '#94a3b8'}}/>
             <input 
                type="text"
                className="search-bar"
                placeholder="Search by Area, Location, or Dept..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{paddingLeft: '3rem'}}
             />
           </div>
        </div>
        
        {filteredComplaints.length === 0 ? (
           <div style={{textAlign: 'center', padding: '3rem', color: '#94a3b8'}}>No issues found for this area.</div>
        ) : (
          <div className="complaints-list">
            {filteredComplaints.map((item) => (
              <div key={item.id} className="complaint-card">
                <div className="complaint-header">
                  <span className="issue-type">{item.issue_type}</span>
                  <span className={`status-badge status-${item.status}`}>
                    {item.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="complaint-body">{item.description}</p>
                <div className="complaint-meta">
                  <span className="meta-item"><Building size={16} className="meta-icon"/> {item.department}</span>
                  <span className="meta-item"><MapPin size={16} className="meta-icon"/> {item.location}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAuthorityPortal = () => (
    <div className="portal-container">
       <div style={{padding: '1.5rem 1.5rem 0', display: 'flex', justifyContent: 'space-between'}}>
         <h2 style={{margin: 0}}>Official Authority Dashboard</h2>
         <span style={{background: 'rgba(236,72,153,0.2)', color: '#ec4899', padding: '0.4rem 1rem', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 800}}>RESTRICTED ACCESS</span>
       </div>
       <div style={{overflowX: 'auto', padding: '1.5rem'}}>
         <table className="portal-table">
            <thead>
              <tr>
                <th>Issue Details</th>
                <th>Area / Location</th>
                <th>Department Routed To</th>
                <th>Status</th>
                <th>Admin Actions</th>
              </tr>
            </thead>
            <tbody>
              {complaints.length === 0 && <tr><td colSpan="5">No active reports.</td></tr>}
              {complaints.map(item => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.issue_type}</strong><br/>
                    <span style={{fontSize: '0.85rem', color: '#94a3b8'}}>{item.description?.substring(0, 40)}...</span>
                  </td>
                  <td>{item.location}</td>
                  <td>{item.department}</td>
                  <td>
                    <span className={`status-badge status-${item.status}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                     <div className="action-buttons">
                        {item.status === 'pending' && (
                           <button className="action-btn" onClick={() => updateComplaintStatus(item.id, 'in_progress')}>
                             Accept
                           </button>
                        )}
                        {item.status !== 'resolved' && (
                           <button className="action-btn resolve" onClick={() => updateComplaintStatus(item.id, 'resolved')}>
                             Resolve
                           </button>
                        )}
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
         </table>
       </div>
    </div>
  );

  return (
    <div className="app-container">
      <header>
        <h1>FixMyCity AI App</h1>
        <p>Enterprise-Grade Civic Issue Reporting via Google GenAI</p>
      </header>

      <div className="tabs-container">
        <button className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`} onClick={() => setActiveTab('report')}>
          <FileText size={18} /> Report Issue
        </button>
        <button className={`tab-btn ${activeTab === 'feed' ? 'active' : ''}`} onClick={() => setActiveTab('feed')}>
          <Activity size={18} /> Public Feed
        </button>
        <button className={`tab-btn ${activeTab === 'portal' ? 'active' : ''}`} onClick={() => setActiveTab('portal')}>
          <Shield size={18} /> Authority Portal
        </button>
      </div>

      {activeTab === 'report' && renderIssueForm()}
      {activeTab === 'feed' && renderPublicFeed()}
      {activeTab === 'portal' && renderAuthorityPortal()}

    </div>
  );
}

export default App;
