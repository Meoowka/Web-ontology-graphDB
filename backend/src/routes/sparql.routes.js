const express = require('express');
const router = express.Router();
const graphdb = require('../utils/graphdb.client');

// Вспомогательная функция для определения типа запроса
function getQueryType(query) {
    if (!query || typeof query !== 'string') return 'UNKNOWN';

    const queryUpper = query.trim().toUpperCase();

    // Удаляем PREFIX строки для корректного определения
    let queryWithoutPrefix = queryUpper;
    queryWithoutPrefix = queryWithoutPrefix.replace(/PREFIX\s+[^\s:]+\s*:\s*<[^>]+>\s*/g, '');
    queryWithoutPrefix = queryWithoutPrefix.replace(/PREFIX\s+[^\s]+\s+<[^>]+>\s*/g, '');
    queryWithoutPrefix = queryWithoutPrefix.trim();

    const firstWord = queryWithoutPrefix.split(' ')[0];

    // Определяем тип
    if (firstWord.startsWith('SELECT')) return 'SELECT';
    if (firstWord.startsWith('INSERT')) return 'INSERT';
    if (firstWord.startsWith('DELETE')) return 'DELETE';
    if (firstWord.startsWith('UPDATE')) return 'UPDATE';
    if (firstWord.startsWith('CONSTRUCT')) return 'CONSTRUCT';
    if (firstWord.startsWith('ASK')) return 'ASK';
    if (firstWord.startsWith('DESCRIBE')) return 'DESCRIBE';
    if (firstWord.startsWith('CLEAR')) return 'CLEAR';
    if (firstWord.startsWith('DROP')) return 'DROP';
    if (firstWord.startsWith('LOAD')) return 'LOAD';
    if (firstWord.startsWith('CREATE')) return 'CREATE';

    return firstWord || 'UNKNOWN';
}

// Универсальный SPARQL endpoint
router.post('/', async (req, res) => {
    try {
        console.log('=== SPARQL endpoint called ===');
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Body keys:', Object.keys(req.body));

        let query = '';
        let format = 'json';

        // Определяем формат запроса
        if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
            query = req.body.query;
            format = req.body.format || 'json';
        } else if (req.headers['content-type']?.includes('application/json')) {
            query = req.body.query;
            format = req.body.format || 'json';
        } else {
            query = req.body.query || req.body;
        }

        if (!query) {
            return res.status(400).json({
                error: 'SPARQL запрос не предоставлен',
                details: 'Запрос должен быть передан в параметре "query"'
            });
        }

        const queryType = getQueryType(query);
        console.log(`Query type: ${queryType}`);
        console.log(`Query: ${query.substring(0, 200)}...`);

        // Выполняем запрос
        const result = await graphdb.executeAnySparql(query, format);

        if (result.success) {
            console.log('Query executed successfully');

            if (['SELECT', 'ASK', 'CONSTRUCT', 'DESCRIBE'].includes(queryType)) {
                // Это query запрос
                if (format === 'json') {
                    res.json(result.data);
                } else {
                    res.set('Content-Type', result.headers?.['content-type'] || getContentType(format));
                    res.send(result.data);
                }
            } else {
                // Это update запрос
                res.json({
                    success: true,
                    message: 'Операция выполнена успешно',
                    query_type: queryType,
                    timestamp: new Date().toISOString(),
                    data: result.data
                });
            }
        } else {
            console.log('Query execution failed:', result.error);
            const statusCode = result.status || 500;
            res.status(statusCode).json({
                error: `Ошибка выполнения SPARQL ${queryType} запроса`,
                details: result.error,
                query_type: queryType
            });
        }
    } catch (error) {
        console.error('Error in SPARQL endpoint:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            details: error.message
        });
    }
});

// SPARQL Query endpoint (для обратной совместимости)
router.post('/query', async (req, res) => {
    try {
        const { query, format = 'json' } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'SPARQL запрос не предоставлен' });
        }

        const result = await graphdb.executeSparql(query, format);

        if (result.success) {
            if (format === 'json') {
                res.json(result.data);
            } else {
                res.set('Content-Type', result.headers['content-type']);
                res.send(result.data);
            }
        } else {
            res.status(500).json({
                error: 'Ошибка выполнения SPARQL запроса',
                details: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            details: error.message
        });
    }
});

// SPARQL Update endpoint (для обратной совместимости)
router.post('/update', async (req, res) => {
    try {
        let query = '';

        if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
            query = req.body.query;
        } else if (req.headers['content-type']?.includes('application/json')) {
            query = req.body.query;
        } else {
            query = req.body.query || req.body;
        }

        if (!query) {
            return res.status(400).json({
                error: 'SPARQL запрос не предоставлен',
                details: 'Запрос должен быть передан в параметре "query"'
            });
        }

        console.log(`Executing UPDATE query: ${query.substring(0, 100)}...`);

        const result = await graphdb.executeUpdate(query);

        if (result.success) {
            res.json({
                success: true,
                message: 'Операция выполнена успешно',
                query_type: getQueryType(query),
                timestamp: new Date().toISOString(),
                data: result.data
            });
        } else {
            res.status(500).json({
                error: 'Ошибка выполнения SPARQL UPDATE запроса',
                details: result.error,
                query_type: getQueryType(query)
            });
        }
    } catch (error) {
        console.error('Error in update endpoint:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера при выполнении UPDATE запроса',
            details: error.message
        });
    }
});

