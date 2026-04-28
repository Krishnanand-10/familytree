import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Trash2, Camera, Upload, XCircle } from 'lucide-react';

const MemberModal = ({ isOpen, onClose, onSave, onDelete, member, mode }) => {
  const [formData, setFormData] = useState({
    name: '',
    birthYear: '',
    deathYear: '',
    gender: 'male',
    imageUrl: '',
    isAlive: true
  });

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.data.name || '',
        birthYear: member.data.birthYear || '',
        deathYear: member.data.deathYear || '',
        gender: member.data.gender || 'male',
        imageUrl: member.data.imageUrl || '',
        isAlive: member.data.isAlive !== undefined ? member.data.isAlive : !member.data.deathYear
      });
    } else {
      setFormData({
        name: '',
        birthYear: '',
        deathYear: '',
        gender: 'male',
        imageUrl: '',
        isAlive: true
      });
    }
  }, [member, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>{mode === 'edit' ? 'Edit Family Member' : 'Add Family Member'}</h2>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Full Name</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. John Smith"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Gender</label>
              <select 
                value={formData.gender} 
                onChange={(e) => setFormData({...formData, gender: e.target.value})}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other / Unknown</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <div className="checkbox-group">
                <input 
                  type="checkbox" 
                  id="isAlive" 
                  checked={formData.isAlive} 
                  onChange={(e) => setFormData({...formData, isAlive: e.target.checked, deathYear: e.target.checked ? '' : formData.deathYear})}
                />
                <label htmlFor="isAlive">Is Alive</label>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Birth Year</label>
              <input 
                type="number" 
                value={formData.birthYear} 
                onChange={(e) => setFormData({...formData, birthYear: e.target.value})}
                placeholder="YYYY"
              />
            </div>
            {!formData.isAlive && (
              <div className="form-group">
                <label>Death Year</label>
                <input 
                  type="number" 
                  value={formData.deathYear} 
                  onChange={(e) => setFormData({...formData, deathYear: e.target.value})}
                  placeholder="YYYY"
                />
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Photo</label>
            <ImageUploader
              value={formData.imageUrl}
              gender={formData.gender}
              onChange={(val) => setFormData({ ...formData, imageUrl: val })}
            />
          </div>

          <div className="modal-footer">
            {mode === 'edit' && onDelete && (
              <button type="button" onClick={() => onDelete(member.id)} className="delete-btn">
                <Trash2 size={18} /> Delete
              </button>
            )}
            <div style={{ flex: 1 }}></div>
            <button type="button" onClick={onClose} className="cancel-btn">Cancel</button>
            <button type="submit" className="save-btn">
              <Save size={18} /> {mode === 'edit' ? 'Update' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Image Uploader Sub-component ────────────────────────────────────────────
function ImageUploader({ value, gender, onChange }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const processFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => processFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="image-uploader">
      {value ? (
        <div className="image-preview-wrap">
          <img src={value} alt="Preview" className="image-preview" />
          <div className="image-preview-overlay">
            <button
              type="button"
              className="img-overlay-btn"
              onClick={() => inputRef.current.click()}
              title="Change photo"
            >
              <Camera size={18} /> Change
            </button>
            <button
              type="button"
              className="img-overlay-btn remove"
              onClick={() => onChange('')}
              title="Remove photo"
            >
              <XCircle size={18} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`upload-zone ${dragging ? 'dragging' : ''}`}
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <Upload size={28} color={gender === 'female' ? '#e91e63' : '#2196f3'} />
          <span>Click or drag &amp; drop a photo</span>
          <small>PNG, JPG, GIF up to 5MB</small>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}

export default MemberModal;
