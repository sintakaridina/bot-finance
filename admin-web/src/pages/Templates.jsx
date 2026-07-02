import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null);
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api('/admin/message-templates').then(setTemplates).catch(console.error);
  }, []);

  const open = (t) => {
    setEditing(t);
    setContent(t.content);
    setSaved(false);
  };

  const save = async () => {
    await api(`/admin/message-templates/${editing.key}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
    setSaved(true);
    const list = await api('/admin/message-templates');
    setTemplates(list);
  };

  return (
    <div>
      <h1 className="page-title">Bot Messages</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Placeholders: {'{name}'}, {'{month}'}, {'{id}'}, {'{category}'}, {'{amount}'}, {'{detail_line}'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }}>
        <div className="table-wrap">
          <table>
            <tbody>
              {templates.map((t) => (
                <tr key={t.key} style={{ cursor: 'pointer' }} onClick={() => open(t)}>
                  <td>
                    <strong>{t.key}</strong>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t.description}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editing ? (
          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>{editing.key}</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>{editing.description}</p>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={14} style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }} />
            <div className="toolbar" style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={save}>Save</button>
              {saved && <span style={{ color: '#166534' }}>Saved!</span>}
            </div>
          </div>
        ) : (
          <div className="card" style={{ color: '#94a3b8' }}>Select a template to edit</div>
        )}
      </div>
    </div>
  );
}
