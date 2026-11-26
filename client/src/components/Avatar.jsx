import { useState } from 'react';
import { resolveAssetUrl } from '../api/client';

export function Avatar({ name = 'V', photoUrl = '', large = false }) {
  const [imgFailed, setImgFailed] = useState(false);

  const initials =
    String(name)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || 'V';

  if (photoUrl && !imgFailed) {
    return (
      <img
        src={resolveAssetUrl(photoUrl)}
        alt={name}
        className={`avatar ${large ? 'avatar-lg' : ''}`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return <div className={`avatar ${large ? 'avatar-lg' : ''}`}>{initials}</div>;
}
