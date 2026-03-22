const express = require('express');
const router = express.Router();
const graphdb = require('../utils/graphdb.client');

// Загрузка данных в GraphDB (для обратной совместимости)
router.post('/upload', async (req, res) => {
    const { data, format } = req.body;
    try {
        // Ожидаем: { data: string, format?: string, context?: string }
        const { data, format = 'text/turtle', context = 'http://test.com/ontology#' } = req.body;

        if (!data || typeof data !== 'string') {
            return res.status(400).json({ error: 'Данные для загрузки не предоставлены (поле data)' });
        }
        const result = await graphdb.uploadRDF(data, format, context);

        if (result.success) {
            res.json({
                success: true,
                message: 'Данные загружены в GraphDB',
                format,
                context,
                status: result.status
            });
        } else {
            res.status(result.status || 500).json({
                error: 'Ошибка загрузки данных в GraphDB',
                details: result.error
            });
        }
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера при загрузке данных',
            details: error.message
        });
    }
});

// Получить статистику (для обратной совместимости)
router.get('/statistics', async (req, res) => {
    try {
        const result = await graphdb.getStatistics();

        if (result.success) {
            res.json({
                success: true,
                data: result.data
            });
        } else {
            res.status(500).json({
                error: 'Ошибка получения статистики',
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

// Получить классы (для обратной совместимости)
router.get('/classes', async (req, res) => {
    try {
        const limit = req.query.limit || 100;
        const result = await graphdb.getClasses(limit);

        if (result.success) {
            res.json(result.data);
        } else {
            res.status(500).json({
                error: 'Ошибка получения классов',
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

// Получить свойства (для обратной совместимости)
router.get('/properties', async (req, res) => {
    try {
        const limit = req.query.limit || 100;
        const result = await graphdb.getProperties(limit);

        if (result.success) {
            res.json(result.data);
        } else {
            res.status(500).json({
                error: 'Ошибка получения свойств',
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

// Получить индивидов (для обратной совместимости)
router.get('/individuals', async (req, res) => {
    try {
        const limit = req.query.limit || 100;
        const result = await graphdb.getIndividuals(limit);

        if (result.success) {
            res.json(result.data);
        } else {
            res.status(500).json({
                error: 'Ошибка получения индивидов',
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

// Тестовый endpoint для Dashboard
router.get('/test', (req, res) => {
    res.json({
        message: 'Ontology endpoint работает',
        timestamp: new Date().toISOString(),
        endpoints: {
            upload: 'POST /api/ontology/upload',
            statistics: 'GET /api/ontology/statistics',
            classes: 'GET /api/ontology/classes?limit=100',
            properties: 'GET /api/ontology/properties?limit=100',
            individuals: 'GET /api/ontology/individuals?limit=100'
        }
    });
});

// Health check для ontology endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'ontology-api',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});


// Добавление новых триплетов напрямую в онтологию (GraphDB)
router.post('/triples', async (req, res) => {
    try {
        // Ожидаем: { triples: [{s,p,o, oType?, datatype?, lang?}], context?: string }
        const { triples, context = 'http://test.com/ontology#' } = req.body;

        if (!Array.isArray(triples) || triples.length === 0) {
            return res.status(400).json({ error: 'Не передан массив triples' });
        }

        const toTerm = (t) => {
            if (!t) throw new Error('Пустое значение терма');
            // Если это IRI в <>, оставляем как есть
            if (typeof t === 'string' && t.trim().startsWith('<') && t.trim().endsWith('>')) return t.trim();
            // Если это CURIE (prefix:name) — оставляем как есть
            if (typeof t === 'string' && /^[A-Za-z_][\w-]*:[\w.-]+$/.test(t.trim())) return t.trim();
            // Если это полный IRI без <>, оборачиваем
            if (typeof t === 'string' && /^https?:\/\//.test(t.trim())) return `<${t.trim()}>`;
            // Иначе считаем литералом
            const lit = String(t).replace(/"/g, '\"');
            return `"${lit}"`;
        };

        const toObject = (tr) => {
            const o = tr.o;
            const oType = (tr.oType || '').toLowerCase();
            if (oType === 'iri' || oType === 'uri') return toTerm(o);
            if (oType === 'literal' || !oType) {
                const lit = String(o).replace(/"/g, '\"');
                if (tr.lang) return `"${lit}"@${tr.lang}`;
                if (tr.datatype) {
                    const dt = tr.datatype.startsWith('http') ? `<${tr.datatype}>` : tr.datatype;
                    return `"${lit}"^^${dt}`;
                }
                return `"${lit}"`;
            }
            return toTerm(o);
        };

        // Собираем INSERT DATA
        const triplesTtl = triples.map(tr => `${toTerm(tr.s)} ${toTerm(tr.p)} ${toObject(tr)} .`).join('\n');

        const query = `
            INSERT DATA {
              GRAPH <${context}> {
                ${triplesTtl}
              }
            }
        `;

        const result = await graphdb.executeUpdate(query);

        if (result.success) {
            res.json({ success: true, message: 'Триплеты добавлены в GraphDB', inserted: triples.length });
        } else {
            res.status(result.status || 500).json({ error: 'Ошибка добавления триплетов', details: result.error });
        }
    } catch (error) {
        console.error('Triples insert error:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера при добавлении триплетов', details: error.message });
    }
});

module.exports = router;