import './FormSection.css';

export default function FormSection({ title, description, children }) {
  let descriptionEl = null;
  if (description !== undefined) {
    descriptionEl = <p className="form-section-description">{description}</p>;
  }

  return (
    <div className="form-section">
      <div className="form-section-header">
        <h3 className="form-section-title">{title}</h3>
        {descriptionEl}
      </div>
      <div className="form-section-content">{children}</div>
    </div>
  );
}
