import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  MapPin, Image as ImageIcon, Send, Clock, 
  CheckCircle, AlertTriangle, Building, 
  Search, FileText, Activity, Shield, ThumbsUp
} from 'lucide-react';

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:8000/api' : '/api';

function App() {
  const [activeTab, setActiveTab] = useState('report');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [location, setLocation] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [context, setContext] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDoc, setExpandedDoc] = useState(null); // Track which formal document is open
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchComplaints();
    const interval = setInterval(fetchComplaints, 10000); // Polling
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
      alert("Failed to update status.");
    }
  };

  const upvoteComplaint = async (id) => {
    try {
      await axios.patch(`${API_BASE_URL}/complaints/${id}/upvote`);
      fetchComplaints(); // Instantly refresh
    } catch (err) {
      console.error("Failed to upvote.");
    }
  };

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
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
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        try {
          const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
          if (res.data && res.data.address) {
            const addr = res.data.address;
            const area = addr.suburb || addr.neighbourhood || addr.village || addr.city_district || addr.road || '';
            const city = addr.city || addr.town || addr.county || addr.state || '';
            const locationString = [area, city].filter(Boolean).join(', ');
            setLocation(locationString || res.data.display_name || `Lat: ${lat.toFixed(4)}, Lng: ${lon.toFixed(4)}`);
          } else {
            setLocation(`Lat: ${lat.toFixed(4)}, Lng: ${lon.toFixed(4)}`);
          }
        } catch (err) {
          setLocation(`Lat: ${lat.toFixed(4)}, Lng: ${lon.toFixed(4)}`); 
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        alert('Failed to get location. Please allow location access.');
      }
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
      setActiveTab('feed'); 
    } catch (err) {
      alert('Failed to submit complaint. File too large or API error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityColor = (score) => {
     if (score >= 8) return 'severity-high';
     if (score >= 4) return 'severity-medium';
     return 'severity-low';
  };

  // --- SUB COMPONENTS ---

  const renderIssueForm = () => (
    <form onSubmit={handleSubmit} className="upload-section">
      <div 
        className={`drop-zone ${preview ? 'has-image' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current.click()}
        role="button"
        tabIndex={0}
      >
        {preview ? (
          <img src={preview} alt="Preview" className="preview" />
        ) : (
          <>
            <ImageIcon className="icon-placeholder" />
            <p>Click to browse or drag an image here safely</p>
          </>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileSelect}
          accept="image/*"
          style={{ display: 'none' }} 
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
          <button type="button" className="location-btn" onClick={getLocation} disabled={isLocating}>
            <MapPin size={18} /> 
            {isLocating ? 'Detecting Area...' : 'GPS Detect'}
          </button>
        </div>
      </div>

      <button type="submit" className="submit-btn" disabled={isSubmitting || !file}>
        {isSubmitting ? (
           <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem' }}>
             <div className="loading-spinner"></div> Analyzing with Gemini 2.5 AI...
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
           <div style={{textAlign: 'center', padding: '3rem', color: '#94a3b8'}}>No issues found in this area.</div>
        ) : (
          <div className="complaints-list">
            {filteredComplaints.map((item) => (
              <div key={item.id} className="complaint-card">
                <div className="complaint-header">
                  <span className="issue-type">{item.issue_type}</span>
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                     <span className={`severity-badge ${getSeverityColor(item.severity_score)}`} title="AI Danger/Severity Score">
                       🔥 {item.severity_score}/10
                     </span>
                     <span className={`status-badge status-${item.status}`}>
                       {item.status.replace('_', ' ')}
                     </span>
                  </div>
                </div>
                
                <p className="complaint-body">{item.description}</p>
                
                <div className="complaint-meta">
                  <span className="meta-item"><Building size={16} className="meta-icon"/> {item.department}</span>
                  <span className="meta-item"><MapPin size={16} className="meta-icon"/> {item.location}</span>
                </div>

                <div className="card-actions">
                   <button className="upvote-btn" onClick={() => upvoteComplaint(item.id)}>
                      <ThumbsUp size={16} /> <span>{item.upvotes || 0} Upvotes</span>
                   </button>
                   <button 
                      className="expand-doc-btn" 
                      onClick={() => setExpandedDoc(expandedDoc === item.id ? null : item.id)}
                   >
                     <FileText size={16} /> View Official Letter
                   </button>
                </div>

                {expandedDoc === item.id && (
                   <div className="formal-doc-box">
                     <h4>AI-Generated Grievance Request</h4>
                     <p>{item.formal_complaint}</p>
                   </div>
                )}
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
                <th>Risk Rating</th>
                <th>Issue Details</th>
                <th>Location</th>
                <th>Priority (Upvotes)</th>
                <th>Status</th>
                <th>Admin Actions</th>
              </tr>
            </thead>
            <tbody>
              {complaints.length === 0 && <tr><td colSpan="6">No active reports.</td></tr>}
              {complaints.sort((a,b) => (b.upvotes||0) - (a.upvotes||0)).map(item => (
                <tr key={item.id}>
                  <td>
                    <span className={`severity-badge ${getSeverityColor(item.severity_score)}`}>
                       🔥 {item.severity_score}/10
                    </span>
                  </td>
                  <td>
                    <strong>{item.issue_type}</strong><br/>
                    <span style={{fontSize: '0.85rem', color: '#94a3b8'}}>{item.department}</span>
                  </td>
                  <td>{item.location}</td>
                  <td><strong style={{color: '#60a5fa'}}>{item.upvotes||0} Votes</strong></td>
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
          <Shield size={18} /> Authority Dashboard
        </button>
      </div>

      {activeTab === 'report' && renderIssueForm()}
      {activeTab === 'feed' && renderPublicFeed()}
      {activeTab === 'portal' && renderAuthorityPortal()}

    </div>
  );
}

export default App;
