const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/sparql', require('./src/routes/sparql.routes'));
app.use('/api/ontology', require('./src/routes/ontology.routes'));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Внутренняя ошибка сервера',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint не найден',
        requested_url: req.originalUrl
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 SPARQL endpoints:`);
    console.log(`   POST http://localhost:${PORT}/api/sparql`);
    console.log(`   POST http://localhost:${PORT}/api/sparql/query`);
    console.log(`   POST http://localhost:${PORT}/api/sparql/update`);
    console.log(`   POST http://localhost:${PORT}/api/sparql/export`);
    console.log(`   GET  http://localhost:${PORT}/api/sparql/info`);
    console.log(`📚 Ontology endpoints:`);
    console.log(`   POST http://localhost:${PORT}/api/ontology/upload`);
    console.log(`   GET  http://localhost:${PORT}/api/ontology/statistics`);
});