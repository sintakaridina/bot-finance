import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api/client';
import { getSocket } from '../api/socket';
import { useAuth } from '../context/AuthContext';

export default function BotConnect() {
  const auth = useAuth();
  const botInstanceId = auth?.botInstanceId;
  const [status, setStatus] = useState('disconnected');
  const [qr, setQr] = useState(null);
  const [phone, setPhone] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qrKey, setQrKey] = useState(0);

  useEffect(() => {
    if (!botInstanceId) return;

    let active = true;

    api(`/bots/${botInstanceId}/status`).then((d) => {
      if (!active) return;
      setStatus(d.liveStatus || d.status);
      if (d.phone_number) setPhone(d.phone_number);
      if (d.qr) {
        setQr(d.qr);
        setQrKey((k) => k + 1);
      }
    }).catch(console.error);

    const socket = getSocket();
    if (!socket) return undefined;

    const subscribe = () => socket.emit('bot:subscribe', botInstanceId);

    const onQr = ({ qr: q }) => {
      if (!active) return;
      setQr(q);
      setQrKey((k) => k + 1);
      setStatus('qr_pending');
    };

    const onStatus = ({ status: s, phone: p }) => {
      if (!active) return;
      setStatus(s);
      if (p) setPhone(p);
      if (s === 'ready' || s === 'disconnected') setQr(null);
    };

    if (socket.connected) subscribe();
    socket.on('connect', subscribe);
    socket.on('bot:qr', onQr);
    socket.on('bot:status', onStatus);

    return () => {
      active = false;
      socket.off('connect', subscribe);
      socket.off('bot:qr', onQr);
      socket.off('bot:status', onStatus);
    };
  }, [botInstanceId]);

  const connect = async () => {
    setLoading(true);
    try {
      const res = await api(`/bots/${botInstanceId}/connect`, { method: 'POST' });
      setStatus(res.status || 'connecting');
      if (res.qr) {
        setQr(res.qr);
        setQrKey((k) => k + 1);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetAndConnect = async () => {
    if (!confirm('Reset WhatsApp session and start fresh? You will need to scan the QR code again.')) return;
    setLoading(true);
    try {
      setQr(null);
      await api(`/bots/${botInstanceId}/reset`, { method: 'POST' });
      setStatus('connecting');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    await api(`/bots/${botInstanceId}/disconnect`, { method: 'POST' });
    setQr(null);
    setStatus('disconnected');
  };

  if (!botInstanceId) return <div>Bot instance not found</div>;

  return (
    <div>
      <h1 className="page-title">Connect WhatsApp</h1>

      <div className="cards" style={{ maxWidth: 400 }}>
        <div className="card">
          <div className="label">Status</div>
          <div className="value" style={{ fontSize: '1.1rem', textTransform: 'capitalize' }}>{status}</div>
          {phone && <div style={{ marginTop: '0.5rem', color: '#64748b' }}>+{phone}</div>}
        </div>
      </div>

      <div className="toolbar">
        {status !== 'ready' && status !== 'qr_pending' && (
          <button className="btn btn-primary" onClick={connect} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        )}
        {status === 'qr_pending' && (
          <button className="btn btn-secondary" onClick={resetAndConnect} disabled={loading}>
            QR failed? Reset & retry
          </button>
        )}
        <button className="btn btn-danger" onClick={disconnect}>Disconnect</button>
      </div>

      {qr && (
        <div className="qr-box" style={{ marginTop: '1.5rem' }}>
          <QRCodeSVG key={qrKey} value={qr} size={256} />
          <p><strong>Scan this QR now</strong> — it refreshes automatically every ~20 seconds</p>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            WhatsApp → Linked Devices → Link a Device
          </p>
        </div>
      )}

      {status === 'connecting' && !qr && (
        <p style={{ marginTop: '1rem', color: '#64748b' }}>Waiting for QR code...</p>
      )}

      {status === 'ready' && (
        <p style={{ marginTop: '1rem', color: '#166534' }}>Bot is ready! Add the number to your WhatsApp groups.</p>
      )}

      {(status === 'qr_pending' || status === 'auth_failure') && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#fef3c7', borderRadius: 8, maxWidth: 480 }}>
          <strong>If you see &quot;Couldn&apos;t link device&quot;:</strong>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem', fontSize: '0.9rem' }}>
            <li>Wait for a new QR code, then scan immediately</li>
            <li>Turn off VPN on your phone</li>
            <li>Update WhatsApp to the latest version</li>
            <li>Click <em>QR failed? Reset & retry</em> and scan again</li>
          </ul>
        </div>
      )}
    </div>
  );
}
