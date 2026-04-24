import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';

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
            <label>Photo URL (Optional)</label>
            <input 
              type="url" 
              value={formData.imageUrl} 
              onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
              placeholder="https://..."
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

export default MemberModal;
