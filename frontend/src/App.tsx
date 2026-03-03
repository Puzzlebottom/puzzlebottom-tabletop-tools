import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { CreatePlayTablePage } from './pages/CreatePlayTablePage'
import { DiceLandingPage } from './pages/DiceLandingPage'
import { HomePage } from './pages/HomePage'
import { JoinPlayTablePage } from './pages/JoinPlayTablePage'
import { PlayTablePage } from './pages/PlayTablePage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dice" element={<DiceLandingPage />} />
      <Route path="/dice/create" element={<CreatePlayTablePage />} />
      <Route path="/dice/join/:inviteCode" element={<JoinPlayTablePage />} />
      <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
