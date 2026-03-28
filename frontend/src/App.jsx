import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapPin, Image as ImageIcon, Send, Clock, CheckCircle, AlertTriangle, Building } from 'lucide-react';

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:8000/api' : '/api';

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [location, setLocation] = useState('');
  const [context, setContext] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complaints, setComplaints] = useState([]);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchComplaints();
    // In a real app with Firebase, this might be a listener
    const interval = setInterval(fetchComplaints, 5000);
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
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(selectedFile);
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    
    // In a real application, you might use a Geocoding API here
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(`Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)}`);
      },
      (error) => {
        console.error('Error fetching location', error);
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
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      // Reset form on success
      setFile(null);
      setPreview(null);
      setContext('');
      fetchComplaints(); // refresh listing immediately
    } catch (err) {
      console.error('Submission error:', err);
      alert('Failed to submit complaint. Please check if the backend is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch(status.toLowerCase()) {
      case 'resolved': return <CheckCircle size={18} />;
      case 'in_progress': return <AlertTriangle size={18} />;
      default: return <Clock size={18} />;
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>FixMyCity AI</h1>
        <p>Report civic issues instantly using Google AI.</p>
      </header>

      <form onSubmit={handleSubmit} className="upload-section">
        {/* Drag and drop area */}
        <div 
          className={`drop-zone ${preview ? 'has-image' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current.click()}
        >
          {preview ? (
            <img src={preview} alt="Upload preview" className="preview" />
          ) : (
            <>
              <ImageIcon className="icon-placeholder" />
              <p>Click or drag an image here</p>
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

        {/* Optional Context & Location */}
        <div className="input-group">
          <label>Additional Details (Optional)</label>
          <textarea 
            placeholder="e.g. Has been broken for 3 weeks..."
            rows={3}
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>Location Info</label>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Address or Coordinates"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="button" className="location-btn" onClick={getLocation}>
              <MapPin size={18} /> Auto-Detect
            </button>
          </div>
        </div>

        <button type="submit" className="submit-btn" disabled={isSubmitting || !file}>
          {isSubmitting ? (
             <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
               <div className="loading-spinner"></div> Analyzing with Gemini AI...
             </span>
          ) : (
             <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
               <Send size={20} /> Submit Issue
             </span>
          )}
        </button>
      </form>

      {complaints.length > 0 && (
        <div className="complaints-section">
          <h2>Recent Reports</h2>
          <div className="complaints-list">
            {complaints.map((item) => (
              <div key={item.id} className="complaint-card">
                <div className="complaint-header">
                  <span className="issue-type">{item.issue_type}</span>
                  <span className={`status-badge status-${item.status}`}>
                    {item.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="complaint-body">{item.description}</p>
                
                <div className="complaint-meta">
                  <span className="meta-item">
                    <Building size={14} /> {item.department}
                  </span>
                  <span className="meta-item">
                    <MapPin size={14} /> {item.location}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
