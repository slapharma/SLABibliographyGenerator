import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import SearchPage from './pages/SearchPage'
import BibliographiesPage from './pages/BibliographiesPage'
import BibliographyDetailPage from './pages/BibliographyDetailPage'
import SavedSearchesPage from './pages/SavedSearchesPage'
import HistoryPage from './pages/HistoryPage'
import BibliographyPrintPage from './pages/BibliographyPrintPage'
import SharedBibliographyPage from './pages/SharedBibliographyPage'

export default function App() {
  return (
    <Routes>
      {/* Standalone routes — no sidebar */}
      <Route path="/bibliographies/:id/print" element={<BibliographyPrintPage />} />
      <Route path="/share/:token" element={<SharedBibliographyPage />} />

      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/bibliographies" element={<BibliographiesPage />} />
        <Route path="/bibliographies/:id" element={<BibliographyDetailPage />} />
        <Route path="/saved-searches" element={<SavedSearchesPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Route>
    </Routes>
  )
}
