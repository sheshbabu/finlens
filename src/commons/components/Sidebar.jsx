import Link from './Link.jsx';
import './Sidebar.css';

export default function Sidebar() {
  return (
    <div className="sidebar-container">
      <div className="sidebar-fixed">
        <div className="sidebar-header">
          <h2>Finlens</h2>
        </div>

        <Link className="sidebar-button" activeClassName="is-active" to="/">
          Home
        </Link>
        <Link className="sidebar-button" activeClassName="is-active" to="/chat">
          Chat
        </Link>
      </div>
    </div>
  );
}
