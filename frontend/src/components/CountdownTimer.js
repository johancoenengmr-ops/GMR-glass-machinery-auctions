import React, { useState, useEffect } from 'react';

function pad(n) {
  return String(n).padStart(2, '0');
}

export default function CountdownTimer({ endTime }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const end = new Date(endTime).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setExpired(true);
        setTimeLeft('Ended');
        return;
      }

      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${pad(hours)}h ${pad(mins)}m`);
      } else {
        setTimeLeft(`${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  return (
    <span className={expired ? '' : 'timer'} style={expired ? { color: '#999' } : {}}>
      {timeLeft}
    </span>
  );
}
