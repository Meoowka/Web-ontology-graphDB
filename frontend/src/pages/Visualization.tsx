import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    CircularProgress,
    Alert,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import api from '../services/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const Visualization: React.FC = () => {
    const [statistics, setStatistics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [chartType, setChartType] = useState('bar');
    const [error, setError] = useState('');

    useEffect(() => {
        fetchStatistics();
    }, []);

    const fetchStatistics = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await api.get('/ontology/statistics');
            const direct = response.data?.data;
            if (direct && typeof direct === 'object' && ('triples' in direct || 'classes' in direct)) {
                setStatistics(direct);
                return;
            }
            setError('Статистика пришла в неожиданном формате');
        } catch (err: any) {
            setError('Не удалось загрузить статистику');
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const prepareChartData = () => {
        if (!statistics) {
            return [
                { name: 'Триплеты', value: 0 },
                { name: 'Классы', value: 0 },
                { name: 'Свойства', value: 0 },
                { name: 'Индивиды', value: 0 },
            ];
        }

        return [
            { name: 'Триплеты', value: Number(statistics.triples ?? 0) },
            { name: 'Классы', value: Number(statistics.classes ?? 0) },
            { name: 'Свойства', value: Number(statistics.properties ?? 0) },
            { name: 'Индивиды', value: Number(statistics.individuals ?? 0) },
        ];
    };

    const renderChart = () => {
        const data = prepareChartData();

        switch (chartType) {
            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="value" fill="#1976d2" name="Количество">
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'pie':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, value }) => `${name}: ${value}`}
                                outerRadius={150}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                );

            default:
                return null;
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Визуализация данных
            </Typography>

            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                                <FormControl sx={{ minWidth: 150 }}>
                                    <InputLabel>Тип диаграммы</InputLabel>
                                    <Select
                                        value={chartType}
                                        label="Тип диаграммы"
                                        onChange={(e) => setChartType(e.target.value)}
                                    >
                                        <MenuItem value="bar">Столбчатая</MenuItem>
                                        <MenuItem value="pie">Круговая</MenuItem>
                                    </Select>
                                </FormControl>

                                <Button
                                    variant="outlined"
                                    startIcon={<Refresh />}
                                    onClick={fetchStatistics}
                                    disabled={loading}
                                >
                                    Обновить данные
                                </Button>
                            </Box>

                            {error ? (
                                <Alert severity="error">{error}</Alert>
                            ) : (
                                renderChart()
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Статистика репозитория
                            </Typography>
                            {statistics ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography>Триплетов:</Typography>
                                        <Typography variant="h6">{statistics.triples ?? 0}</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography>Классов:</Typography>
                                        <Typography variant="h6">{statistics.classes ?? 0}</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography>Свойств:</Typography>
                                        <Typography variant="h6">{statistics.properties ?? 0}</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography>Индивидов:</Typography>
                                        <Typography variant="h6">{statistics.individuals ?? 0}</Typography>
                                    </Box>
                                </Box>
                            ) : (
                                <Typography color="textSecondary">Нет данных</Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Информация о визуализации
                            </Typography>
                            <Typography variant="body2" color="text.secondary" paragraph>
                                Диаграмма показывает распределение элементов в репозитории GraphDB.
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • <strong>Триплеты</strong> — все RDF утверждения
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • <strong>Субъекты</strong> — категории объектов (OWL классы)
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • <strong>Действия</strong> — отношения между объектами
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • <strong>Объекты</strong> — конкретные экземпляры
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Visualization;