import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';

// Компоненты
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import OntologyBrowser from './pages/OntologyBrowser';
import SparqlEditor from './pages/SparqlEditor';
import Visualization from './pages/Visualization';
import Upload from './pages/Upload';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Layout>
            <Box sx={{ p: 3 }}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/browser" element={<OntologyBrowser />} />
                <Route path="/sparql" element={<SparqlEditor />} />
                <Route path="/visualization" element={<Visualization />} />
                <Route path="/upload" element={<Upload />} />
              </Routes>
            </Box>
          </Layout>
        </Router>
      </ThemeProvider>
  );
}

export default App;