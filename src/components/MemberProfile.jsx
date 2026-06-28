import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit2, GitBranch, MapPin, Globe, User, FileText, Heart } from 'lucide-react';

export default function MemberProfile({ isOpen, member, onClose, onEdit, onFindRelation }) {
  if (!member) return null;

  const {
    name, gender, birthYear, deathYear,
    imageUrl, isAlive, notes, birthPlace, nationality
  } = member.data;

  const accentColor =
    gender === 'female' ? '#e91e63' :
    gender === 'other'  ? '#9c27b0' : '#2196f3';

  const genderSymbol =
    gender === 'female' ? '♀' :
    gender === 'other'  ? '⚥' : '♂';

  const lifespan = (() => {
    const parts = [];
    if (birthYear) parts.push(birthYear);
    if (deathYear) parts.push(`† ${deathYear}`);
    else if (birthYear) parts.push('Present');
    return parts.join('  –  ');
  })();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — click to close */}
          <motion.div
            className="profile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Side panel */}
          <motion.div
            className="profile-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 260, mass: 0.9 }}
          >
            {/* Header */}
            <div className="profile-panel-header">
              <span className="profile-panel-title">Profile</span>
              <button className="profile-close-btn" onClick={onClose} title="Close">
                <X size={17} />
              </button>
            </div>

            {/* Avatar + name */}
            <div className="profile-hero">
              <div className="profile-avatar-wrap" style={{ '--accent': accentColor }}>
                {imageUrl ? (
                  <img src={imageUrl} alt={name} className="profile-avatar-img" />
                ) : (
                  <div className="profile-avatar-placeholder">
                    <User size={48} color={accentColor} />
                  </div>
                )}
                <span className="profile-gender-badge" style={{ background: accentColor }}>
                  {genderSymbol}
                </span>
              </div>

              <div className="profile-hero-info">
                <h2 className="profile-name">{name || 'Unknown'}</h2>
                {lifespan && (
                  <p className="profile-lifespan">{lifespan}</p>
                )}
                {!isAlive && (
                  <span className="profile-deceased-tag">Deceased</span>
                )}
              </div>
            </div>

            {/* Detail fields */}
            <div className="profile-details">
              {birthPlace && (
                <div className="profile-detail-row">
                  <MapPin size={14} className="profile-detail-icon" />
                  <div>
                    <div className="profile-detail-label">Birthplace</div>
                    <div className="profile-detail-value">{birthPlace}</div>
                  </div>
                </div>
              )}
              {nationality && (
                <div className="profile-detail-row">
                  <Globe size={14} className="profile-detail-icon" />
                  <div>
                    <div className="profile-detail-label">Nationality / Ethnicity</div>
                    <div className="profile-detail-value">{nationality}</div>
                  </div>
                </div>
              )}
              {!birthPlace && !nationality && !notes && (
                <p className="profile-empty-hint">No additional details. Click Edit to add more.</p>
              )}
            </div>

            {/* Notes */}
            {notes && (
              <div className="profile-notes-section">
                <div className="profile-notes-label">
                  <FileText size={13} /> Notes
                </div>
                <p className="profile-notes-text">{notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="profile-actions">
              <button
                className="profile-action-btn primary"
                onClick={() => onEdit(member.id)}
              >
                <Edit2 size={14} />
                Edit Member
              </button>
              <button
                className="profile-action-btn secondary"
                onClick={() => onFindRelation(member.id)}
              >
                <GitBranch size={14} />
                Find Relation
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
