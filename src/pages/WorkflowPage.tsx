// src/pages/WorkflowPage.tsx
//
// Phase 2 landing page: explains the protocol-driven research pipeline and
// links to the Cochrane RoB 2 quality review. Entry point from the sidebar.

import { Link } from 'react-router-dom'

export default function WorkflowPage() {
  const steps = [
    { n: 1, title: 'Define a protocol', body: 'Create a PICO question, inclusion criteria, and an extraction template for a bibliography.' },
    { n: 2, title: 'Screen papers', body: 'Claude applies the inclusion criteria to each paper and records its reasoning to the audit log.' },
    { n: 3, title: 'Extract fields', body: 'Full-text retrieval (PMC → CrossRef) followed by field-by-field extraction against the protocol template.' },
    { n: 4, title: 'Assess quality', body: 'Cochrane Risk of Bias 2 scoring across five domains, with an overall 0–10 quality score.' },
    { n: 5, title: 'Review & override', body: 'Approve each AI assessment or override specific bias domains with your own reasoning.' },
  ]

  return (
    <div className="page-content" style={{ fontFamily: 'Montserrat, system-ui, sans-serif', maxWidth: 860 }}>
      <div style={{ fontSize: 30, fontWeight: 800, color: '#1a2035', marginBottom: 4 }}>Research Workflow</div>
      <div style={{ fontSize: 14, color: '#7a8aaa', marginBottom: 28 }}>
        Protocol-driven systematic review pipeline
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {steps.map(s => (
          <div
            key={s.n}
            style={{
              display: 'flex', gap: 16, padding: '18px 20px',
              background: '#fff', border: '1.5px solid #dde3ef', borderRadius: 10,
            }}
          >
            <div
              style={{
                width: 34, height: 34, borderRadius: '50%', background: '#1a2a4a',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, flexShrink: 0,
              }}
            >
              {s.n}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2035', marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: '#5a6a8a', lineHeight: 1.5 }}>{s.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '18px 22px', background: '#f8faff', border: '1.5px solid #dde3ef',
          borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2035', marginBottom: 2 }}>Start from a bibliography</div>
          <div style={{ fontSize: 12, color: '#7a8aaa' }}>
            Pick a bibliography with an attached protocol to run extraction + quality assessment.
          </div>
        </div>
        <Link
          to="/bibliographies"
          style={{
            padding: '10px 18px', borderRadius: 8, background: '#c8a84b', color: '#fff',
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}
        >
          Go to Bibliographies →
        </Link>
      </div>
    </div>
  )
}
