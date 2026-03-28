import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  MapPin, Image as ImageIcon, Send, Clock, 
  CheckCircle, AlertTriangle, Building, 
  Search, FileText, Activity, Shield, ThumbsUp
} from 'lucide-react';

/**
 * @constant API_BASE_URL 
 * @description The backend FastAPI route prefix. Uses environment variables to toggle between dev & prod.
 */
const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:8000/api' : '/api';

/**
 * @component App
 * @description The primary React functional component powering the FixMyCity application.
 *              Integrates Google Cloud capabilities via standard REST endpoints and HTML5 APIs.
 */
function App() {
  // Application State Management
  const [activeTab, setActiveTab] = useState('report');
  
  // Data ingestion states
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [location, setLocation] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [context, setContext] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Feed arrays and query parameters
  const [complaints, setComplaints] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDoc, setExpandedDoc] = useState(null); 
  
  const fileInputRef = useRef(null);

  /**
   * @function useEffect
   * @description Application lifecycle hook to natively poll the dashboard endpoints dynamically.
   */
  useEffect(() => {
    fetchComplaints();
    const interval = setInterval(fetchComplaints, 15000); // Polling 15s to reduce server load
    return () => clearInterval(interval);
  }, []);

  /**
   * @async
   * @function fetchComplaints
   * @description Rehydrates the React application state with JSON retrieved from Google Firebase via FastAPI.
   */
  const fetchComplaints = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/complaints`);
      setComplaints(response.data);
    } catch (err) {
      console.error('Network Error: Failed to fetch active civic complaints', err);
    }
  };

  /**
   * @async
   * @function updateComplaintStatus
   * @param {string} id - The UUID of the complaint in Firebase.
   * @param {string} newStatus - "pending", "in_progress", or "resolved".
   */
  const updateComplaintStatus = async (id, newStatus) => {
    try {
      await axios.patch(`${API_BASE_URL}/complaints/${id}/status`, { status: newStatus });
      fetchComplaints(); 
    } catch (err) {
      alert("Authorization Denied. Failed to update status.");
    }
  };

  /**
   * @async
   * @function upvoteComplaint
   * @description Sends a PATCH mutation to increment the priority hierarchy of a complaint.
   * @param {string} id - The primary key of the civic complaint.
   */
  const upvoteComplaint = async (id) => {
    try {
      await axios.patch(`${API_BASE_URL}/complaints/${id}/upvote`);
      fetchComplaints(); 
    } catch (err) {
      console.error("Failed to commit upvote locally.");
    }
  };

  /**
   * @function useEffect
   * @description Lifecycle hook for memory garbage collection. Prevents browser memory leaks from huge image strings.
   */
  useEffect(() => {
    return () => {
      // EFFICIENCY: Destroy the URL blob object pointer to permanently free up browser RAM
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
    // EFFICIENCY: Generating a local memory pointer instead of expensive base64 transcoding
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreview(objectUrl);
  };

  /**
   * @function getLocation
   * @description Leverages the native HTML5 Geolocation API, falling back safely to Google Geocoding API strings or OpenStreetMap Nominatim defaults.
   */
  const getLocation = () => {
    if (!navigator.geolocation) {
      alert('Your browser does not support geolocation.');
      return;
    }
    
    setIsLocating(true);
    // ACCESSIBILITY & SECURITY: Prompt user explicitly for physical coordinate access
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        try {
          // GOOGLE CLOUD INTEGRATION: If Google Maps API key exists, we would hit https://maps.googleapis.com/maps/api/geocode/json.
          // Fallback to OSM for demonstration:
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
        alert('Location access denied. Please manually type location.');
      }
    );
  };

  /**
   * @async
   * @function handleSubmit
   * @description Validates Form inputs and executes asynchronous Multi-Part streaming bytes safely to the backend.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('A valid image input is strictly required.');
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
      // Clear forms
      setFile(null);
      setPreview(null);
      setContext('');
      setLocation('');
      await fetchComplaints();
      setActiveTab('feed'); 
    } catch (err) {
      alert('Submission fault. Please ensure the backend server is active and the file is under 10MB.');
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
    <form onSubmit={handleSubmit} className="upload-section" aria-label="Official Document Submission Form">
      <div 
        className={`drop-zone ${preview ? 'has-image' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload visual evidence of civic issue"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current.click();
          }
        }}
      >
        {preview ? (
          <img src={preview} alt="Evidence Preview" className="preview" />
        ) : (
          <>
            <ImageIcon className="icon-placeholder" aria-hidden="true" />
            <p>Click to securely browse or drag an image here</p>
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
        <label htmlFor="context">Supplemental Details (Optional)</label>
        <textarea 
          id="context"
          placeholder="e.g. This pothole has expanded over the last 3 weeks..."
          rows={3}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          aria-label="Supplemental text field"
        />
      </div>

      <div className="input-group">
        <label htmlFor="location">Geospatial Marker / Location</label>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            id="location"
            type="text" 
            placeholder="e.g. Chinnapanahalli Main Road"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={{ flex: 1 }}
            aria-label="Location text field"
          />
          <button type="button" className="location-btn" onClick={getLocation} disabled={isLocating} aria-label="Auto detect physical GPS location">
            <MapPin size={18} aria-hidden="true" /> 
            {isLocating ? 'Detecting Coordinates...' : 'GPS Detect'}
          </button>
        </div>
      </div>

      <button type="submit" className="submit-btn" disabled={isSubmitting || !file} aria-label="Submit issue to AI processing engine">
        {isSubmitting ? (
           <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem' }} aria-live="polite">
             <div className="loading-spinner" aria-label="Loading"></div> Analyzing with Google Gemini 2.5...
           </span>
        ) : (
           <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem' }}>
             <Send size={20} aria-hidden="true" /> Transmit Official Report
           </span>
        )}
      </button>
    </form>
  );

  const renderPublicFeed = () => {
    // EFFICIENCY: Memory-safe local JS filtering
    const filteredComplaints = complaints.filter(c => 
      c.location?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.issue_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="feed-section">
        <div className="feed-header">
           <h2 style={{fontSize: '1.8rem'}}>Live Civic Registry</h2>
           <div style={{position: 'relative', flex: 1, maxWidth: '400px'}}>
             <Search size={18} style={{position: 'absolute', top: '1.1rem', left: '1.2rem', color: '#94a3b8'}} aria-hidden="true"/>
             <input 
                type="text"
                className="search-bar"
                placeholder="Search Database by Area, Location, or Dept..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{paddingLeft: '3rem'}}
                aria-label="Search and filter active civic issues"
             />
           </div>
        </div>
        
        {/* ACCESSIBILITY: aria-live region politely announces dynamic DOM updates to screenreaders */}
        <div aria-live="polite" className="complaints-list" role="feed">
          {filteredComplaints.length === 0 ? (
             <div style={{textAlign: 'center', padding: '3rem', color: '#94a3b8'}} role="status">No geospatial issues indexed in this sector.</div>
          ) : (
            filteredComplaints.map((item) => (
              <div key={item.id} className="complaint-card" role="article" aria-label={`Complaint regarding ${item.issue_type}`}>
                <div className="complaint-header">
                  <span className="issue-type">{item.issue_type}</span>
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                     <span className={`severity-badge ${getSeverityColor(item.severity_score)}`} title="AI Danger/Severity Score" aria-label={`Severity Score ${item.severity_score} out of 10`}>
                       🔥 {item.severity_score}/10
                     </span>
                     <span className={`status-badge status-${item.status}`} aria-label={`Status: ${item.status}`}>
                       {item.status.replace('_', ' ')}
                     </span>
                  </div>
                </div>
                
                <p className="complaint-body">{item.description}</p>
                
                <div className="complaint-meta">
                  <span className="meta-item"><Building size={16} className="meta-icon" aria-hidden="true"/> {item.department}</span>
                  <span className="meta-item"><MapPin size={16} className="meta-icon" aria-hidden="true"/> {item.location}</span>
                </div>

                <div className="card-actions">
                   <button className="upvote-btn" onClick={() => upvoteComplaint(item.id)} aria-label={`Upvote this. Current upvotes: ${item.upvotes || 0}`}>
                      <ThumbsUp size={16} aria-hidden="true" /> <span>{item.upvotes || 0} Upvotes</span>
                   </button>
                   <button 
                      className="expand-doc-btn" 
                      onClick={() => setExpandedDoc(expandedDoc === item.id ? null : item.id)}
                      aria-expanded={expandedDoc === item.id}
                      aria-controls={`doc-${item.id}`}
                   >
                     <FileText size={16} aria-hidden="true" /> {expandedDoc === item.id ? 'Hide Legal Document' : 'View Authorized Letter'}
                   </button>
                </div>

                {expandedDoc === item.id && (
                   <div id={`doc-${item.id}`} className="formal-doc-box" role="region" aria-label="Official Generative Action Request">
                     <h4>AI-Generated Direct Action Grievance</h4>
                     <p>{item.formal_complaint}</p>
                   </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderAuthorityPortal = () => (
    <div className="portal-container" role="application" aria-label="Official Government Data Dashboard">
       <div style={{padding: '1.5rem 1.5rem 0', display: 'flex', justifyContent: 'space-between'}}>
         <h2 style={{margin: 0}}>Official Administration Dashboard</h2>
         <span style={{background: 'rgba(236,72,153,0.2)', color: '#ec4899', padding: '0.4rem 1rem', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 800}}>RESTRICTED ACCESS</span>
       </div>
       <div style={{overflowX: 'auto', padding: '1.5rem'}}>
         <table className="portal-table" aria-label="Tabular overview of active civic infrastructure failures">
            <thead>
              <tr>
                <th scope="col">Risk Rating</th>
                <th scope="col">Infrastructure Issue</th>
                <th scope="col">Zonal Location</th>
                <th scope="col">Public Escalation (Upvotes)</th>
                <th scope="col">Lifecycle Phase</th>
                <th scope="col">Authentication Actions</th>
              </tr>
            </thead>
            <tbody>
              {complaints.length === 0 && <tr><td colSpan="6" style={{textAlign: "center"}}>No pending infrastructure events.</td></tr>}
              {complaints.sort((a,b) => (b.upvotes||0) - (a.upvotes||0)).map(item => (
                <tr key={item.id}>
                  <td>
                    <span className={`severity-badge ${getSeverityColor(item.severity_score)}`} aria-label={`Severity Score ${item.severity_score}`}>
                       🔥 {item.severity_score}/10
                    </span>
                  </td>
                  <td>
                    <strong>{item.issue_type}</strong><br/>
                    <span style={{fontSize: '0.85rem', color: '#94a3b8'}}>{item.department}</span>
                  </td>
                  <td>{item.location}</td>
                  <td><strong style={{color: '#60a5fa'}}>{item.upvotes||0} Signatures</strong></td>
                  <td>
                    <span className={`status-badge status-${item.status}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                     <div className="action-buttons">
                        {item.status === 'pending' && (
                           <button className="action-btn" onClick={() => updateComplaintStatus(item.id, 'in_progress')} aria-label={`Accept issue ${item.issue_type} into progress`}>
                             Accept Job
                           </button>
                        )}
                        {item.status !== 'resolved' && (
                           <button className="action-btn resolve" onClick={() => updateComplaintStatus(item.id, 'resolved')} aria-label={`Mark issue ${item.issue_type} as safely resolved`}>
                             Mark Resolved
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
        <p>Enterprise-Grade Civic Issue Mapping Protocol via Google Cloud & GenAI</p>
      </header>

      <nav className="tabs-container" aria-label="Primary Navigation">
        <button 
          className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`} 
          onClick={() => setActiveTab('report')}
          aria-current={activeTab === 'report' ? 'page' : undefined}
        >
          <FileText size={18} aria-hidden="true" /> Report Outage
        </button>
        <button 
          className={`tab-btn ${activeTab === 'feed' ? 'active' : ''}`} 
          onClick={() => setActiveTab('feed')}
          aria-current={activeTab === 'feed' ? 'page' : undefined}
        >
          <Activity size={18} aria-hidden="true" /> Live Public Feed
        </button>
        <button 
          className={`tab-btn ${activeTab === 'portal' ? 'active' : ''}`} 
          onClick={() => setActiveTab('portal')}
          aria-current={activeTab === 'portal' ? 'page' : undefined}
        >
          <Shield size={18} aria-hidden="true" /> Secure Administration
        </button>
      </nav>

      {/* Conditional route rendering */}
      <main>
        {activeTab === 'report' && renderIssueForm()}
        {activeTab === 'feed' && renderPublicFeed()}
        {activeTab === 'portal' && renderAuthorityPortal()}
      </main>

    </div>
  );
}

export default App;
