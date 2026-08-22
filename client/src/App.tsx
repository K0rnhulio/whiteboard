import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { WhiteboardRoom } from './pages/WhiteboardRoom';
import { ErrorBoundary } from './components/ErrorBoundary';

// Direct slug redirect helper (e.g. /1clientwhiteboard -> /board/1clientwhiteboard)
const DirectBoardRedirect: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/board/${slug}${window.location.search}`} replace />;
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/board/:slug" element={<WhiteboardRoom />} />
          {/* Direct slug shortcut support */}
          <Route path="/:slug" element={<DirectBoardRedirect />} />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
};
