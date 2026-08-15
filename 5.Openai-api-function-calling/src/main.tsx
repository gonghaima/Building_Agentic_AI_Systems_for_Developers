import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import BaselineResponses from './pages/baseline/responses.tsx'
import Lesson01Responses from './pages/lesson-01/responses.tsx'
import Lesson02Responses from './pages/lesson-02/responses.tsx'
import Lesson03Responses from './pages/lesson-03/responses.tsx'
import Lesson04Responses from './pages/lesson-04/responses.tsx'
import Lesson05Responses from './pages/lesson-05/responses.tsx'
import Lesson06Responses from './pages/lesson-06/responses.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/baseline/responses" element={<BaselineResponses />} />
        <Route path="/lesson-01/responses" element={<Lesson01Responses />} />
        <Route path="/lesson-02/responses" element={<Lesson02Responses />} />
        <Route path="/lesson-03/responses" element={<Lesson03Responses />} />
        <Route path="/lesson-04/responses" element={<Lesson04Responses />} />
        <Route path="/lesson-05/responses" element={<Lesson05Responses />} />
        <Route path="/lesson-06/responses" element={<Lesson06Responses />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
