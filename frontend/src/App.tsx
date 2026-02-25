import { Authenticator } from '@aws-amplify/ui-react';
import SubmitDataForm from './components/SubmitDataForm';

function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h1 style={{ margin: 0 }}>Data Pipeline</h1>
            <div>
              <span style={{ marginRight: '1rem' }}>{user?.signInDetails?.loginId}</span>
              <button onClick={signOut}>Sign out</button>
            </div>
          </header>
          <SubmitDataForm />
        </main>
      )}
    </Authenticator>
  );
}

export default App;
