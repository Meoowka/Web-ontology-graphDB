import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    Button,
    CircularProgress,
    Alert,
    Chip,
    Paper,
} from '@mui/material';
import { Refresh, Storage, Category, Link, Person } from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';

interface Statistics {
    triples: number;
    classes: number;
    properties: number;
    individuals: number;
}

interface ConnectionStatus {
    connected: boolean;
    message: string;
    repositories?: any[];
}

const Dashboard: React.FC = () => {
    const [statistics, setStatistics] = useState<Statistics | null>(null);
    const [connection, setConnection] = useState<ConnectionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingConnection, setLoadingConnection] = useState(false);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        fetchStatistics();
        testConnection();
    }, []);

    const fetchStatistics = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await api.get('/ontology/statistics');
            const direct = response.data?.data;

            if (direct && typeof direct === 'object' && ('triples' in direct || 'classes' in direct)) {
                setStatistics({
                    triples: Number(direct.triples ?? 0),
                    classes: Number(direct.classes ?? 0),
                    properties: Number(direct.properties ?? 0),
                    individuals: Number(direct.individuals ?? 0),
                });
                return;
            }

            // если пришёл неожиданный формат
            setStatistics({
                triples: 0,
                classes: 0,
                properties: 0,
                individuals: 0,
            });
            setError('Сервер вернул неожиданный формат статистики');
        } catch (err: any) {
            setError('Не удалось получить статистику');
        } finally {
            setLoading(false);
        }
    };

    const testConnection = async () => {
        setLoadingConnection(true);
        try {
            // Реальная проверка — статистика. Если GraphDB мертва, тут будет ошибка.
            await api.get('/ontology/statistics', { params: { t: Date.now() } });

            setConnection({
                connected: true,
                message: 'GraphDB доступна',
            });
        } catch (e) {
            setConnection({
                connected: false,
                message: 'GraphDB недоступна',
            });
        } finally {
            setLoadingConnection(false);
        }
    };


    const getChartData = () => {
        if (!statistics) return [];
        return [
            { name: 'Триплеты', value: statistics.triples },
            { name: 'Классы', value: statistics.classes },
            { name: 'Свойства', value: statistics.properties },
            { name: statistics.individuals },
        ];
    };

    const isConnected = Boolean(connection?.connected);

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Панель управления
            </Typography>

            {/* Статус соединения */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Статус соединения с GraphDB</Typography>
                        <Button
                            variant="outlined"
                            startIcon={<Refresh />}
                            onClick={testConnection}
                            disabled={loadingConnection}
                            size="small"
                        >
                            Проверить
                        </Button>
                    </Box>

                    {connection && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Chip
                                label={isConnected ? 'Подключено' : 'Отключено'}
                                color={isConnected ? 'success' : 'error'}
                                variant="outlined"
                            />
                            <Typography variant="body2">{connection.message}</Typography>
                        </Box>
                    )}

                    {!connection && !loadingConnection && (
                        <Typography variant="body2" color="text.secondary">
                            Статус соединения ещё не получен
                        </Typography>
                    )}

                    {loadingConnection && (
                        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={18} />
                            <Typography variant="body2" color="text.secondary">
                                Проверяем соединение…
                            </Typography>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* Статистика */}
            <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6">Статистика репозитория</Typography>
                                <Button startIcon={<Refresh />} onClick={fetchStatistics} disabled={loading} size="small">
                                    Обновить
                                </Button>
                            </Box>

                            {loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                                    <CircularProgress />
                                </Box>
                            ) : error ? (
                                <Alert severity="error">{error}</Alert>
                            ) : statistics ? (
                                <>
                                    <Box sx={{ mb: 3 }}>
                                        <Grid container spacing={2}>
                                            <Grid item xs={6} sm={3}>
                                                <Paper sx={{ p: 2, textAlign: 'center' }}>
                                                    <Storage color="primary" sx={{ fontSize: 40, mb: 1 }} />
                                                    <Typography variant="h5">{statistics.triples}</Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Триплетов
                                                    </Typography>
                                                </Paper>
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <Paper sx={{ p: 2, textAlign: 'center' }}>
                                                    <Category color="secondary" sx={{ fontSize: 40, mb: 1 }} />
                                                    <Typography variant="h5">{statistics.classes}</Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Классов
                                                    </Typography>
                                                </Paper>
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <Paper sx={{ p: 2, textAlign: 'center' }}>
                                                    <Link color="success" sx={{ fontSize: 40, mb: 1 }} />
                                                    <Typography variant="h5">{statistics.properties}</Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Свойств
                                                    </Typography>
                                                </Paper>
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <Paper sx={{ p: 2, textAlign: 'center' }}>
                                                    <Person color="warning" sx={{ fontSize: 40, mb: 1 }} />
                                                    <Typography variant="h5">{statistics.individuals}</Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Индивидов
                                                    </Typography>
                                                </Paper>
                                            </Grid>
                                        </Grid>
                                    </Box>

                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={getChartData()}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Tooltip />
                                            <Bar dataKey="value" fill="#1976d2" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </>
                            ) : (
                                <Typography>Нет данных</Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Быстрые действия
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Button variant="contained" onClick={() => (window.location.href = '/upload')} fullWidth>
                                    Загрузить данные
                                </Button>
                                <Button variant="outlined" onClick={() => (window.location.href = '/sparql')} fullWidth>
                                    Выполнить запрос
                                </Button>
                                <Button variant="outlined" onClick={() => (window.location.href = '/browser')} fullWidth>
                                    Просмотреть онтологию
                                </Button>
                            </Box>

                            <Box sx={{ mt: 3 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Информация о системе
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    • Используется GraphDB для хранения RDF данных
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    • Поддержка SPARQL 1.1 запросов
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    • Форматы: Turtle, RDF/XML, JSON-LD
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Dashboard;
