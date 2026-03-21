import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    CircularProgress,
    Alert,
    Button,
    TextField,
    InputAdornment,
    Paper,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Divider,
    IconButton,
    Tooltip,
} from '@mui/material';
import {
    Search,
    Refresh,
    Info,
    Person,
    Category,
    Link,
    Dataset,
    FilterList,
    Visibility,
    Description,
    Label,
    ArrowForward, TableChart,
} from '@mui/icons-material';
import api from '../services/api';

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

interface SparqlBinding {
    value: string;
    type?: string;
    datatype?: string;
    'xml:lang'?: string;
}

interface SparqlResult {
    head: {
        vars: string[];
    };
    results: {
        bindings: Record<string, SparqlBinding>[];
    };
}

// Интерфейсы для различных компонентов онтологии
interface ClassItem {
    class: SparqlBinding;
    label?: SparqlBinding;
    comment?: SparqlBinding;
    parent?: SparqlBinding;
    instanceCount?: SparqlBinding;
}

interface PropertyItem {
    property: SparqlBinding;
    label?: SparqlBinding;
    comment?: SparqlBinding;
    domain?: SparqlBinding;
    range?: SparqlBinding;
    isFunctional?: SparqlBinding;
}

interface IndividualItem {
    individual: SparqlBinding;
    property?: SparqlBinding;
    value?: SparqlBinding;
}

interface RelationshipItem {
    property: SparqlBinding;

    label?: SparqlBinding;
    comment?: SparqlBinding;

    domain?: SparqlBinding;
    range?: SparqlBinding;

    subPropertyOf?: SparqlBinding;
    inverseOf?: SparqlBinding;

    isSymmetric?: SparqlBinding;
    isTransitive?: SparqlBinding;
    isInverseFunctional?: SparqlBinding;

    propertyType?: SparqlBinding;
}

// Функции для преобразования данных
function toClassItem(binding: Record<string, SparqlBinding>): ClassItem {
    return {
        class: binding.class || binding.cls || binding.Class || { value: '' },
        label: binding.label || binding.Label,
        comment: binding.comment || binding.Comment,
        parent: binding.parent || binding.subClassOf || binding.parent,
        instanceCount: binding.instanceCount || binding.count,
    };
}

function toPropertyItem(binding: Record<string, SparqlBinding>): PropertyItem {
    return {
        property: binding.property,
        label: binding.label,
        comment: binding.comment,
        domain: binding.domain,
        range: binding.range,
        isFunctional: binding.isFunctional,
    };
}

function toIndividualItem(binding: Record<string, SparqlBinding>): IndividualItem {
    return {
        individual: binding.individual || binding.ind || binding.Individual || { value: '' },
        property: binding.property,
        value: binding.value
    };
}

function toRelationshipItem(
    binding: Record<string, SparqlBinding>
): RelationshipItem {
    return {
        property: binding.property || binding.prop || { value: '' },

        label: binding.label,
        comment: binding.comment,

        domain: binding.domain,
        range: binding.range,

        subPropertyOf: binding.subPropertyOf,
        inverseOf: binding.inverseOf,

        isSymmetric: binding.isSymmetric,
        isTransitive: binding.isTransitive,
        isInverseFunctional: binding.isInverseFunctional,

        propertyType: binding.propertyType || binding.type,
    };
}

