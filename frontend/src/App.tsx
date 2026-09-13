import { Routes, Route, Navigate } from 'react-router-dom'
import { Shell } from '@/components/Shell'
import { DashboardPage } from '@/pages/DashboardPage'
import { UploadPage } from '@/pages/UploadPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { QueryPage } from '@/pages/QueryPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { ReportPage } from '@/pages/ReportPage'

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/datasets/:datasetId/profile" element={<ProfilePage />} />
        <Route path="/datasets/:datasetId/query" element={<QueryPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/reports/:reportId" element={<ReportPage />} />
      </Routes>
    </Shell>
  )
}
