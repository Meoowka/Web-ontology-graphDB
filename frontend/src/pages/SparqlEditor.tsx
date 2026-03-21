import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Paper,
    Typography,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Grid,
    Card,
    CardContent,
    Alert,
    CircularProgress,
    Tooltip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    Tab,
    Chip,
    AlertTitle,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Divider,
    List,
    Snackbar,
} from '@mui/material';
import {
    PlayArrow,
    Save,
    ContentCopy,
    History,
    Delete as DeleteIcon,
    Warning,
    Info,
    TableChart,
    Code,
    Download,
    Upload,
    Add,
    Remove,
} from '@mui/icons-material';
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import api from '../services/api';

interface Template {
    id: string;
    name: string;
    description: string;
    query: string;
    type?: string;
}

interface QueryResult {
    head?: {
        vars: string[];
    };
    results?: {
        bindings: Record<string, any>[];
    };
    boolean?: boolean;
    message?: string;
    error?: string;
    data?: string;
    // Для текстовых результатов (csv/turtle/plain)
    format?: string;
}

interface SparqlBinding {
    value: string;
    type?: string;
    datatype?: string;
    'xml:lang'?: string;
}

const AlertComponent = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
    props,
    ref,
) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const SparqlEditor: React.FC = () => {
    const [query, setQuery] = useState<string>('');
    const [results, setResults] = useState<QueryResult | null>(null);
    const [format, setFormat] = useState<string>('json');
    // Формат последнего успешного результата (учитывает принудительный turtle для CONSTRUCT/DESCRIBE)
    const [lastResultFormat, setLastResultFormat] = useState<string>('json');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');
    const [queryHistory, setQueryHistory] = useState<{query: string, timestamp: string, type: string}[]>([]);
    const [queryType, setQueryType] = useState<string>('select');
    const [activeTab, setActiveTab] = useState<number>(0);
    const [showRawResults, setShowRawResults] = useState<boolean>(false);
    const [confirmationDialog, setConfirmationDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        open: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'info' | 'warning';
    }>({
        open: false,
        message: '',
        severity: 'info'
    });
    const [availableEndpoints, setAvailableEndpoints] = useState<{url: string, type: string}[]>([
        { url: '/sparql', type: 'both' },
        { url: '/sparql/query', type: 'query' },
        { url: '/sparql/update', type: 'update' }
    ]);
    const [availableQueryEndpoints, setAvailableQueryEndpoints] = useState<string[]>(['/sparql']);
    const [availableUpdateEndpoints, setAvailableUpdateEndpoints] = useState<string[]>(['/sparql']);

    useEffect(() => {
        loadTemplates();
        loadHistory();
        testEndpoints();
    }, []);

    useEffect(() => {
        detectQueryType();
    }, [query]);

    const testEndpoints = async () => {
        const endpoints = [
            { url: '/sparql', type: 'both' },
            { url: '/sparql/query', type: 'query' },
            { url: '/sparql/update', type: 'update' },
            { url: '/api/sparql', type: 'both' },
            { url: '/query', type: 'query' },
            { url: '/update', type: 'update' },
        ];

        const workingQueryEndpoints: string[] = [];
        const workingUpdateEndpoints: string[] = [];

        for (const endpoint of endpoints) {
            try {
                // Тестируем SELECT запрос для query endpoints
                if (endpoint.type === 'query' || endpoint.type === 'both') {
                    const testQuery = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
                    const response = await api.post(endpoint.url, { query: testQuery });
                    if (response.status === 200) {
                        workingQueryEndpoints.push(endpoint.url);
                        console.log(`✅ Query endpoint доступен: ${endpoint.url}`);
                    }
                }

                // Тестируем ASK запрос для update endpoints (более безопасный)
                if (endpoint.type === 'update' || endpoint.type === 'both') {
                    const testQuery = 'ASK { ?s ?p ?o }';
                    try {
                        // Пробуем разные форматы для UPDATE endpoint
                        const formData = new URLSearchParams();
                        formData.append('query', testQuery);

                        const response = await api.post(endpoint.url, formData.toString(), {
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        });

                        if (response.status === 200) {
                            workingUpdateEndpoints.push(endpoint.url);
                            console.log(`✅ Update endpoint доступен: ${endpoint.url}`);
                        }
                    } catch (err) {
                        // @ts-ignore
                        console.log(`⚠️ Update endpoint ${endpoint.url} недоступен:`, err.message);
                    }
                }
            } catch (err: any) {
                console.log(`❌ Endpoint ${endpoint.url} недоступен:`, err.message);
            }
        }

        // Если не нашли endpoints, используем значения по умолчанию
        if (workingQueryEndpoints.length === 0) workingQueryEndpoints.push('/sparql');
        if (workingUpdateEndpoints.length === 0) workingUpdateEndpoints.push('/sparql');

        setAvailableQueryEndpoints(workingQueryEndpoints);
        setAvailableUpdateEndpoints(workingUpdateEndpoints);

        console.log('Доступные query endpoints:', workingQueryEndpoints);
        console.log('Доступные update endpoints:', workingUpdateEndpoints);
    };

    const detectQueryType = () => {
        const q = query.trim().toUpperCase();
        if (q.startsWith('SELECT')) setQueryType('select');
        else if (q.startsWith('INSERT')) setQueryType('insert');
        else if (q.startsWith('DELETE')) setQueryType('delete');
        else if (q.startsWith('UPDATE')) setQueryType('update');
        else if (q.startsWith('CONSTRUCT')) setQueryType('construct');
        else if (q.startsWith('DESCRIBE')) setQueryType('describe');
        else if (q.startsWith('ASK')) setQueryType('ask');
        else if (q.startsWith('CLEAR')) setQueryType('clear');
        else if (q.startsWith('DROP')) setQueryType('drop');
        else setQueryType('select');
    };

    const loadTemplates = async () => {
        try {
            const response = await api.get('/sparql/templates');
            const loadedTemplates = response.data || [];

            const templatesWithType = loadedTemplates.map((template: any) => ({
                id: template.id || `template-${Date.now()}`,
                name: template.name || 'Без названия',
                description: template.description || '',
                query: template.query || '',
                type: template.type || 'select'
            }));

            setTemplates(templatesWithType);
            if (templatesWithType.length > 0) {
                setSelectedTemplate(templatesWithType[0].id);
                setQuery(templatesWithType[0].query);
                setQueryType(templatesWithType[0].type);
            }
        } catch (err: any) {
            console.error('Error loading templates:', err);
            setTemplates(getDefaultTemplates());
            if (getDefaultTemplates().length > 0) {
                setSelectedTemplate(getDefaultTemplates()[0].id);
                setQuery(getDefaultTemplates()[0].query);
                setQueryType(getDefaultTemplates()[0].type || 'select');
            }
        }
    };

    const getDefaultTemplates = (): Template[] => {
        return [
            {
                id: 'all-classes',
                name: '📊 Все классы',
                description: 'Получить все классы OWL из онтологии',
                query: `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT ?class ?label
WHERE {
  ?class a owl:Class .
  OPTIONAL { ?class rdfs:label ?label }
}
ORDER BY ?class
LIMIT 50`,
                type: 'select'
            },
            {
                id: 'insert-partner-relation',
                name: '💑 INSERT: Добавить отношения партнеров',
                description: 'Добавить отношения has_partner между Леной и Павлом',
                query: `PREFIX f: <http://test.com/ontology#>

INSERT DATA {
  f:Lena f:has_partner f:Pavel .
  f:Pavel f:has_partner f:Lena .
}`,
                type: 'insert'
            },
            {
                id: 'delete-partner-relation',
                name: '🚫 DELETE: Удалить отношения партнеров',
                description: 'Удалить все отношения has_partner у Лены',
                query: `PREFIX f: <http://test.com/ontology#>

DELETE WHERE {
  f:Lena f:has_partner ?partner .
}`,
                type: 'delete'
            },
            {
                id: 'ask-has-children',
                name: '❓ ASK: Проверить наличие детей',
                description: 'Проверить, есть ли у кого-то дети',
                query: `PREFIX f: <http://test.com/ontology#>

ASK {
  ?person f:has_child ?child .
}`,
                type: 'ask'
            },
            {
                id: 'insert-new-person',
                name: '👤 INSERT: Добавить нового человека',
                description: 'Добавить нового человека в онтологию',
                query: `PREFIX f: <http://test.com/ontology#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

INSERT DATA {
  f:NewPerson rdf:type f:Person .
  f:NewPerson f:sex "male" .
  f:NewPerson rdfs:label "Новый человек" .
}`,
                type: 'insert'
            },
            {
                id: 'delete-specific-triple',
                name: '❌ DELETE: Удалить конкретный трипл',
                description: 'Удалить конкретное утверждение',
                query: `PREFIX f: <http://test.com/ontology#>

DELETE DATA {
  f:Pavel f:has_child f:Masha .
}`,
                type: 'delete'
            }
        ];
    };

    const loadHistory = () => {
        const saved = localStorage.getItem('sparql_history');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    const validHistory = parsed.filter((item: any) =>
                        item &&
                        typeof item.query === 'string' &&
                        typeof item.timestamp === 'string' &&
                        typeof item.type === 'string'
                    );
                    setQueryHistory(validHistory);
                }
            } catch (err) {
                console.error('Error loading history:', err);
                setQueryHistory([]);
            }
        }
    };

    const saveToHistory = (q: string, type: string) => {
        const historyItem = {
            query: q,
            timestamp: new Date().toLocaleString(),
            type: type
        };

        const newHistory = [
            historyItem,
            ...queryHistory.filter(h => h.query !== q)
        ].slice(0, 20);

        setQueryHistory(newHistory);
        localStorage.setItem('sparql_history', JSON.stringify(newHistory));
    };

    const executeQuery = async () => {
        if (!query.trim()) {
            setError('Введите SPARQL запрос');
            return;
        }

        const upperQuery = query.trim().toUpperCase();
        const isUpdateQuery = upperQuery.startsWith('INSERT') ||
            upperQuery.startsWith('DELETE') ||
            upperQuery.startsWith('UPDATE') ||
            upperQuery.startsWith('CLEAR') ||
            upperQuery.startsWith('DROP');

        if (isUpdateQuery) {
            setConfirmationDialog({
                open: true,
                title: 'Подтверждение операции',
                message: 'Вы собираетесь изменить данные в хранилище. Это действие может быть необратимым. Вы уверены?',
                onConfirm: () => executeQueryConfirmed(isUpdateQuery)
            });
            return;
        }

        executeQueryConfirmed(isUpdateQuery);
    };

    const executeUpdateQuery = async (endpointUrl: string): Promise<any> => {
        try {
            // Пробуем разные форматы для UPDATE запросов
            const formData = new URLSearchParams();
            formData.append('update', query);

            console.log('Отправка UPDATE запроса на:', endpointUrl);
            console.log('Запрос:', query);

            // Вариант 1: application/x-www-form-urlencoded (наиболее распространенный)
            try {
                const response = await api.post(endpointUrl, formData.toString(), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    timeout: 30000
                });
                console.log('UPDATE запрос успешен (вариант 1):', response.data);
                return response;
            } catch (err1: any) {
                console.log('Вариант 1 не сработал, пробуем вариант 2:', err1.message);

                // Вариант 2: application/sparql-update
                try {
                    const response = await api.post(endpointUrl, query, {
                        headers: {
                            'Content-Type': 'application/sparql-update',
                            'Accept': 'application/json'
                        },
                        timeout: 30000
                    });
                    console.log('UPDATE запрос успешен (вариант 2):', response.data);
                    return response;
                } catch (err2: any) {
                    console.log('Вариант 2 не сработал, пробуем вариант 3:', err2.message);

                    // Вариант 3: обычный JSON
                    const response = await api.post(endpointUrl, { query: query }, {
                        headers: {
                            'Accept': 'application/json'
                        },
                        timeout: 30000
                    });
                    console.log('UPDATE запрос успешен (вариант 3):', response.data);
                    return response;
                }
            }
        } catch (err: any) {
            console.error('Все методы UPDATE не сработали:', err);
            throw err;
        }
    };

    const executeSelectQuery = async (endpointUrl: string): Promise<{ response: any; usedFormat: string }> => {
        // Определяем реальный тип запроса (первое слово)
        const firstWord = query.trim().split(/\s+/)[0]?.toUpperCase() || 'SELECT';
        const isTurtle = firstWord === 'CONSTRUCT' || firstWord === 'DESCRIBE';

        // Turtle допустим только для CONSTRUCT/DESCRIBE.
        // Для SELECT/ASK форсим JSON, иначе GraphDB отвечает: "No acceptable file format found".
        let usedFormat = format;
        if (isTurtle) usedFormat = 'turtle';
        if (!isTurtle && usedFormat === 'turtle') usedFormat = 'json';

        const acceptHeader =
            usedFormat === 'turtle' ? 'text/turtle' :
                usedFormat === 'csv' ? 'text/csv' :
                    'application/sparql-results+json';

        const payload = { query, format: usedFormat };

        const response = await api.post(endpointUrl, payload, {
            headers: { 'Accept': acceptHeader },
            responseType: (usedFormat === 'turtle' || usedFormat === 'csv') ? 'text' : 'json',
            timeout: 30000
        });

        return { response, usedFormat };
    };

    const executeQueryConfirmed = async (isUpdateQuery: boolean) => {
        setLoading(true);
        setError('');
        setResults(null);

        try {
            let endpoint = '';
            let response;
            let effectiveFormat = format;

            if (isUpdateQuery) {
                // Для UPDATE запросов используем update endpoints
                endpoint = availableUpdateEndpoints[0];
                console.log('Выполнение UPDATE запроса на endpoint:', endpoint);
                response = await executeUpdateQuery(endpoint);
            } else {
                // Для SELECT запросов используем query endpoints
                endpoint = availableQueryEndpoints[0];
                console.log('Выполнение SELECT запроса на endpoint:', endpoint);
                const sel = await executeSelectQuery(endpoint);
                response = sel.response;
                effectiveFormat = sel.usedFormat;
            }

            // запоминаем фактический формат результата (важно, т.к. для CONSTRUCT/DESCRIBE он принудительно turtle)
            setLastResultFormat(effectiveFormat);

            console.log('Ответ от сервера:', response.data);
            console.log('Статус ответа:', response.status);

            if (isUpdateQuery) {
                // Обработка ответа для UPDATE операций
                setResults({
                    message: 'Операция выполнена успешно',
                    data: response.data?.message ||
                        response.data?.results?.message ||
                        'Данные успешно обновлены'
                });
            } else if (effectiveFormat === 'turtle') {
                // CONSTRUCT/DESCRIBE: GraphDB возвращает Turtle
                const turtleText = typeof response.data === 'string' ? response.data : String(response.data);

                // Сохраняем в состояние, чтобы выводить внизу и дать кнопку скачать
                setResults({ data: turtleText, format: 'turtle' });
                setSnackbar({
                    open: true,
                    message: 'Turtle результат получен. Он показан ниже. Нажмите "Скачать .ttl" — файл сохранится в папку Загрузки браузера.',
                    severity: 'info'
                });
            } else if (effectiveFormat === 'json') {
                if (typeof response.data === 'string') {
                    try {
                        const parsed = JSON.parse(response.data);
                        setResults(parsed);
                    } catch (e) {
                        setResults({ data: response.data });
                    }
                } else {
                    setResults(response.data);
                }
            } else {
                setResults({
                    data: typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)
                });
            }

            saveToHistory(query, queryType);

            // Если уже показали информационное сообщение для Turtle - не перетираем его "успехом".
            if (!(effectiveFormat === 'turtle' && !isUpdateQuery)) {
                setSnackbar({
                    open: true,
                    message: isUpdateQuery ? 'Данные успешно обновлены' : 'Запрос выполнен успешно',
                    severity: 'success'
                });
            }

        } catch (err: any) {
            console.error('Ошибка выполнения запроса:', err);

            let errorMessage = 'Ошибка выполнения запроса';

            if (err.response) {
                console.error('Статус ответа:', err.response.status);
                console.error('Заголовки ответа:', err.response.headers);
                console.error('Данные ответа:', err.response.data);

                if (err.response.status === 404) {
                    errorMessage = `Endpoint не найден. URL: ${err.config?.url}`;
                } else if (err.response.status === 405) {
                    errorMessage = 'Метод не разрешен (405). Проверьте настройки CORS на сервере.';
                } else if (err.response.status === 500) {
                    errorMessage = 'Внутренняя ошибка сервера (500). Проверьте SPARQL запрос на корректность.';
                } else if (err.response.data) {
                    if (typeof err.response.data === 'string') {
                        if (err.response.data.includes('<!DOCTYPE html>')) {
                            errorMessage = 'Сервер вернул HTML страницу с ошибкой. Проверьте endpoint URL.';
                        } else {
                            // Пробуем извлечь сообщение об ошибке из текста
                            const errorMatch = err.response.data.match(/error.*?:(.*?)(<br>|$)/i);
                            errorMessage = errorMatch ? errorMatch[1].trim() : err.response.data.substring(0, 200);
                        }
                    } else if (err.response.data.error) {
                        errorMessage = err.response.data.error;
                    } else if (err.response.data.message) {
                        errorMessage = err.response.data.message;
                    } else if (err.response.data.results?.error) {
                        errorMessage = err.response.data.results.error;
                    }
                }
            } else if (err.message) {
                errorMessage = err.message;
            } else if (err.code === 'ECONNABORTED') {
                errorMessage = 'Таймаут запроса. Сервер не отвечает.';
            } else if (err.request) {
                errorMessage = 'Не удалось подключиться к серверу. Проверьте сетевые настройки.';
            }

            setError(errorMessage);
            setSnackbar({
                open: true,
                message: errorMessage,
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleTemplateChange = (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (template) {
            setSelectedTemplate(templateId);
            setQuery(template.query);
            setQueryType(template.type || 'select');
        }
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(query);
            setSnackbar({
                open: true,
                message: 'Запрос скопирован в буфер обмена',
                severity: 'success'
            });
        } catch (err) {
            console.error('Failed to copy:', err);
            setSnackbar({
                open: true,
                message: 'Ошибка копирования',
                severity: 'error'
            });
        }
    };

    const loadFromHistory = (historicalQuery: {query: string, type: string}) => {
        setQuery(historicalQuery.query);
        setQueryType(historicalQuery.type);
        setActiveTab(0);
    };

    const getQueryTypeColor = (type: string) => {
        if (!type) return 'default';

        const lowerType = type.toLowerCase();
        switch (lowerType) {
            case 'select': return 'primary';
            case 'insert': return 'success';
            case 'delete': return 'error';
            case 'update': return 'warning';
            case 'construct': return 'info';
            case 'ask': return 'secondary';
            default: return 'default';
        }
    };

    const getQueryTypeIcon = (type: string) => {
        if (!type) return null;

        const lowerType = type.toLowerCase();
        switch (lowerType) {
            case 'select': return '📊';
            case 'insert': return '➕';
            case 'delete': return '🗑️';
            case 'update': return '🔄';
            case 'construct': return '🏗️';
            case 'ask': return '❓';
            default: return '📄';
        }
    };

    const renderResultsTable = () => {
        if (!results || !results.results || !results.results.bindings) return null;

        const variables = results.head?.vars || [];
        const bindings = results.results.bindings as Record<string, SparqlBinding>[];

        if (bindings.length === 0) {
            return (
                <Alert severity="info" sx={{ mt: 2 }}>
                    Запрос выполнен успешно, но не вернул результатов
                </Alert>
            );
        }

        return (
            <Box sx={{ mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                        Результаты ({bindings.length} записей)
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            size="small"
                            startIcon={<TableChart />}
                            onClick={() => setShowRawResults(false)}
                            variant={!showRawResults ? "contained" : "outlined"}
                        >
                            Таблица
                        </Button>
                        <Button
                            size="small"
                            startIcon={<Code />}
                            onClick={() => setShowRawResults(true)}
                            variant={showRawResults ? "contained" : "outlined"}
                        >
                            JSON
                        </Button>
                        <Button
                            size="small"
                            startIcon={<Download />}
                            onClick={() => exportResults()}
                        >
                            Экспорт
                        </Button>
                    </Box>
                </Box>

                {!showRawResults ? (
                    <TableContainer component={Paper} sx={{ maxHeight: 400, overflow: 'auto' }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    {variables.map((varName: string, index: number) => (
                                        <TableCell key={index} sx={{ fontWeight: 'bold', bgcolor: 'background.default' }}>
                                            {varName}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {bindings.map((row, rowIndex) => (
                                    <TableRow key={rowIndex} hover>
                                        {variables.map((varName: string, colIndex: number) => {
                                            const cell = row[varName] as SparqlBinding;
                                            const cellValue = cell?.value || '';

                                            return (
                                                <TableCell key={colIndex}>
                                                    <Tooltip title={cellValue}>
                                                        <span>{cellValue}</span>
                                                    </Tooltip>
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ) : (
                    <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                        <pre style={{ margin: 0, fontSize: '12px', fontFamily: 'monospace' }}>
                            {JSON.stringify(results, null, 2)}
                        </pre>
                    </Paper>
                )}
            </Box>
        );
    };

    const renderBooleanResult = () => {
        if (results?.boolean === undefined) return null;

        return (
            <Alert
                severity={results.boolean ? "success" : "info"}
                sx={{ mt: 2 }}
                icon={results.boolean ? <Info /> : <Warning />}
            >
                <AlertTitle>{results.boolean ? "True" : "False"}</AlertTitle>
                ASK запрос вернул: <strong>{results.boolean.toString()}</strong>
            </Alert>
        );
    };

    const renderMutationResult = () => {
        return (
            <Alert severity="success" sx={{ mt: 2 }}>
                <AlertTitle>Успешно</AlertTitle>
                {results?.message || 'Операция выполнена успешно'}
                {results?.data && (
                    <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', bgcolor: 'grey.50', p: 1, borderRadius: 1 }}>
                            {results.data}
                        </Typography>
                    </Box>
                )}
            </Alert>
        );
    };

    const renderTextResult = () => {
        if (!results?.data) return null;

        const effective = results.format || lastResultFormat || format;

        return (
            <Box sx={{ mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                        Результаты (формат: {String(effective).toUpperCase()})
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {effective === 'turtle' ? (
                            <Button
                                size="small"
                                startIcon={<Download />}
                                onClick={() => exportResults('turtle')}
                            >
                                Скачать .ttl
                            </Button>
                        ) : (
                            <Button
                                size="small"
                                startIcon={<Download />}
                                onClick={() => exportResults(effective)}
                            >
                                Экспорт
                            </Button>
                        )}
                    </Box>
                </Box>
                <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '12px', fontFamily: 'monospace' }}>
                        {results.data}
                    </pre>
                </Paper>
            </Box>
        );
    };

    const exportResults = (forcedFormat?: string) => {
        if (!results) return;
        const effective = forcedFormat || results.format || lastResultFormat || format;
        let dataStr = '';
        let mimeType = '';
        let extension = '';

        if (effective === 'json') {
            dataStr = JSON.stringify(results, null, 2);
            mimeType = 'application/json';
            extension = 'json';
        } else if (effective === 'csv') {
            dataStr = results.data || '';
            mimeType = 'text/csv';
            extension = 'csv';
        } else if (effective === 'turtle') {
            dataStr = results.data || '';
            mimeType = 'text/turtle';
            extension = 'ttl';
        } else {
            dataStr = results.data || '';
            mimeType = 'text/plain';
            extension = 'txt';
        }

        const dataUri = `data:${mimeType};charset=utf-8,${encodeURIComponent(dataStr)}`;
        const exportFileDefaultName = `sparql-results-${Date.now()}.${extension}`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const renderResults = () => {
        if (!results) return null;

        // ВАЖНО: фактический формат результата может отличаться от выбранного в UI.
        // Пример: пользователь выбрал Turtle, но выполняет SELECT/ASK -> мы форсим JSON,
        // иначе GraphDB отвечает "No acceptable file format found".
        const effective = lastResultFormat || format;

        if (results.error) {
            return (
                <Alert severity="error" sx={{ mt: 2 }}>
                    <AlertTitle>Ошибка</AlertTitle>
                    {results.error}
                </Alert>
            );
        }

        if (effective === 'json') {
            if (results.boolean !== undefined) {
                return renderBooleanResult();
            }

            if (['insert', 'delete', 'update', 'clear', 'drop'].includes(queryType.toLowerCase())) {
                return renderMutationResult();
            }

            if (results.results && results.results.bindings) {
                return renderResultsTable();
            }
        }

        return renderTextResult();
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                setQuery(content);
                detectQueryType();
                setSnackbar({
                    open: true,
                    message: 'Файл успешно загружен',
                    severity: 'success'
                });
            } catch (err) {
                setSnackbar({
                    open: true,
                    message: 'Ошибка чтения файла',
                    severity: 'error'
                });
            }
        };
        reader.readAsText(file);
    };

    const filterTemplatesByType = (type?: string) => {
        if (!type) return templates;
        return templates.filter(t => t.type === type);
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">
                    SPARQL Редактор
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip
                        label={queryType.toUpperCase()}
                        color={getQueryTypeColor(queryType) as any}
                        variant="outlined"
                        size="medium"
                    />
                    <Tooltip title={`Query endpoints: ${availableQueryEndpoints.join(', ')}\nUpdate endpoints: ${availableUpdateEndpoints.join(', ')}`}>
                        <Chip
                            label={`${availableQueryEndpoints.length + availableUpdateEndpoints.length} endpoints`}
                            color="info"
                            variant="outlined"
                            size="small"
                        />
                    </Tooltip>
                </Box>
            </Box>

            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                                <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                                    <Tab label="Редактор" />
                                    <Tab label="Шаблоны" />
                                    <Tab label="История" />
                                </Tabs>
                            </Box>

                            {activeTab === 0 && (
                                <>
                                    <Box sx={{ mb: 2 }}>
                                        <Alert severity="info">
                                            <AlertTitle>Доступные endpoints</AlertTitle>
                                            <Typography variant="body2">
                                                <strong>Query (SELECT/ASK):</strong> {availableQueryEndpoints.join(', ')}<br/>
                                                <strong>Update (INSERT/DELETE):</strong> {availableUpdateEndpoints.join(', ')}
                                            </Typography>
                                        </Alert>
                                    </Box>

                                    <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                                        <Grid item xs={12} md={4}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel>Шаблон запроса</InputLabel>
                                                <Select
                                                    value={selectedTemplate}
                                                    label="Шаблон запроса"
                                                    onChange={(e) => handleTemplateChange(e.target.value)}
                                                >
                                                    <MenuItem value="" disabled>
                                                        Выберите шаблон...
                                                    </MenuItem>
                                                    <Divider />
                                                    <Typography variant="caption" sx={{ px: 2, py: 1, color: 'text.secondary' }}>
                                                        📊 SELECT запросы
                                                    </Typography>
                                                    {filterTemplatesByType('select').map((template) => (
                                                        <MenuItem key={template.id} value={template.id}>
                                                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                                <Typography variant="body2">{template.name}</Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {template.description}
                                                                </Typography>
                                                            </Box>
                                                        </MenuItem>
                                                    ))}
                                                    <Divider />
                                                    <Typography variant="caption" sx={{ px: 2, py: 1, color: 'text.secondary' }}>
                                                        ➕ INSERT запросы
                                                    </Typography>
                                                    {filterTemplatesByType('insert').map((template) => (
                                                        <MenuItem key={template.id} value={template.id}>
                                                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                                <Typography variant="body2">{template.name}</Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {template.description}
                                                                </Typography>
                                                            </Box>
                                                        </MenuItem>
                                                    ))}
                                                    <Divider />
                                                    <Typography variant="caption" sx={{ px: 2, py: 1, color: 'text.secondary' }}>
                                                        🗑️ DELETE запросы
                                                    </Typography>
                                                    {filterTemplatesByType('delete').map((template) => (
                                                        <MenuItem key={template.id} value={template.id}>
                                                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                                <Typography variant="body2">{template.name}</Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {template.description}
                                                                </Typography>
                                                            </Box>
                                                        </MenuItem>
                                                    ))}
                                                    <Divider />
                                                    <Typography variant="caption" sx={{ px: 2, py: 1, color: 'text.secondary' }}>
                                                        ❓ ASK запросы
                                                    </Typography>
                                                    {filterTemplatesByType('ask').map((template) => (
                                                        <MenuItem key={template.id} value={template.id}>
                                                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                                <Typography variant="body2">{template.name}</Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {template.description}
                                                                </Typography>
                                                            </Box>
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel>Формат</InputLabel>
                                                <Select
                                                    value={format}
                                                    label="Формат"
                                                    onChange={(e) => setFormat(e.target.value)}
                                                >
                                                    <MenuItem value="json">JSON</MenuItem>
                                                    <MenuItem value="csv">CSV</MenuItem>
                                                    <MenuItem value="turtle">Turtle</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={12} md={5}>
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <Button
                                                    startIcon={<History />}
                                                    onClick={() => setActiveTab(2)}
                                                    variant="outlined"
                                                    sx={{ flexGrow: 1 }}
                                                >
                                                    История ({queryHistory.length})
                                                </Button>
                                                <input
                                                    accept=".sparql,.rq,.txt"
                                                    style={{ display: 'none' }}
                                                    id="upload-query-file"
                                                    type="file"
                                                    onChange={handleFileUpload}
                                                />
                                                <label htmlFor="upload-query-file">
                                                    <Button
                                                        component="span"
                                                        startIcon={<Upload />}
                                                        variant="outlined"
                                                    >
                                                        Загрузить
                                                    </Button>
                                                </label>
                                            </Box>
                                        </Grid>
                                    </Grid>

                                    <Box sx={{ mb: 2 }}>
                                        <TextField
                                            multiline
                                            rows={12}
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder={`Введите SPARQL запрос...

Примеры запросов:

=== SELECT (чтение данных) ===
SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10

=== INSERT (добавление данных) ===
PREFIX f: <http://test.com/ontology#>
INSERT DATA { 
  f:Lena f:has_partner f:Pavel .
  f:Pavel f:has_partner f:Lena .
}

=== DELETE (удаление данных) ===
PREFIX f: <http://test.com/ontology#>
DELETE WHERE { 
  f:Lena f:has_partner ?partner .
}

=== ASK (логическая проверка) ===
ASK { ?s ?p ?o }`}
                                            fullWidth
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    fontFamily: 'monospace',
                                                    fontSize: '14px',
                                                }
                                            }}
                                        />
                                    </Box>

                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        <Button
                                            variant="contained"
                                            startIcon={<PlayArrow />}
                                            onClick={executeQuery}
                                            disabled={loading || !query.trim()}
                                            sx={{ minWidth: 140 }}
                                        >
                                            {loading ? <CircularProgress size={24} /> : 'Выполнить'}
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            startIcon={<ContentCopy />}
                                            onClick={copyToClipboard}
                                            disabled={!query.trim()}
                                        >
                                            Копировать
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            startIcon={<Save />}
                                            onClick={() => {
                                                if (query.trim()) {
                                                    saveToHistory(query, queryType);
                                                    setSnackbar({
                                                        open: true,
                                                        message: 'Запрос сохранён в историю',
                                                        severity: 'success'
                                                    });
                                                }
                                            }}
                                            disabled={!query.trim()}
                                        >
                                            Сохранить
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            startIcon={<DeleteIcon />}
                                            onClick={() => setQuery('')}
                                        >
                                            Очистить
                                        </Button>
                                    </Box>

                                    {error && (
                                        <Alert severity="error" sx={{ mt: 2 }}>
                                            <AlertTitle>Ошибка</AlertTitle>
                                            {error}
                                        </Alert>
                                    )}

                                    <Alert severity="info" sx={{ mt: 2 }}>
                                        <AlertTitle>Информация о запросах</AlertTitle>
                                        <Typography variant="body2">
                                            • <strong>SELECT</strong> - чтение данных (использует Query endpoint)<br/>
                                            • <strong>INSERT/DELETE</strong> - изменение данных (использует Update endpoint)<br/>
                                            • <strong>ASK</strong> - логическая проверка (использует Query endpoint)<br/>
                                            • Проверьте консоль браузера для детальной отладки
                                        </Typography>
                                    </Alert>
                                </>
                            )}

                            {activeTab === 1 && (
                                <Box>
                                    <Box sx={{ mb: 3 }}>
                                        <Typography variant="h6" gutterBottom>
                                            Доступные шаблоны запросов
                                        </Typography>
                                        <Alert severity="info">
                                            Выберите шаблон для автоматического заполнения редактора
                                        </Alert>
                                    </Box>

                                    <Box sx={{ mb: 3 }}>
                                        <Typography variant="subtitle1" gutterBottom color="primary">
                                            📊 SELECT запросы (чтение данных)
                                        </Typography>
                                        <Grid container spacing={2}>
                                            {filterTemplatesByType('select').map((template) => (
                                                <Grid item xs={12} md={6} key={template.id}>
                                                    <Paper
                                                        sx={{
                                                            p: 2,
                                                            cursor: 'pointer',
                                                            border: selectedTemplate === template.id ? 2 : 1,
                                                            borderColor: selectedTemplate === template.id ? 'primary.main' : 'divider',
                                                            '&:hover': { bgcolor: 'action.hover' }
                                                        }}
                                                        onClick={() => handleTemplateChange(template.id)}
                                                    >
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <Box>
                                                                <Typography variant="subtitle1" gutterBottom>
                                                                    {template.name}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary" paragraph>
                                                                    {template.description}
                                                                </Typography>
                                                            </Box>
                                                            <Chip
                                                                label={(template.type || 'select').toUpperCase()}
                                                                color={getQueryTypeColor(template.type || 'select') as any}
                                                                size="small"
                                                            />
                                                        </Box>
                                                        <Divider sx={{ my: 1 }} />
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                fontFamily: 'monospace',
                                                                display: 'block',
                                                                whiteSpace: 'pre-wrap',
                                                                wordBreak: 'break-all',
                                                                fontSize: '0.75rem',
                                                                color: 'text.secondary'
                                                            }}
                                                        >
                                                            {template.query.substring(0, 150)}...
                                                        </Typography>
                                                    </Paper>
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </Box>

                                    <Box sx={{ mb: 3 }}>
                                        <Typography variant="subtitle1" gutterBottom color="success.main">
                                            ➕ INSERT запросы (добавление данных)
                                        </Typography>
                                        <Grid container spacing={2}>
                                            {filterTemplatesByType('insert').map((template) => (
                                                <Grid item xs={12} md={6} key={template.id}>
                                                    <Paper
                                                        sx={{
                                                            p: 2,
                                                            cursor: 'pointer',
                                                            border: selectedTemplate === template.id ? 2 : 1,
                                                            borderColor: selectedTemplate === template.id ? 'success.main' : 'divider',
                                                            '&:hover': { bgcolor: 'action.hover' }
                                                        }}
                                                        onClick={() => handleTemplateChange(template.id)}
                                                    >
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <Box>
                                                                <Typography variant="subtitle1" gutterBottom>
                                                                    {template.name}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary" paragraph>
                                                                    {template.description}
                                                                </Typography>
                                                            </Box>
                                                            <Chip
                                                                label={(template.type || 'insert').toUpperCase()}
                                                                color={getQueryTypeColor(template.type || 'insert') as any}
                                                                size="small"
                                                            />
                                                        </Box>
                                                        <Divider sx={{ my: 1 }} />
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                fontFamily: 'monospace',
                                                                display: 'block',
                                                                whiteSpace: 'pre-wrap',
                                                                wordBreak: 'break-all',
                                                                fontSize: '0.75rem',
                                                                color: 'text.secondary'
                                                            }}
                                                        >
                                                            {template.query.substring(0, 150)}...
                                                        </Typography>
                                                    </Paper>
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </Box>

                                    <Box sx={{ mb: 3 }}>
                                        <Typography variant="subtitle1" gutterBottom color="error.main">
                                            🗑️ DELETE запросы (удаление данных)
                                        </Typography>
                                        <Grid container spacing={2}>
                                            {filterTemplatesByType('delete').map((template) => (
                                                <Grid item xs={12} md={6} key={template.id}>
                                                    <Paper
                                                        sx={{
                                                            p: 2,
                                                            cursor: 'pointer',
                                                            border: selectedTemplate === template.id ? 2 : 1,
                                                            borderColor: selectedTemplate === template.id ? 'error.main' : 'divider',
                                                            '&:hover': { bgcolor: 'action.hover' }
                                                        }}
                                                        onClick={() => handleTemplateChange(template.id)}
                                                    >
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <Box>
                                                                <Typography variant="subtitle1" gutterBottom>
                                                                    {template.name}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary" paragraph>
                                                                    {template.description}
                                                                </Typography>
                                                            </Box>
                                                            <Chip
                                                                label={(template.type || 'delete').toUpperCase()}
                                                                color={getQueryTypeColor(template.type || 'delete') as any}
                                                                size="small"
                                                            />
                                                        </Box>
                                                        <Divider sx={{ my: 1 }} />
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                fontFamily: 'monospace',
                                                                display: 'block',
                                                                whiteSpace: 'pre-wrap',
                                                                wordBreak: 'break-all',
                                                                fontSize: '0.75rem',
                                                                color: 'text.secondary'
                                                            }}
                                                        >
                                                            {template.query.substring(0, 150)}...
                                                        </Typography>
                                                    </Paper>
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </Box>

                                    <Box>
                                        <Typography variant="subtitle1" gutterBottom color="secondary.main">
                                            ❓ ASK запросы (логические проверки)
                                        </Typography>
                                        <Grid container spacing={2}>
                                            {filterTemplatesByType('ask').map((template) => (
                                                <Grid item xs={12} md={6} key={template.id}>
                                                    <Paper
                                                        sx={{
                                                            p: 2,
                                                            cursor: 'pointer',
                                                            border: selectedTemplate === template.id ? 2 : 1,
                                                            borderColor: selectedTemplate === template.id ? 'secondary.main' : 'divider',
                                                            '&:hover': { bgcolor: 'action.hover' }
                                                        }}
                                                        onClick={() => handleTemplateChange(template.id)}
                                                    >
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <Box>
                                                                <Typography variant="subtitle1" gutterBottom>
                                                                    {template.name}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary" paragraph>
                                                                    {template.description}
                                                                </Typography>
                                                            </Box>
                                                            <Chip
                                                                label={(template.type || 'ask').toUpperCase()}
                                                                color={getQueryTypeColor(template.type || 'ask') as any}
                                                                size="small"
                                                            />
                                                        </Box>
                                                        <Divider sx={{ my: 1 }} />
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                fontFamily: 'monospace',
                                                                display: 'block',
                                                                whiteSpace: 'pre-wrap',
                                                                wordBreak: 'break-all',
                                                                fontSize: '0.75rem',
                                                                color: 'text.secondary'
                                                            }}
                                                        >
                                                            {template.query}
                                                        </Typography>
                                                    </Paper>
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </Box>
                                </Box>
                            )}

                            {activeTab === 2 && (
                                <Box>
                                    {queryHistory.length === 0 ? (
                                        <Alert severity="info">
                                            История запросов пуста
                                        </Alert>
                                    ) : (
                                        <List disablePadding>
                                            {queryHistory.map((item, index) => (
                                                <Paper
                                                    key={index}
                                                    sx={{
                                                        p: 2,
                                                        mb: 1,
                                                        cursor: 'pointer',
                                                        '&:hover': { bgcolor: 'action.hover' }
                                                    }}
                                                    onClick={() => loadFromHistory(item)}
                                                >
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                        <Chip
                                                            label={item.type.toUpperCase()}
                                                            color={getQueryTypeColor(item.type) as any}
                                                            size="small"
                                                        />
                                                        <Typography variant="caption" color="text.secondary">
                                                            {item.timestamp}
                                                        </Typography>
                                                    </Box>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontFamily: 'monospace',
                                                            whiteSpace: 'pre-wrap',
                                                            wordBreak: 'break-all',
                                                            fontSize: '0.8rem'
                                                        }}
                                                    >
                                                        {item.query.length > 300 ? item.query.substring(0, 300) + '...' : item.query}
                                                    </Typography>
                                                </Paper>
                                            ))}
                                        </List>
                                    )}
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12}>
                    {renderResults()}
                </Grid>
            </Grid>

            {/* Диалог подтверждения */}
            <Dialog
                open={confirmationDialog.open}
                onClose={() => setConfirmationDialog(prev => ({ ...prev, open: false }))}
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Warning color="warning" />
                        {confirmationDialog.title}
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Typography>{confirmationDialog.message}</Typography>
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        Внимание: Эта операция изменит данные в базе знаний.
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmationDialog(prev => ({ ...prev, open: false }))}>
                        Отмена
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => {
                            confirmationDialog.onConfirm();
                            setConfirmationDialog(prev => ({ ...prev, open: false }));
                        }}
                    >
                        Подтвердить
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar для уведомлений */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <AlertComponent
                    onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </AlertComponent>
            </Snackbar>
        </Box>
    );
};

export default SparqlEditor;