const OntologyBrowser: React.FC = () => {
    const [tabValue, setTabValue] = useState<number>(0);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [properties, setProperties] = useState<PropertyItem[]>([]);
    const [individuals, setIndividuals] = useState<IndividualItem[]>([]);
    const [relationships, setRelationships] = useState<RelationshipItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [activeFilter, setActiveFilter] = useState<string>('all');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async (): Promise<void> => {
        setLoading(true);
        setError('');

        try {
            console.log("Загрузка данных онтологии...");

            // Выполняем комплексный запрос для получения всех компонентов
            const complexQuery = `
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX owl: <http://www.w3.org/2002/07/owl#>
                PREFIX f: <http://test.com/ontology#>

                SELECT DISTINCT ?class ?label ?comment ?parent
                WHERE {
                    {
                        ?class a owl:Class .
                        OPTIONAL { ?class rdfs:label ?label }
                        OPTIONAL { ?class rdfs:comment ?comment }
                        OPTIONAL { ?class rdfs:subClassOf ?parent }
                    }
                    UNION
                    {
                        ?class rdf:type owl:Class .
                        OPTIONAL { ?class rdfs:label ?label }
                        OPTIONAL { ?class rdfs:comment ?comment }
                        OPTIONAL { ?class rdfs:subClassOf ?parent }
                    }
                }
                ORDER BY ?class
                LIMIT 50
            `;

            // Запрос для свойств (отношений и атрибутов)
            const propertiesQuery = `
  PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX owl: <http://www.w3.org/2002/07/owl#>

  SELECT DISTINCT
    ?property
    ?label
    ?comment
    ?domain
    ?range
    ?isFunctional
  WHERE {
    ?property rdf:type owl:DatatypeProperty .

    OPTIONAL { ?property rdfs:label ?label }
    OPTIONAL { ?property rdfs:comment ?comment }
    OPTIONAL { ?property rdfs:domain ?domain }
    OPTIONAL { ?property rdfs:range ?range }

    OPTIONAL {
      ?property rdf:type owl:FunctionalProperty .
      BIND(true AS ?isFunctional)
    }

    FILTER (STRSTARTS(STR(?property), "http://test.com/ontology#"))
  }
  ORDER BY ?property
`;

            // Запрос для индивидов (экземпляров)
            const individualsQuery = `
PREFIX f: <http://test.com/ontology#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT ?individual ?property ?value
WHERE
{
    ?individual rdf:type owl:NamedIndividual.
    ?individual ?property ?value .
}
`;

            // Запрос для отношений (триплы с метками)
            const relationshipsQuery = `
  PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX owl: <http://www.w3.org/2002/07/owl#>

  SELECT DISTINCT
    ?property
    ?label
    ?comment
    ?domain
    ?range
    ?isInverseFunctional
    ?isSymmetric
    ?isTransitive
    ?inverseOf
  WHERE {
    ?property rdf:type owl:ObjectProperty .

    OPTIONAL { ?property rdfs:label ?label }
    OPTIONAL { ?property rdfs:comment ?comment }
    OPTIONAL { ?property rdfs:domain ?domain }
    OPTIONAL { ?property rdfs:range ?range }
    OPTIONAL { ?property owl:inverseOf ?inverseOf }

    OPTIONAL {
      ?property rdf:type owl:InverseFunctionalProperty .
      BIND(true AS ?isInverseFunctional)
    }
    OPTIONAL {
      ?property rdf:type owl:SymmetricProperty .
      BIND(true AS ?isSymmetric)
    }
    OPTIONAL {
      ?property rdf:type owl:TransitiveProperty .
      BIND(true AS ?isTransitive)
    }

    FILTER (STRSTARTS(STR(?property), "http://test.com/ontology#"))
  }
  ORDER BY ?property
`;

            // Выполняем все запросы параллельно
            const [classesRes, propertiesRes, individualsRes, relationshipsRes] = await Promise.allSettled([
                api.post('/sparql/query', { query: complexQuery, format: 'json' }),
                api.post('/sparql/query', { query: propertiesQuery, format: 'json' }),
                api.post('/sparql/query', { query: individualsQuery, format: 'json' }),
                api.post('/sparql/query', { query: relationshipsQuery, format: 'json' }),
            ]);

            console.log("Результаты запросов:", {
                classes: classesRes,
                properties: propertiesRes,
                individuals: individualsRes,
                relationships: relationshipsRes,
            });

            // Обрабатываем результаты
            if (classesRes.status === 'fulfilled') {
                const classesData = classesRes.value.data as SparqlResult;
                setClasses((classesData.results?.bindings || []).map(toClassItem));
            }

            if (propertiesRes.status === 'fulfilled') {
                const propertiesData = propertiesRes.value.data as SparqlResult;
                setProperties((propertiesData.results?.bindings || []).map(toPropertyItem));
            }

            if (individualsRes.status === 'fulfilled') {
                const individualsData = individualsRes.value.data as SparqlResult;
                setIndividuals((individualsData.results?.bindings || []).map(toIndividualItem));
            }

            if (relationshipsRes.status === 'fulfilled') {
                const relationshipsData = relationshipsRes.value.data as SparqlResult;
                setRelationships((relationshipsData.results?.bindings || []).map(toRelationshipItem));
            }

            // Проверяем ошибки
            const errors = [
                classesRes.status === 'rejected' && 'классы',
                propertiesRes.status === 'rejected' && 'свойства',
                individualsRes.status === 'rejected' && 'индивиды',
                relationshipsRes.status === 'rejected' && 'отношения',
            ].filter(Boolean);

            if (errors.length > 0) {
                console.warn('Частичная загрузка данных. Ошибки:', errors);
            }

        } catch (err: any) {
            console.error('Ошибка загрузки данных:', err);

            if (err.response?.data?.error) {
                setError(`Ошибка сервера: ${err.response.data.error}`);
            } else if (err.message) {
                setError(`Ошибка: ${err.message}`);
            } else {
                setError('Не удалось загрузить данные онтологии. Проверьте подключение к серверу.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (event: React.SyntheticEvent, newValue: number): void => {
        setTabValue(newValue);
    };

    const getShortUri = (binding: SparqlBinding | null | undefined): string => {
        if (!binding || !binding.value) return '';

        const uriString = binding.value;

        // Для литералов возвращаем значение
        if (uriString.startsWith('"') || !uriString.includes('://')) {
            return uriString.replace(/^"|"$/g, '');
        }

        try {
            const url = new URL(uriString);
            return url.hash ? url.hash.substring(1) : url.pathname.split('/').pop() || uriString;
        } catch {
            if (uriString.includes('#')) {
                return uriString.split('#').pop() || uriString;
            }
            if (uriString.includes('/')) {
                const parts = uriString.split('/');
                return parts[parts.length - 1] || parts[parts.length - 2] || uriString;
            }
            return uriString;
        }
    };

    const getLabel = (
        item: ClassItem | PropertyItem | IndividualItem | RelationshipItem
    ): string => {
        if (!item) return '';
        if ('label' in item && item.label?.value) {
            return item.label.value;
        }
        return '';
    };

    const getValue = (binding: SparqlBinding | null | undefined): string => {
        if (!binding) return '';
        return binding.value || '';
    };

    const getComment = (item: ClassItem | PropertyItem): string => {
        if (!item || !item.comment) return '';
        return item.comment.value.replace(/^"|"$/g, '');
    };

    const getPropertyTypeIcon = (propertyType: SparqlBinding | null | undefined) => {
        const type = getShortUri(propertyType);
        if (type.includes('ObjectProperty')) return <Link />;
        if (type.includes('DatatypeProperty')) return <Label />;
        if (type.includes('AnnotationProperty')) return <Description />;
        return <Link />;
    };

    const getPropertyTypeColor = (propertyType: SparqlBinding | null | undefined) => {
        const type = getShortUri(propertyType);
        if (type.includes('ObjectProperty')) return 'primary';
        if (type.includes('DatatypeProperty')) return 'secondary';
        if (type.includes('AnnotationProperty')) return 'info';
        return 'default';
    };

    const getIndividualTypeColor = (type: SparqlBinding | null | undefined) => {
        const typeStr = getShortUri(type).toLowerCase();
        if (typeStr.includes('person') || typeStr.includes('human')) return 'primary';
        if (typeStr.includes('male') || typeStr.includes('man')) return 'info';
        if (typeStr.includes('female') || typeStr.includes('woman')) return 'error';
        return 'default';
    };

    // Фильтрация данных
    const filteredClasses = classes.filter(item =>
        getShortUri(item.class).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getLabel(item).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getComment(item).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredProperties = properties.filter(item =>
        getShortUri(item.property).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getLabel(item).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getShortUri(item.domain).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getShortUri(item.range).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredIndividuals = individuals.filter(item =>
        getShortUri(item.individual).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getShortUri(item.property).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.value?.value || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredRelationships = relationships.filter(item =>
        getShortUri(item.property).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.label?.value || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        getShortUri(item.domain).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getShortUri(item.range).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.comment?.value || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderLoading = (): JSX.Element => (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', flexDirection: 'column', gap: 2 }}>
            <CircularProgress />
            <Typography variant="body2" color="textSecondary">
                Загрузка данных онтологии...
            </Typography>
        </Box>
    );

    const renderEmptyState = (type: string, hasSearch: boolean): JSX.Element => (
        <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="textSecondary" gutterBottom>
                {hasSearch ? `${type} не найдены` : `${type} отсутствуют`}
            </Typography>
            <Typography variant="body2" color="textSecondary">
                {hasSearch ? 'Попробуйте изменить поисковый запрос' : 'Данный компонент онтологии пока не содержит элементов'}
            </Typography>
        </Box>
    );

    if (loading) {
        return renderLoading();
    }

    return (
        <Box>
            {/* Заголовок и управление */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h4" gutterBottom>
                        Браузер онтологии
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Просмотр компонентов онтологии: классов, свойств, индивидов и отношений
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                        size="small"
                        placeholder="Поиск по всем компонентам..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ width: 300 }}
                    />
                    <Tooltip title="Обновить данные">
                        <IconButton onClick={fetchData} disabled={loading}>
                            <Refresh />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* Быстрая статистика */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Category color="primary" sx={{ fontSize: 40 }} />
                            <Box>
                                <Typography variant="h4">{classes.length}</Typography>
                                <Typography variant="body2" color="text.secondary">Классы</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Link color="secondary" sx={{ fontSize: 40 }} />
                            <Box>
                                <Typography variant="h4">{properties.length}</Typography>
                                <Typography variant="body2" color="text.secondary">Свойства</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Link color="success" sx={{ fontSize: 40 }} />
                            <Box>
                                <Typography variant="h4">{relationships.length}</Typography>
                                <Typography variant="body2" color="text.secondary">Отношения</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Person color="info" sx={{ fontSize: 40 }} />
                            <Box>
                                <Typography variant="h4">{individuals.length}</Typography>
                                <Typography variant="body2" color="text.secondary">Индивиды</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

            </Grid>

            {/* Основной контент */}
            <Card>
                <CardContent>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={tabValue} onChange={handleTabChange}>
                            <Tab
                                label="Классы"
                                icon={<Category fontSize="small" />}
                                iconPosition="start"
                            />
                            <Tab
                                label="Свойства"
                                icon={<Link fontSize="small" />}
                                iconPosition="start"
                            />
                            <Tab
                                label="Отношения"
                                icon={<Link fontSize="small" />}
                                iconPosition="start"
                            />
                            <Tab
                                label="Индивиды"
                                icon={<Person fontSize="small" />}
                                iconPosition="start"
                            />

                        </Tabs>
                    </Box>

                    {/* Панель классов */}
                    <TabPanel value={tabValue} index={0}>
                        {filteredClasses.length === 0 ? (
                            renderEmptyState('Классы', !!searchTerm)
                        ) : (
                            <TableContainer component={Paper}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Класс</TableCell>
                                            <TableCell>Название</TableCell>
                                            <TableCell>Описание</TableCell>
                                            <TableCell>Родительский класс</TableCell>
                                            <TableCell>URI</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredClasses.map((item, index) => (
                                            <TableRow key={index} hover>
                                                <TableCell>
                                                    <Chip
                                                        label={getShortUri(item.class)}
                                                        icon={<Category />}
                                                        color="primary"
                                                        variant="outlined"
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {getLabel(item) || (
                                                        <Typography color="textSecondary" variant="caption">
                                                            Без названия
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {getComment(item) || (
                                                        <Typography color="textSecondary" variant="caption">
                                                            Нет описания
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {item.parent ? (
                                                        <Chip
                                                            label={getShortUri(item.parent)}
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    ) : (
                                                        <Typography color="textSecondary" variant="caption">
                                                            Без родителя
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            fontFamily: 'monospace',
                                                            fontSize: '0.75rem',
                                                            color: 'text.secondary',
                                                            display: 'block',
                                                            maxWidth: 200,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        {getValue(item.class)}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </TabPanel>

                    {/* Панель свойств */}
                    <TabPanel value={tabValue} index={1}>
                        {filteredProperties.length === 0 ? (
                            renderEmptyState('Свойства', !!searchTerm)
                        ) : (
                            <TableContainer component={Paper}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Свойство</TableCell>
                                            <TableCell>Название</TableCell>
                                            <TableCell>Описание</TableCell>
                                            <TableCell>Домен</TableCell>
                                            <TableCell>Диапазон</TableCell>
                                            <TableCell>Функциональное</TableCell>
                                            <TableCell>URI</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredProperties.map((item, i) => (
                                            <TableRow key={i} hover>
                                                <TableCell>
                                                    <Chip label={getShortUri(item.property)} size="small" />
                                                </TableCell>

                                                <TableCell>{item.label?.value || '—'}</TableCell>

                                                <TableCell>
                                                    {item.comment?.value || (
                                                        <Typography variant="caption" color="text.secondary">Нет описания</Typography>
                                                    )}
                                                </TableCell>

                                                <TableCell>
                                                    {item.domain?.value ? getShortUri(item.domain) : '—'}
                                                </TableCell>

                                                <TableCell>
                                                    {item.range?.value ? getShortUri(item.range) : '—'}
                                                </TableCell>

                                                <TableCell>
                                                    {item.isFunctional?.value ? 'Да' : 'Нет'}
                                                </TableCell>

                                                <TableCell>
                                                    <Typography variant="caption" fontFamily="monospace">
                                                        {getValue(item.property)}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </TabPanel>

                    {/* Панель отношений */}
                    <TabPanel value={tabValue} index={2}>
                        {filteredRelationships.length === 0 ? (
                            renderEmptyState('Отношения', !!searchTerm)
                        ) : (
                            <TableContainer component={Paper}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Отношение</TableCell>
                                            <TableCell>Название</TableCell>
                                            <TableCell>Описание</TableCell>
                                            <TableCell>Домен</TableCell>
                                            <TableCell>Диапазон</TableCell>
                                            <TableCell>Обратное</TableCell>
                                            <TableCell>Симм.</TableCell>
                                            <TableCell>Транз.</TableCell>
                                            <TableCell>URI</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredRelationships.map((item, i) => (
                                            <TableRow key={i} hover>
                                                <TableCell>
                                                    <Chip label={getShortUri(item.property)} size="small" />
                                                </TableCell>

                                                <TableCell>{item.label?.value || '—'}</TableCell>

                                                <TableCell>
                                                    {item.comment?.value || (
                                                        <Typography variant="caption" color="text.secondary">Нет описания</Typography>
                                                    )}
                                                </TableCell>

                                                <TableCell>
                                                    {item.domain?.value ? getShortUri(item.domain) : '—'}
                                                </TableCell>

                                                <TableCell>
                                                    {item.range?.value ? getShortUri(item.range) : '—'}
                                                </TableCell>

                                                <TableCell>
                                                    {item.inverseOf?.value ? getShortUri(item.inverseOf) : '—'}
                                                </TableCell>

                                                <TableCell>
                                                    {item.isSymmetric?.value ? 'Да' : 'Нет'}
                                                </TableCell>

                                                <TableCell>
                                                    {item.isTransitive?.value ? 'Да' : 'Нет'}
                                                </TableCell>

                                                <TableCell>
                                                    <Typography variant="caption" fontFamily="monospace">
                                                        {getValue(item.property)}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </TabPanel>

                    {/* Панель индивидов */}
                    <TabPanel value={tabValue} index={3}>
                        {filteredIndividuals.length === 0 ? (
                            renderEmptyState('Индивиды', !!searchTerm)
                        ) : (
                            <TableContainer component={Paper}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Индивид</TableCell>
                                            <TableCell>Cвойство/Отношение</TableCell>
                                            <TableCell>Значение</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredIndividuals.map((item, index) => (
                                            <TableRow key={index} hover>
                                                <TableCell>
                                                    <Chip
                                                        label={getShortUri(item.individual)}
                                                        icon={<Person />}
                                                        variant="outlined"
                                                        size="small"
                                                    />
                                                </TableCell>
                                                    <TableCell>{item.property?.value ? getShortUri(item.property) : '—'}</TableCell>
                                                    <TableCell>{item.value?.value ? getShortUri(item.value) : '—'}</TableCell>

                                                <TableCell>
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            fontFamily: 'monospace',
                                                            fontSize: '0.75rem',
                                                            color: 'text.secondary',
                                                            display: 'block',
                                                            maxWidth: 260,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        {getValue(item.individual)}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </TabPanel>

                </CardContent>
            </Card>

            {/* Информационная панель */}
            <Box sx={{ mt: 3 }}>
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Info />
                                Компоненты онтологии
                            </Box>
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={3}>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="subtitle2" gutterBottom color="primary">
                                        <Category sx={{ verticalAlign: 'middle', mr: 1 }} />
                                        Классы
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Категории и типы объектов (сущности). Определяют общие характеристики и поведение.
                                        Примеры: Person, Man, Woman, Family.
                                    </Typography>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="subtitle2" gutterBottom color="secondary">
                                        <Link sx={{ verticalAlign: 'middle', mr: 1 }} />
                                        Свойства
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Отношения и атрибуты. Связывают объекты между собой или определяют их характеристики.
                                        Примеры: has_child, sex, age, has_partner.
                                    </Typography>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="subtitle2" gutterBottom color="success">
                                        <Dataset sx={{ verticalAlign: 'middle', mr: 1 }} />
                                        Отношения
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Фактические связи между индивидами. Конкретные утверждения в онтологии.
                                        Примеры: Pavel has_child Masha, Lena sex "female".
                                    </Typography>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="subtitle2" gutterBottom color="info">
                                        <TableChart sx={{ verticalAlign: 'middle', mr: 1 }} />
                                        Индивиды
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Конкретные экземпляры классов. Реальные объекты в доменной области.
                                        Примеры: Pavel, Lena, Masha, Ivan.
                                    </Typography>
                                </Paper>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
};

export default OntologyBrowser;