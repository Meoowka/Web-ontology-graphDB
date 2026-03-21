import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    TextField,
    Button,
    CircularProgress,
    Alert,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Collapse,
    IconButton,
    Paper,
    Chip,
} from '@mui/material';
import {
    Search,
    ExpandMore,
    ExpandLess,
    Category,
    Link,
    Person,
    Refresh,
} from '@mui/icons-material';
import api from '../services/api';

interface SparqlBinding {
    value: string;
    type?: string;
    datatype?: string;
    'xml:lang'?: string;
}

interface OntologyItem {
    id: string;
    label: string;
    type: 'class' | 'property' | 'individual';
    uri: string;
    children?: OntologyItem[];
    expanded?: boolean;
}

const OntologyTree: React.FC = () => {
    const [items, setItems] = useState<OntologyItem[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');

    useEffect(() => {
        fetchOntologyData();
    }, []);

    const fetchOntologyData = async (): Promise<void> => {
        setLoading(true);
        setError('');

        try {
            const classesQuery = `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT ?class ?label
WHERE {
  ?class a owl:Class .
  OPTIONAL { ?class rdfs:label ?label }
}
ORDER BY ?class
LIMIT 50
      `;

            const response = await api.post('/sparql/query', {
                query: classesQuery,
                format: 'json'
            });

            console.log("SPARQL response:", response.data);

            // Проверяем структуру ответа
            if (response.data?.results?.bindings) {
                const bindings = response.data.results.bindings as Record<string, SparqlBinding>[];

                const classesData: OntologyItem[] = bindings.map((item, index) => {
                    const uri = item.class?.value || '';
                    const label = item.label?.value ||
                        (uri.includes('#') ? uri.split('#').pop() :
                            uri.includes('/') ? uri.split('/').pop() :
                                uri) || 'Unnamed';

                    return {
                        id: `class-${index}`,
                        label: label,
                        type: 'class' as const,
                        uri: uri,
                        children: [],
                        expanded: false
                    };
                });

                setItems(classesData);
            } else {
                setError('Invalid response format from SPARQL endpoint');
            }
        } catch (err: any) {
            console.error('Error fetching ontology data:', err);

            // Подробная обработка ошибок
            if (err.response?.data?.error) {
                setError(`Server error: ${err.response.data.error}`);
            } else if (err.response?.data?.message) {
                setError(`Server error: ${err.response.data.message}`);
            } else if (err.message) {
                setError(`Error: ${err.message}`);
            } else if (err.code === 'ECONNABORTED') {
                setError('Request timeout. Check your connection to GraphDB.');
            } else {
                setError('Failed to fetch ontology data from GraphDB');
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (id: string): void => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, expanded: !item.expanded } : item
        ));
    };

    const getIcon = (type: string): React.ReactNode => {
        switch (type) {
            case 'class': return <Category color="primary" />;
            case 'property': return <Link color="secondary" />;
            case 'individual': return <Person color="action" />;
            default: return <Category />;
        }
    };

    const getTypeColor = (type: string): "primary" | "secondary" | "default" | "error" | "info" | "success" | "warning" => {
        switch (type) {
            case 'class': return 'primary';
            case 'property': return 'secondary';
            case 'individual': return 'default';
            default: return 'default';
        }
    };

    const filteredItems = searchTerm
        ? items.filter(item =>
            item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.uri.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.type.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : items;

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column', gap: 2 }}>
                <CircularProgress />
                <Typography variant="body2" color="textSecondary">
                    Загрузка данных онтологии...
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h5" gutterBottom>
                Дерево онтологии
            </Typography>

            <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                    size="small"
                    placeholder="Поиск по имени или URI..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    sx={{ flexGrow: 1 }}
                    InputProps={{
                        startAdornment: <Search fontSize="small" sx={{ mr: 1, color: 'action.active' }} />,
                    }}
                />
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Refresh />}
                    onClick={fetchOntologyData}
                    disabled={loading}
                >
                    Обновить
                </Button>
            </Box>

            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 2 }}
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            onClick={fetchOntologyData}
                            disabled={loading}
                        >
                            Повторить
                        </Button>
                    }
                >
                    {error}
                </Alert>
            )}

            {filteredItems.length === 0 && !loading ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="textSecondary">
                        {searchTerm ? 'Результаты не найдены' : 'Нет данных онтологии'}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                        {searchTerm ? 'Попробуйте изменить поисковый запрос' : 'Нажмите "Обновить" для загрузки данных из GraphDB'}
                    </Typography>
                </Paper>
            ) : (
                <>
                    <Paper sx={{ maxHeight: 400, overflow: 'auto', border: 1, borderColor: 'divider' }}>
                        <List dense disablePadding>
                            {filteredItems.map((item) => (
                                <React.Fragment key={item.id}>
                                    <ListItem
                                        sx={{
                                            borderBottom: '1px solid',
                                            borderColor: 'divider',
                                            '&:hover': { bgcolor: 'action.hover' }
                                        }}
                                        secondaryAction={
                                            <IconButton
                                                edge="end"
                                                size="small"
                                                onClick={() => toggleExpand(item.id)}
                                                disabled={!item.children || item.children.length === 0}
                                                title={item.children && item.children.length > 0 ? "Развернуть/свернуть" : "Нет дочерних элементов"}
                                            >
                                                {item.children && item.children.length > 0 ? (
                                                    item.expanded ? <ExpandLess /> : <ExpandMore />
                                                ) : null}
                                            </IconButton>
                                        }
                                    >
                                        <ListItemIcon>
                                            {getIcon(item.type)}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {item.label}
                                                    </Typography>
                                                    <Chip
                                                        label={item.type}
                                                        size="small"
                                                        color={getTypeColor(item.type)}
                                                        variant="outlined"
                                                    />
                                                </Box>
                                            }
                                            secondary={
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        fontFamily: 'monospace',
                                                        fontSize: '0.7rem',
                                                        color: 'text.secondary',
                                                        display: 'block',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    {item.uri}
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                    <Collapse in={item.expanded} timeout="auto" unmountOnExit>
                                        {item.children && item.children.length > 0 ? (
                                            <List component="div" disablePadding>
                                                {item.children.map((child) => (
                                                    <ListItem key={child.id} sx={{ pl: 4 }}>
                                                        <ListItemIcon sx={{ minWidth: 40 }}>
                                                            {getIcon(child.type)}
                                                        </ListItemIcon>
                                                        <ListItemText
                                                            primary={
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    <Typography variant="body2">
                                                                        {child.label}
                                                                    </Typography>
                                                                    <Chip
                                                                        label={child.type}
                                                                        size="small"
                                                                        variant="outlined"
                                                                    />
                                                                </Box>
                                                            }
                                                            secondary={
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{
                                                                        fontFamily: 'monospace',
                                                                        fontSize: '0.7rem',
                                                                        color: 'text.secondary'
                                                                    }}
                                                                >
                                                                    {child.uri}
                                                                </Typography>
                                                            }
                                                        />
                                                    </ListItem>
                                                ))}
                                            </List>
                                        ) : (
                                            <Box sx={{ pl: 4, py: 2 }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Нет дочерних элементов
                                                </Typography>
                                            </Box>
                                        )}
                                    </Collapse>
                                </React.Fragment>
                            ))}
                        </List>
                    </Paper>

                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                            Показано {filteredItems.length} из {items.length} элементов
                            {searchTerm && ` (отфильтровано по "${searchTerm}")`}
                        </Typography>
                        <Chip
                            label={`Всего: ${items.length}`}
                            size="small"
                            variant="outlined"
                        />
                    </Box>
                </>
            )}

            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                    Информация:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Дерево отображает классы из онтологии. Для получения свойств и индивидов используйте соответствующие запросы SPARQL.
                </Typography>
            </Box>
        </Box>
    );
};

export default OntologyTree;