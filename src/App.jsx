import { useEffect, useRef } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Layout } from './Layout/Layout';

function App() {
  const initialRefreshScheduled = useRef(false);

  useEffect(() => {
    const refreshKey = 'osan-app-initial-refresh-complete';
    if (initialRefreshScheduled.current || sessionStorage.getItem(refreshKey)) return;

    initialRefreshScheduled.current = true;
    sessionStorage.setItem(refreshKey, 'true');
    window.setTimeout(() => window.location.reload(), 500);
  }, []);

  return (
   <BrowserRouter future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}>
      <Layout></Layout>
      </BrowserRouter>
  )
}

export default App