// Экспорт данных
router.post('/export', async (req, res) => {
    try {
        // format comes from UI select:
        // - application/json
        // - text/csv
        // - text/turtle
        const { format = 'application/json' } = req.body;

        console.log(`Export request, format: ${format}`);

        const filterBlock = `
            FILTER(
                STRSTARTS(STR(?s), "http://test.com/ontology#") ||
                STRSTARTS(STR(?p), "http://test.com/ontology#") ||
                (isIRI(?o) && STRSTARTS(STR(?o), "http://test.com/ontology#"))
            )
        `;

        // For Turtle we must return RDF graph (CONSTRUCT), not SPARQL results table.
        const exportQuerySelect = `
            SELECT ?s ?p ?o
            WHERE {
                ?s ?p ?o .
                ${filterBlock}
            }
            ORDER BY ?s ?p
            LIMIT 1000
        `;

        const exportQueryConstruct = `
            CONSTRUCT {
                ?s ?p ?o .
            }
            WHERE {
                ?s ?p ?o .
                ${filterBlock}
            }
            LIMIT 1000
        `;

        let result;
        if (format === 'text/turtle') {
            result = await graphdb.executeSparql(exportQueryConstruct, 'turtle');
        } else if (format === 'application/ld+json') {
            result = await graphdb.executeSparql(exportQueryConstruct, 'ld+json');
        } else if (format === 'text/csv') {
            result = await graphdb.executeSparql(exportQuerySelect, 'csv');
        } else {
            result = await graphdb.executeSparql(exportQuerySelect, 'json');
        }

        if (result.success) {
            const contentType = getContentType(format);
            const extension = getExtension(format);
            const filename = `ontology-export-${Date.now()}.${extension}`;

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            // GraphDB returns either string (csv/turtle) or JSON object.
            if (typeof result.data === 'string') return res.send(result.data);
            return res.send(JSON.stringify(result.data, null, 2));
        } else {
            res.status(500).json({
                error: 'Ошибка экспорта данных',
                details: result.error
            });
        }
    } catch (error) {
        console.error('Export endpoint error:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера при экспорте',
            details: error.message
        });
    }
});

// Информация о endpoint'ах
router.get('/info', (req, res) => {
    const info = {
        endpoints: {
            universal: 'POST /api/sparql',
            query: 'POST /api/sparql/query',
            update: 'POST /api/sparql/update',
            export: 'POST /api/sparql/export',
            templates: 'GET /api/sparql/templates',
            status: 'GET /api/sparql/status'
        },
        supported_query_types: {
            read: ['SELECT', 'ASK', 'CONSTRUCT', 'DESCRIBE'],
            write: ['INSERT', 'DELETE', 'UPDATE', 'CLEAR', 'DROP', 'LOAD', 'CREATE']
        },
        supported_formats: {
            query: ['json', 'csv', 'tsv', 'turtle', 'rdf+xml'],
            update: ['application/x-www-form-urlencoded', 'application/json']
        },
        server_info: {
            node_version: process.version,
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString()
        }
    };

    res.json(info);
});

// Шаблоны запросов
router.get('/templates', (req, res) => {
    try {
        const templates = [
            {
                id: 'all_classes',
                name: '📊 Все классы',
                description: 'Получить все классы OWL с их типами',
                query: `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?class ?label ?comment
WHERE {
  ?class a owl:Class .
  OPTIONAL { ?class rdfs:label ?label }
  OPTIONAL { ?class rdfs:comment ?comment }
}
ORDER BY ?class
LIMIT 100`,
                type: 'select',
                category: 'read'
            },
            {
                id: 'simple_select',
                name: '🔍 Простой запрос',
                description: 'Проверить наличие данных',
                query: `SELECT * WHERE { ?s ?p ?o } LIMIT 10`,
                type: 'select',
                category: 'read'
            },
            {
                id: 'insert_example',
                name: '➕ INSERT пример',
                description: 'Добавить тестовые данные',
                query: `PREFIX f: <http://test.com/ontology#>
INSERT DATA {
  f:TestPerson a f:Person ;
    f:name "Тестовое Имя" .
}`,
                type: 'insert',
                category: 'write'
            },
            {
                id: 'clear_all',
                name: '🧹 Очистить все',
                description: 'Удалить все данные (осторожно!)',
                query: `CLEAR ALL`,
                type: 'clear',
                category: 'write'
            }
        ];

        res.json(templates);
    } catch (error) {
        console.error('Error in /templates:', error);
        res.status(500).json({
            error: 'Ошибка загрузки шаблонов',
            details: error.message
        });
    }
});

// Статус соединения
router.get('/status', async (req, res) => {
    try {
        const status = await graphdb.testConnection();

        const result = {
            status: status.connected ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString(),
            graphdb: status,
            server_endpoints: {
                universal: 'POST /api/sparql',
                query: 'POST /api/sparql/query',
                update: 'POST /api/sparql/update',
                export: 'POST /api/sparql/export'
            }
        };

        res.json(result);
    } catch (error) {
        console.error('Error checking connection:', error);
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message,
            details: 'Не удалось проверить подключение к GraphDB'
        });
    }
});

// Вспомогательные функции
function getContentType(format) {
    const typeMap = {
        'text/turtle': 'text/turtle',
        'application/rdf+xml': 'application/rdf+xml',
        'application/ld+json': 'application/ld+json',
        'application/json': 'application/json',
        'text/csv': 'text/csv',
        'text/tsv': 'text/tab-separated-values'
    };
    return typeMap[format] || 'text/plain';
}

function getExtension(format) {
    const extMap = {
        'text/turtle': 'ttl',
        'application/rdf+xml': 'rdf',
        'application/ld+json': 'jsonld',
        'application/n-triples': 'nt',
        'application/json': 'json',
        'text/csv': 'csv',
        'text/tsv': 'tsv'
    };
    return extMap[format] || 'txt';
}
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'sparql-api',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
module.exports = router;