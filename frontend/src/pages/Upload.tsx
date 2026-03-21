import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    TextField,
    Button,
    Alert,
    CircularProgress,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Paper,
    Divider,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    Tab,
    Tooltip,
    LinearProgress,
    Snackbar,
} from '@mui/material';
import {
    CloudUpload,
    Delete,
    Description,
    CheckCircle,
    Error,
    Download,
    CloudDownload,
    Storage,
    Timeline,
    DataArray,
    Refresh,
    Warning,
    Info,
    Close, Category, Link, Person,
} from '@mui/icons-material';
import api from '../services/api';

interface RecentUpload {
    id: number;
    name: string;
    format: string;
    size: number;
    timestamp: string;
    success: boolean;
}

interface Statistics {
    totalTriples: number;
    totalClasses: number;
    totalProperties: number;
    totalIndividuals: number;
    timestamp: string;
}

interface ExportProgress {
    exporting: boolean;
    progress: number;
    message: string;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div hidden={value !== index} {...other}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

const Upload: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [format, setFormat] = useState('text/turtle');
    const [dataInput, setDataInput] = useState('');
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([
        {
            id: 1,
            name: 'Пример онтологии',
            format: 'text/turtle',
            size: 1024,
            timestamp: new Date().toLocaleString(),
            success: true
        }
    ]);

    const [activeTab, setActiveTab] = useState(0);
    const [statistics, setStatistics] = useState<Statistics | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [exportDialog, setExportDialog] = useState(false);
    // Важно: application/json в нашем экспорте — это SPARQL results JSON (таблица SELECT),
    // его нельзя импортировать обратно в GraphDB как RDF.
    // Для реального "JSON" экспорта используем JSON-LD.
    const [exportFormat, setExportFormat] = useState('application/ld+json');
    const [exportProgress, setExportProgress] = useState<ExportProgress>({
        exporting: false,
        progress: 0,
        message: ''
    });
    const [snackbarOpen, setSnackbarOpen] = useState(false);

    // Загружаем статистику при монтировании компонента
    useEffect(() => {
        loadStatistics();
    }, []);

