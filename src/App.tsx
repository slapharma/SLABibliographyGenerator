import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import SearchPage from './pages/SearchPage'
import BibliographiesPage from './pages/BibliographiesPage'
import BibliographyDetailPage from './pages/BibliographyDetailPage'
import SavedSearchesPage from './pages/SavedSearchesPage'
import HistoryPage from './pages/HistoryPage'

export default function App() {
  return (
    <Routes>
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
