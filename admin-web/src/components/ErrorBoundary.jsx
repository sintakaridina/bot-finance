import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="center" style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>
            The page failed to load. Try refreshing your browser.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
