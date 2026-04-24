import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

const PersonCard = ({ data }) => {
  const genderClass = data.gender === 'male' ? 'male' : data.gender === 'female' ? 'female' : '';
  
  return (
    <div className={`myheritage-card ${genderClass}`}>
      {/* Top Decor Icons */}
      <div className="card-decor-dots">
        <div className="dot"></div>
        <div className="dot"></div>
      </div>
      <div className="card-decor-green"></div>

      <Handle type="target" position={Position.Top} style={{ top: 0 }} />
      
      {/* Portrait */}
      <div className="card-portrait">
        {data.photo_url ? (
          <img src={data.photo_url} alt={data.full_name} />
        ) : (
          <div className="portrait-init">{data.full_name?.charAt(0) || '?'}</div>
        )}
      </div>

      {/* Info Section */}
      <div className="card-info">
        <div className="card-name">{data.full_name}</div>
        <div className="card-years">
          {data.birth_date ? data.birth_date.substring(0, 4) : '????'} 
          {data.death_date && ` - ${data.death_date.substring(0, 4)}`}
        </div>
      </div>

      {/* Interactive Icons */}
      <div className="card-edit">✎</div>
      <div className="card-plus" title="Add Child">+</div>

      <Handle type="source" position={Position.Bottom} style={{ bottom: 0 }} />
    </div>
  );
};

export default memo(PersonCard);
