import '@aws-amplify/ui-react/styles.css'

import { ThemeProvider } from '@aws-amplify/ui-react'
import { Amplify } from 'aws-amplify'
import React from 'react'
import ReactDOM from 'react-dom/client'

import amplifyConfig from './amplifyconfiguration'
import App from './App'

Amplify.configure(amplifyConfig)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
