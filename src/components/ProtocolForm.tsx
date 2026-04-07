import { useState } from 'react'

export interface ExtractionField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'boolean'
  required: boolean
}

export interface ProtocolDefinition {
  picoQuestion: string
  inclusionCriteria: string
  extractionTemplate: ExtractionField[]
}

interface Props {
  onSave: (protocol: ProtocolDefinition) => void
  isLoading?: boolean
  initialProtocol?: ProtocolDefinition
}

export default function ProtocolForm({ onSave, isLoading = false, initialProtocol }: Props) {
  const [picoQuestion, setPicoQuestion] = useState(initialProtocol?.picoQuestion ?? '')
  const [inclusionCriteria, setInclusionCriteria] = useState(initialProtocol?.inclusionCriteria ?? '')
  const [extractionFields, setExtractionFields] = useState<ExtractionField[]>(
    initialProtocol?.extractionTemplate ?? [
      { name: 'population', label: 'Population', type: 'textarea', required: true },
      { name: 'intervention', label: 'Intervention', type: 'textarea', required: true },
      { name: 'outcomes', label: 'Outcomes', type: 'textarea', required: true },
      { name: 'study_design', label: 'Study Design', type: 'text', required: true },
    ]
  )
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState<'text' | 'textarea' | 'number' | 'boolean'>('text')

  const handleAddField = () => {
    if (newFieldLabel.trim()) {
      const fieldName = newFieldLabel.toLowerCase().replace(/\s+/g, '_')
      setExtractionFields([
        ...extractionFields,
        {
          name: fieldName,
          label: newFieldLabel.trim(),
          type: newFieldType,
          required: true,
        },
      ])
      setNewFieldLabel('')
      setNewFieldType('text')
    }
  }

  const handleRemoveField = (index: number) => {
    setExtractionFields(extractionFields.filter((_, i) => i !== index))
  }

  const handleToggleRequired = (index: number) => {
    const updated = [...extractionFields]
    updated[index].required = !updated[index].required
    setExtractionFields(updated)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!picoQuestion.trim()) {
      alert('PICO question is required')
      return
    }
    if (!inclusionCriteria.trim()) {
      alert('Inclusion criteria is required')
      return
    }
    if (extractionFields.length === 0) {
      alert('At least one extraction field is required')
      return
    }
    onSave({
      picoQuestion: picoQuestion.trim(),
      inclusionCriteria: inclusionCriteria.trim(),
      extractionTemplate: extractionFields,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="protocol-form">
      <div className="form-section">
        <label htmlFor="pico">
          <strong>PICO Question</strong>
          <span className="required">*</span>
        </label>
        <p className="help-text">Define your research question: Participant, Intervention, Comparator, Outcome</p>
        <textarea
          id="pico"
          value={picoQuestion}
          onChange={(e) => setPicoQuestion(e.target.value)}
          placeholder="e.g., In adults with Type 2 diabetes, does GLP-1 agonist therapy reduce cardiovascular mortality compared to standard care?"
          rows={3}
          disabled={isLoading}
        />
      </div>

      <div className="form-section">
        <label htmlFor="inclusion">
          <strong>Inclusion Criteria</strong>
          <span className="required">*</span>
        </label>
        <p className="help-text">Define the criteria for including studies in your review</p>
        <textarea
          id="inclusion"
          value={inclusionCriteria}
          onChange={(e) => setInclusionCriteria(e.target.value)}
          placeholder="e.g., Randomized controlled trials published in English between 2015-2025, adult participants, published in peer-reviewed journals"
          rows={4}
          disabled={isLoading}
        />
      </div>

      <div className="form-section">
        <h3>Extraction Template</h3>
        <p className="help-text">Define the data fields to extract from each included study</p>

        <div className="extraction-fields-list">
          {extractionFields.map((field, idx) => (
            <div key={idx} className="extraction-field-item">
              <div className="field-info">
                <span className="field-label">{field.label}</span>
                <span className="field-type">({field.type})</span>
                {field.required && <span className="field-required">required</span>}
              </div>
              <div className="field-actions">
                <button
                  type="button"
                  onClick={() => handleToggleRequired(idx)}
                  className="btn-toggle-required"
                  title={field.required ? 'Make optional' : 'Make required'}
                >
                  {field.required ? '✓' : 'optional'}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveField(idx)}
                  className="btn-remove"
                  disabled={isLoading}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="add-field">
          <input
            type="text"
            value={newFieldLabel}
            onChange={(e) => setNewFieldLabel(e.target.value)}
            placeholder="Field label (e.g., 'Risk of Bias Score')"
            disabled={isLoading}
            onKeyPress={(e) => e.key === 'Enter' && handleAddField()}
          />
          <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as any)} disabled={isLoading}>
            <option value="text">Short Text</option>
            <option value="textarea">Long Text</option>
            <option value="number">Number</option>
            <option value="boolean">Yes/No</option>
          </select>
          <button type="button" onClick={handleAddField} disabled={!newFieldLabel.trim() || isLoading} className="btn-add">
            Add Field
          </button>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={isLoading} className="btn-primary">
          {isLoading ? 'Creating Protocol...' : 'Create Protocol'}
        </button>
      </div>

      <style>{`
        .protocol-form {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          max-width: 900px;
        }

        .form-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-section label {
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .required {
          color: #dc2626;
        }

        .help-text {
          color: #6b7280;
          font-size: 0.875rem;
          margin: 0;
        }

        textarea,
        input {
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-family: inherit;
          font-size: 1rem;
          resize: vertical;
        }

        textarea:disabled,
        input:disabled {
          background-color: #f3f4f6;
          cursor: not-allowed;
        }

        .extraction-fields-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.375rem;
          overflow: hidden;
        }

        .extraction-field-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .extraction-field-item:last-child {
          border-bottom: none;
        }

        .field-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .field-label {
          font-weight: 500;
        }

        .field-type {
          color: #6b7280;
          font-size: 0.875rem;
        }

        .field-required {
          display: inline-block;
          padding: 0.125rem 0.5rem;
          background-color: #dc2626;
          color: white;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .field-actions {
          display: flex;
          gap: 0.5rem;
        }

        .btn-toggle-required,
        .btn-remove {
          padding: 0.5rem 1rem;
          border: 1px solid #d1d5db;
          background-color: white;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s;
        }

        .btn-toggle-required:hover {
          background-color: #f3f4f6;
        }

        .btn-remove:hover:not(:disabled) {
          border-color: #dc2626;
          color: #dc2626;
        }

        .btn-remove:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .add-field {
          display: flex;
          gap: 0.75rem;
          align-items: flex-end;
        }

        .add-field input {
          flex: 1;
        }

        .add-field select {
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 1rem;
        }

        .btn-add {
          padding: 0.75rem 1.5rem;
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        .btn-add:hover:not(:disabled) {
          background-color: #2563eb;
        }

        .btn-add:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
        }

        .btn-primary {
          padding: 1rem 2rem;
          background-color: #059669;
          color: white;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
          font-weight: 600;
          font-size: 1rem;
          transition: background-color 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: #047857;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </form>
  )
}