    const loadStatistics = async () => {
        setLoadingStats(true);
        try {
            // Единый источник истины (как в Dashboard): /api/ontology/statistics
            const response = await api.get('/ontology/statistics');
            const root = response.data;
            const payload = root?.data ?? root;


            const hasNormalized =
                payload &&
                typeof payload === 'object' &&
                ('triples' in payload || 'classes' in payload || 'properties' in payload || 'individuals' in payload);

            if (hasNormalized) {
                setStatistics({
                    totalTriples: Number(payload.triples) || 0,
                    totalClasses: Number(payload.classes) || 0,
                    totalProperties: Number(payload.properties) || 0,
                    totalIndividuals: Number(payload.individuals) || 0,
                    timestamp: new Date().toISOString(),
                });
                return;
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
            setStatistics({
                totalTriples: 0,
                totalClasses: 0,
                totalProperties: 0,
                totalIndividuals: 0,
                timestamp: new Date().toISOString(),
            });
        } finally {
            setLoadingStats(false);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const selectedFile = event.target.files[0];
            setFile(selectedFile);

            // Автоматическое определение формата по расширению
            const ext = selectedFile.name.split('.').pop()?.toLowerCase();
            if (ext === 'ttl') setFormat('text/turtle');
            else if (ext === 'rdf' || ext === 'xml') setFormat('application/rdf+xml');
            else if (ext === 'jsonld') setFormat('application/ld+json');
            else if (ext === 'nt') setFormat('application/n-triples');
        }
    };

    const handleUpload = async () => {
        let dataToUpload = dataInput;

        if (file) {
            try {
                const fileContent = await file.text();
                dataToUpload = fileContent;
            } catch (error) {
                showMessage('error', 'Ошибка чтения файла');
                return;
            }
        }

        if (!dataToUpload.trim()) {
            showMessage('error', 'Введите данные или выберите файл');
            return;
        }

        setUploading(true);
        setMessage(null);

        try {

            await api.post('/ontology/upload', {
                data: dataToUpload,
                format,
                context: 'http://test.com/ontology#'
            });

            const newUpload: RecentUpload = {
                id: Date.now(),
                name: file ? file.name : 'Введённые данные',
                format,
                size: dataToUpload.length,
                timestamp: new Date().toLocaleString(),
                success: true
            };

            setRecentUploads([newUpload, ...recentUploads.slice(0, 4)]);

            // Обновляем статистику после загрузки
            await loadStatistics();

            showMessage('success', '✅ Данные успешно загружены в GraphDB!');

            setFile(null);
            setDataInput('');

        } catch (error: any) {
            const newUpload: RecentUpload = {
                id: Date.now(),
                name: file ? file.name : 'Введённые данные',
                format,
                size: dataToUpload.length,
                timestamp: new Date().toLocaleString(),
                success: false
            };

            setRecentUploads([newUpload, ...recentUploads.slice(0, 4)]);

            const errorMsg = error.response?.data?.error ||
                error.response?.data?.details ||
                error.message ||
                'Не удалось загрузить данные';
            showMessage('error', `❌ Ошибка: ${errorMsg}`);
        } finally {
            setUploading(false);
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setSnackbarOpen(true);
    };

    const handleExport = async () => {
        setExportProgress({
            exporting: true,
            progress: 10,
            message: 'Подготовка данных...'
        });
        const isRdfExport = exportFormat === 'text/turtle' || exportFormat === 'application/ld+json';
        try {
            if (isRdfExport) {
                setExportProgress({ exporting: true, progress: 40, message: 'Запрос к GraphDB...' });

                const res = await api.post(
                    '/sparql/export',
                    { format: exportFormat },
                    { responseType: 'blob', timeout: 60000 }
                );

                const ext = exportFormat === 'text/turtle' ? 'ttl' : 'json'; // или jsonld
                const fileName = `ontology-export-${new Date().toISOString().split('T')[0]}.${ext}`;

                const blob = new Blob([res.data], { type: exportFormat });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                setExportProgress({ exporting: true, progress: 100, message: 'Экспорт завершен!' });
                setTimeout(() => {
                    setExportDialog(false);
                    setExportProgress({ exporting: false, progress: 0, message: '' });
                    showMessage('success', `✅ Экспортировано: ${fileName}`);
                }, 400);

                return; // ✅ ВАЖНО: чтобы не шёл старый код сборки TTL/JSON
            }

        } catch (error: any) {
            console.error('Export error:', error);
            setExportProgress({
                exporting: false,
                progress: 0,
                message: ''
            });




            const errorMsg = error.response?.data?.error ||
                error.response?.data?.details ||
                error.message ||
                'Неизвестная ошибка экспорта';
            showMessage('error', `❌ Ошибка экспорта: ${errorMsg}`);

            // Чтобы диалог не зависал, закрываем его при ошибке
            setExportDialog(false);
        }
    };

    const formatUri = (uri: string): string => {
        if (uri.startsWith('http://test.com/ontology#')) {
            return `f:${uri.split('#')[1]}`;
        }
        if (uri.startsWith('http://www.w3.org')) {
            const parts = uri.split('/');
            const last = parts[parts.length - 1];
            if (last.includes('#')) {
                return `${last.split('#')[0]}:${last.split('#')[1]}`;
            }
            return `<${uri}>`;
        }
        return `<${uri}>`;
    };

    const escapeString = (str: string): string => {
        return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    };

    const getMimeType = (format: string) => {
        const formatMap: Record<string, string> = {
            'text/turtle': 'text/turtle',
            'application/rdf+xml': 'application/rdf+xml',
            'application/ld+json': 'application/ld+json',
            'application/n-triples': 'application/n-triples',
            'text/csv': 'text/csv',
            'application/json': 'application/json'
        };
        return formatMap[format] || 'text/plain';
    };

    const getFileExtension = (format: string) => {
        const extensionMap: Record<string, string> = {
            'text/turtle': 'ttl',
            'application/rdf+xml': 'rdf',
            'application/ld+json': 'jsonld',
            'application/n-triples': 'nt',
            'text/csv': 'csv',
            'application/json': 'json'
        };
        return extensionMap[format] || 'txt';
    };

    const handleClear = () => {
        setFile(null);
        setDataInput('');
        setMessage(null);
    };

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    const formatOptions = [
        { value: 'text/turtle', label: 'Turtle (.ttl)', description: 'Читаемый RDF формат' },
        { value: 'application/rdf+xml', label: 'RDF/XML (.rdf)', description: 'Стандартный XML формат' },
        { value: 'application/ld+json', label: 'JSON-LD (.jsonld)', description: 'JSON с контекстом' },
        { value: 'application/n-triples', label: 'N-Triples (.nt)', description: 'Простой текстовый формат' },
    ];

    const exportOptions = [
        // JSON-LD — RDF сериализация, которую можно импортировать обратно в GraphDB
        { value: 'application/ld+json', label: 'JSON-LD (.jsonld)', icon: <Description /> },
        // CSV — только для просмотра/Excel, обратно как RDF не импортируется
        { value: 'text/csv', label: 'CSV (.csv)', icon: <DataArray /> },
        // TTL — RDF сериализация, можно импортировать обратно
        { value: 'text/turtle', label: 'Turtle (.ttl)', icon: <Storage /> },
    ];

    const exampleData = `@prefix f: <http://test.com/ontology#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

f:Person a owl:Class ;
    rdfs:label "Человек"@ru .

f:Man a owl:Class ;
    rdfs:subClassOf f:Person ;
    rdfs:label "Мужчина"@ru .

f:Woman a owl:Class ;
    rdfs:subClassOf f:Person ;
    rdfs:label "Женщина"@ru .

f:hasName a owl:DatatypeProperty ;
    rdfs:domain f:Person ;
    rdfs:label "имеет имя"@ru .

f:hasChild a owl:ObjectProperty ;
    rdfs:domain f:Person ;
    rdfs:range f:Person ;
    rdfs:label "имеет ребенка"@ru .

f:Pavel a f:Man ;
    f:hasName "Павел" ;
    rdfs:label "Павел"@ru .

f:Lena a f:Woman ;
    f:hasName "Лена" ;
    rdfs:label "Лена"@ru .

f:Pavel f:hasChild f:Lena .
f:Lena f:hasChild f:Pavel .`;

    const clearGraphDB = async () => {
        if (!window.confirm('ВНИМАНИЕ: Вы собираетесь удалить ВСЕ данные из GraphDB. Это действие необратимо. Продолжить?')) {
            return;
        }

        try {
            const response = await api.post('/sparql', { query: 'CLEAR ALL' });
            const okHttp = response.status >= 200;

            if (okHttp ) {
                showMessage('success', '✅ Все данные успешно удалены из GraphDB');
                await loadStatistics();
            } else {
                const msg = response.data?.error || response.data?.details || 'GraphDB вернул пустой/неожиданный ответ';
                showMessage('error', `❌ Ошибка очистки: ${msg}`);
            }
        } catch (error: any) {
            if (error?.response?.status === 204) {
                showMessage('success', '✅ Все данные успешно удалены из GraphDB');
                await loadStatistics();
                return;
            }

            const errorMsg =
                error.response?.data?.error ||
                error.response?.data?.details ||
                error.message ||
                'Неизвестная ошибка';

            showMessage('error', `❌ Ошибка очистки: ${errorMsg}`);
        }
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('ru-RU').format(num);
    };

    const handleSnackbarClose = () => {
        setSnackbarOpen(false);
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Управление данными GraphDB
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<CloudDownload />}
                        onClick={() => setExportDialog(true)}
                        disabled={loadingStats}
                    >
                        Экспорт данных
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={loadStatistics}
                        disabled={loadingStats}
                    >
                        {loadingStats ? <CircularProgress size={20} /> : 'Обновить статистику'}
                    </Button>
                </Box>
            </Box>

            {/* Статистика */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Storage color="primary" sx={{ fontSize: 40 }} />
                            <Box>
                                <Typography variant="h4">
                                    {statistics ? formatNumber(statistics.totalTriples) : '0'}
                                </Typography>
                                    <Typography variant="body2" color="text.secondary">Всего триплетов</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Category color="secondary" sx={{ fontSize: 40 }} />
                            <Box>
                                <Typography variant="h4">
                                    {statistics ? formatNumber(statistics.totalClasses) : '0'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">Классов</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Link color="success" sx={{ fontSize: 40 }} />
                            <Box>
                                <Typography variant="h4">
                                    {statistics ? formatNumber(statistics.totalProperties) : '0'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">Свойств</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Person color="warning" sx={{ fontSize: 40 }} />
                            <Box>
                                <Typography variant="h4">
                                    {statistics ? formatNumber(statistics.totalIndividuals) : '0'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">Индивидов</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Вкладки */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={activeTab} onChange={handleTabChange}>
                            <Tab label="Загрузка данных" icon={<CloudUpload />} iconPosition="start" />
                            <Tab label="Управление GraphDB" icon={<Storage />} iconPosition="start" />
                        </Tabs>
                    </Box>

                    {/* Вкладка загрузки данных */}
                    <TabPanel value={activeTab} index={0}>
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={8}>
                                <FormControl fullWidth sx={{ mb: 2 }}>
                                    <InputLabel>Формат данных</InputLabel>
                                    <Select
                                        value={format}
                                        label="Формат данных"
                                        onChange={(e) => setFormat(e.target.value)}
                                    >
                                        {formatOptions.map((option) => (
                                            <MenuItem key={option.value} value={option.value}>
                                                {option.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <Box sx={{ mb: 3 }}>
                                    <Button
                                        variant="outlined"
                                        component="label"
                                        startIcon={<CloudUpload />}
                                        fullWidth
                                        sx={{ mb: 1 }}
                                    >
                                        Выбрать файл
                                        <input
                                            type="file"
                                            hidden
                                            onChange={handleFileChange}
                                            accept=".ttl,.rdf,.xml,.jsonld,.nt,.n3,.txt"
                                        />
                                    </Button>
                                    {file && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                                            <Description color="action" />
                                            <Typography variant="body2">
                                                {file.name} ({(file.size / 1024).toFixed(2)} KB)
                                            </Typography>
                                            <IconButton size="small" onClick={() => setFile(null)}>
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    )}
                                </Box>

                                <Divider sx={{ my: 2 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        ИЛИ введите данные вручную
                                    </Typography>
                                </Divider>

                                <Box sx={{ mb: 2 }}>
                                    <TextField
                                        label="RDF данные"
                                        multiline
                                        rows={8}
                                        value={dataInput}
                                        onChange={(e) => setDataInput(e.target.value)}
                                        fullWidth
                                        placeholder={exampleData}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                fontFamily: 'monospace',
                                                fontSize: '14px',
                                            }
                                        }}
                                    />
                                    <Button
                                        size="small"
                                        onClick={() => setDataInput(exampleData)}
                                        sx={{ mt: 1 }}
                                    >
                                        Загрузить пример
                                    </Button>
                                </Box>

                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Button
                                        variant="contained"
                                        startIcon={uploading ? <CircularProgress size={20} /> : <CloudUpload />}
                                        onClick={handleUpload}
                                        disabled={uploading || (!dataInput.trim() && !file)}
                                        sx={{ flexGrow: 1 }}
                                    >
                                        {uploading ? 'Загрузка...' : 'Загрузить в GraphDB'}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={handleClear}
                                        disabled={uploading}
                                    >
                                        Очистить
                                    </Button>
                                </Box>
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <Typography variant="h6" gutterBottom>
                                    Последние загрузки
                                </Typography>

                                {recentUploads.length === 0 ? (
                                    <Typography color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
                                        Нет загрузок
                                    </Typography>
                                ) : (
                                    <List dense>
                                        {recentUploads.map((upload) => (
                                            <ListItem
                                                key={upload.id}
                                                divider
                                                secondaryAction={
                                                    <Chip
                                                        icon={upload.success ? <CheckCircle /> : <Error />}
                                                        label={upload.success ? 'Успешно' : 'Ошибка'}
                                                        size="small"
                                                        color={upload.success ? 'success' : 'error'}
                                                        variant="outlined"
                                                    />
                                                }
                                            >
                                                <ListItemText
                                                    primary={upload.name}
                                                    secondary={
                                                        <>
                                                            <Typography variant="caption" display="block">
                                                                Формат: {upload.format.split('/').pop()}
                                                            </Typography>
                                                            <Typography variant="caption" display="block">
                                                                Размер: {(upload.size / 1024).toFixed(2)} KB
                                                            </Typography>
                                                            <Typography variant="caption">
                                                                {upload.timestamp}
                                                            </Typography>
                                                        </>
                                                    }
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                )}

                                <Divider sx={{ my: 2 }} />

                                <Typography variant="subtitle2" gutterBottom>
                                    Поддерживаемые форматы:
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    {formatOptions.map((format) => (
                                        <Box key={format.value} sx={{ display: 'flex', alignItems: 'center' }}>
                                            <Chip
                                                label={format.label.split(' ')[0]}
                                                size="small"
                                                variant="outlined"
                                                sx={{ mr: 1 }}
                                            />
                                            <Typography variant="caption">{format.description}</Typography>
                                        </Box>
                                    ))}
                                </Box>
                            </Grid>
                        </Grid>
                    </TabPanel>

                    {/* Вкладка управления */}
                    <TabPanel value={activeTab} index={1}>
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>
                                            Экспорт данных
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" paragraph>
                                            Скачайте данные из GraphDB в различных форматах для резервного копирования или анализа.
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 2 }}>
                                            <FormControl fullWidth>
                                                <InputLabel>Формат экспорта</InputLabel>
                                                <Select
                                                    value={exportFormat}
                                                    label="Формат экспорта"
                                                    onChange={(e) => setExportFormat(e.target.value)}
                                                >
                                                    {exportOptions.map((option) => (
                                                        <MenuItem key={option.value} value={option.value}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                {option.icon}
                                                                {option.label}
                                                            </Box>
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                            <Button
                                                variant="contained"
                                                startIcon={<Download />}
                                                onClick={() => setExportDialog(true)}
                                            >
                                                Экспорт
                                            </Button>
                                        </Box>
                                        <Alert severity="info" sx={{ mt: 2 }}>
                                            Экспортируется до 1000 триплетов. Для полного экспорта используйте несколько запросов.
                                        </Alert>
                                    </CardContent>
                                </Card>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>
                                            Очистка данных
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" paragraph>
                                            Удаление всех данных из GraphDB. Будьте осторожны - это действие необратимо.
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 2 }}>
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                startIcon={<Delete />}
                                                onClick={clearGraphDB}
                                                fullWidth
                                            >
                                                Очистить GraphDB
                                            </Button>
                                        </Box>
                                        <Alert severity="warning" sx={{ mt: 2 }}>
                                            <Typography fontWeight="bold">Внимание!</Typography>
                                            Это действие удалит ВСЕ данные из хранилища. Создайте резервную копию перед очисткой.
                                        </Alert>
                                    </CardContent>
                                </Card>
                            </Grid>

                            <Grid item xs={12}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>
                                            Статистика GraphDB
                                        </Typography>
                                        {loadingStats ? (
                                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                                                <CircularProgress />
                                            </Box>
                                        ) : statistics ? (
                                            <TableContainer>
                                                <Table size="small">
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell>Показатель</TableCell>
                                                            <TableCell align="right">Значение</TableCell>
                                                            <TableCell>Описание</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        <TableRow>
                                                            <TableCell>Всего триплетов</TableCell>
                                                            <TableCell align="right">{formatNumber(statistics.totalTriples)}</TableCell>
                                                            <TableCell>Общее количество утверждений (subject-predicate-object) с фильтром по вашему префиксу</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell>Классы</TableCell>
                                                            <TableCell align="right">{formatNumber(statistics.totalClasses)}</TableCell>
                                                            <TableCell>Количество определенных классов OWL</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell>Свойства</TableCell>
                                                            <TableCell align="right">{formatNumber(statistics.totalProperties)}</TableCell>
                                                            <TableCell>Количество свойств (ObjectProperty, DatatypeProperty)</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell>Индивиды</TableCell>
                                                            <TableCell align="right">{formatNumber(statistics.totalIndividuals)}</TableCell>
                                                            <TableCell>Количество конкретных экземпляров классов</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell>Обновлено</TableCell>
                                                            <TableCell align="right">{new Date(statistics.timestamp).toLocaleString()}</TableCell>
                                                            <TableCell>Время последнего обновления статистики</TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        ) : (
                                            <Alert severity="info">
                                                Статистика не загружена. Нажмите кнопку "Обновить статистику" выше.
                                            </Alert>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    </TabPanel>
                </CardContent>
            </Card>

            {/* Диалог экспорта */}
            <Dialog open={exportDialog} onClose={() => !exportProgress.exporting && setExportDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CloudDownload />
                        Экспорт данных из GraphDB
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {exportProgress.exporting ? (
                        <Box sx={{ width: '100%', p: 3 }}>
                            <Typography gutterBottom>
                                {exportProgress.message}
                            </Typography>
                            <LinearProgress
                                variant="determinate"
                                value={exportProgress.progress}
                                sx={{ mt: 2 }}
                            />
                            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                                {exportProgress.progress}%
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            <Typography paragraph>
                                Выберите формат для экспорта данных из GraphDB:
                            </Typography>
                            <FormControl fullWidth sx={{ mt: 2 }}>
                                <InputLabel>Формат экспорта</InputLabel>
                                <Select
                                    value={exportFormat}
                                    label="Формат экспорта"
                                    onChange={(e) => setExportFormat(e.target.value)}
                                >
                                    {exportOptions.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {option.icon}
                                                {option.label}
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <Alert severity="info" sx={{ mt: 2 }}>
                                Экспортируется до 1000 записей. Для полного экспорта выполните несколько запросов.
                            </Alert>
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setExportDialog(false)}
                        disabled={exportProgress.exporting}
                    >
                        Отмена
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleExport}
                        disabled={exportProgress.exporting}
                        startIcon={exportProgress.exporting ? <CircularProgress size={20} /> : <Download />}
                    >
                        {exportProgress.exporting ? 'Экспорт...' : 'Экспортировать'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Инструкции */}
            <Paper sx={{ p: 3, mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                    📋 Информация и инструкции
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom color="primary">
                            📊 О статистике триплетов:
                        </Typography>
                        <Typography variant="body2" paragraph>
                            • GraphDB может показывать завышенное количество триплетов из-за внутренних триплетов (метаданные, индексы)
                        </Typography>
                        <Typography variant="body2" paragraph>
                            • Для точной статистики используются фильтры по вашему префиксу (http://test.com/ontology#)
                        </Typography>
                        <Typography variant="body2">
                            • Статистика обновляется после каждой загрузки данных
                        </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom color="secondary">
                            💾 Экспорт данных:
                        </Typography>
                        <Typography variant="body2" paragraph>
                            • Используйте экспорт для создания резервных копий
                        </Typography>
                        <Typography variant="body2" paragraph>
                            • JSON - удобен для анализа в других программах
                        </Typography>
                        <Typography variant="body2">
                            • CSV - можно открыть в Excel или Google Sheets
                        </Typography>
                    </Grid>
                </Grid>
            </Paper>

            {/* Snackbar для сообщений */}
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={handleSnackbarClose}
                    severity={message?.type}
                    sx={{ width: '100%' }}
                >
                    {message?.text}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default Upload;