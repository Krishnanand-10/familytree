import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit2, GitBranch, MapPin, Globe, User, FileText, Calendar, Users, ChevronRight } from 'lucide-react';

export default function MemberProfile({ isOpen, member, nodes, edges, onClose, onEdit, onFindRelation, onSelectMember }) {
  // ── Calculate Relatives ────────────────────────────────────────────────────
  const relatives = useMemo(() => {
    if (!member || !nodes || !edges) return { parents: [], children: [], spouses: [] };
    const memberIds = new Set(nodes.filter(n => n.type === 'member').map(n => n.id));
    
    const spouses = [];
    const parents = [];
    const children = [];

    // Direct spouse edges
    edges.filter(e => e.type === 'spouse').forEach(e => {
      if (e.source === member.id && memberIds.has(e.target)) spouses.push(nodes.find(n => n.id === e.target));
      if (e.target === member.id && memberIds.has(e.source)) spouses.push(nodes.find(n => n.id === e.source));
    });

    // Parent/child junctions
    const junctionParents = {};
    const junctionChildren = {};
    
    edges.filter(e => e.type === 'marriage').forEach(e => {
      if (!junctionParents[e.target]) junctionParents[e.target] = [];
      if (memberIds.has(e.source)) junctionParents[e.target].push(e.source);
    });

    edges.filter(e => e.type === 'family').forEach(e => {
      const srcNode = nodes.find(n => n.id === e.source);
      if (srcNode?.type === 'junction' && memberIds.has(e.target)) {
        if (!junctionChildren[e.source]) junctionChildren[e.source] = [];
        junctionChildren[e.source].push(e.target);
      }
    });

    // Link via junctions
    Object.entries(junctionChildren).forEach(([jId, cIds]) => {
      const pIds = junctionParents[jId] || [];
      if (pIds.includes(member.id)) {
        cIds.forEach(cId => {
          const childNode = nodes.find(n => n.id === cId);
          if (childNode && !children.some(c => c.id === cId)) children.push(childNode);
        });

        // Connect parents sharing a junction as spouses of the active member
        if (pIds.length === 2) {
          const [pA, pB] = pIds;
          const otherParentId = pA === member.id ? pB : pA;
          const otherParentNode = nodes.find(n => n.id === otherParentId);
          if (otherParentNode && !spouses.some(s => s.id === otherParentId)) spouses.push(otherParentNode);
        }
      }
      if (cIds.includes(member.id)) {
        pIds.forEach(pId => {
          const parentNode = nodes.find(n => n.id === pId);
          if (parentNode && !parents.some(p => p.id === pId)) parents.push(parentNode);
        });
      }
    });

    // Direct family edges (member → member)
    edges.filter(e => e.type === 'family' || e.type === 'deletable').forEach(e => {
      if (e.source === member.id && memberIds.has(e.target)) {
        const childNode = nodes.find(n => n.id === e.target);
        if (childNode && !children.some(c => c.id === childNode.id)) children.push(childNode);
      }
      if (e.target === member.id && memberIds.has(e.source)) {
        const parentNode = nodes.find(n => n.id === e.source);
        if (parentNode && !parents.some(p => p.id === parentNode.id)) parents.push(parentNode);
      }
    });

    return { parents, children, spouses };
  }, [member, nodes, edges]);

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

  const genderLabel =
    gender === 'female' ? 'Female' :
    gender === 'other'  ? 'Other' : 'Male';

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
              <span className="profile-panel-title">Member Details</span>
              <button className="profile-close-btn" onClick={onClose} title="Close">
                <X size={17} />
              </button>
            </div>

            {/* Scrollable Container */}
            <div className="profile-scroll-body" style={{ flex: 1, overflowY: 'auto', paddingBottom: '20px' }}>
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
                  <div className="profile-hero-badges" style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '6px' }}>
                    <span className="profile-badge gender" style={{ border: `1px solid ${accentColor}33`, color: accentColor, background: `${accentColor}11` }}>
                      {genderLabel}
                    </span>
                    <span className={`profile-badge status ${isAlive ? 'alive' : 'deceased'}`}
                      style={{
                        border: isAlive ? '1px solid rgba(74, 222, 128, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
                        color: isAlive ? '#4ade80' : '#f87171',
                        background: isAlive ? 'rgba(74, 222, 128, 0.08)' : 'rgba(239, 68, 68, 0.08)'
                      }}
                    >
                      {isAlive ? 'Alive' : 'Deceased'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detail fields */}
              <div className="profile-details-section">
                <div className="profile-detail-row">
                  <Calendar size={14} className="profile-detail-icon" />
                  <div>
                    <div className="profile-detail-label">Lifespan / Years</div>
                    <div className="profile-detail-value">{lifespan || 'Not specified'}</div>
                  </div>
                </div>

                <div className="profile-detail-row">
                  <MapPin size={14} className="profile-detail-icon" />
                  <div>
                    <div className="profile-detail-label">Birthplace</div>
                    <div className="profile-detail-value">{birthPlace || 'Not specified'}</div>
                  </div>
                </div>

                <div className="profile-detail-row">
                  <Globe size={14} className="profile-detail-icon" />
                  <div>
                    <div className="profile-detail-label">Nationality / Ethnicity</div>
                    <div className="profile-detail-value">{nationality || 'Not specified'}</div>
                  </div>
                </div>
              </div>

              {/* Relatives list */}
              <div className="profile-relatives-section">
                <h3 className="profile-sec-title">
                  <Users size={13} />
                  <span>Family Connections</span>
                </h3>

                {/* Parents */}
                <div className="profile-rel-group">
                  <div className="profile-rel-group-title">Parents</div>
                  {relatives.parents.length === 0 ? (
                    <div className="profile-rel-empty">No parents added</div>
                  ) : (
                    relatives.parents.map(p => (
                      <button key={p.id} className="profile-rel-chip" onClick={() => onSelectMember(p.id)}>
                        <span className="profile-rel-gender-dot" style={{ background: p.data.gender === 'female' ? '#e91e63' : '#2196f3' }} />
                        <span className="profile-rel-name">{p.data.name}</span>
                        <ChevronRight size={12} className="profile-rel-chevron" />
                      </button>
                    ))
                  )}
                </div>

                {/* Spouses */}
                <div className="profile-rel-group">
                  <div className="profile-rel-group-title">Spouse / Partner</div>
                  {relatives.spouses.length === 0 ? (
                    <div className="profile-rel-empty">No spouses added</div>
                  ) : (
                    relatives.spouses.map(s => (
                      <button key={s.id} className="profile-rel-chip" onClick={() => onSelectMember(s.id)}>
                        <span className="profile-rel-gender-dot" style={{ background: s.data.gender === 'female' ? '#e91e63' : '#2196f3' }} />
                        <span className="profile-rel-name">{s.data.name}</span>
                        <ChevronRight size={12} className="profile-rel-chevron" />
                      </button>
                    ))
                  )}
                </div>

                {/* Children */}
                <div className="profile-rel-group">
                  <div className="profile-rel-group-title">Children</div>
                  {relatives.children.length === 0 ? (
                    <div className="profile-rel-empty">No children added</div>
                  ) : (
                    relatives.children.map(c => (
                      <button key={c.id} className="profile-rel-chip" onClick={() => onSelectMember(c.id)}>
                        <span className="profile-rel-gender-dot" style={{ background: c.data.gender === 'female' ? '#e91e63' : '#2196f3' }} />
                        <span className="profile-rel-name">{c.data.name}</span>
                        <ChevronRight size={12} className="profile-rel-chevron" />
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="profile-notes-section" style={{ marginTop: '16px' }}>
                <div className="profile-notes-label">
                  <FileText size={13} /> Notes / Biography
                </div>
                <p className="profile-notes-text">{notes || 'No biographical notes added yet.'}</p>
              </div>
            </div>

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
