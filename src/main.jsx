import { StrictMode } from 'react'
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { Provider } from 'react-redux'
import App from './App.jsx'
import { store } from './App/Store.js'
import { restoreSession, syncAuthenticatedUser } from './Fetures/Inventory/authSlice.js'
import './index.css'

function AuthSessionSync() {
  useEffect(() => {
    store.dispatch(restoreSession())
    const handleSessionExpired = () => {
      localStorage.removeItem('authUser')
      store.dispatch(syncAuthenticatedUser(null))
    }
    window.addEventListener('backend-auth:session-expired', handleSessionExpired)
    return () => window.removeEventListener('backend-auth:session-expired', handleSessionExpired)
  }, [])

  return null
}

createRoot(document.getElementById('root')).render(
  <StrictMode>

    <Provider store={store}>
      <AuthSessionSync />
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </Provider>
   
  </StrictMode>,
)