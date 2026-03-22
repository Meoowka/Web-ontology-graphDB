const axios = require('axios');

class GraphDBClient {
    constructor() {
        this.baseURL = process.env.GRAPHDB_URL || 'http://localhost:7200';
        this.repository = process.env.GRAPHDB_REPOSITORY || 'family_antalogy';
        this.auth = {
            username: process.env.GRAPHDB_USERNAME || 'admin',
            password: process.env.GRAPHDB_PASSWORD || 'root'
        };

        this.axiosInstance = axios.create({
            baseURL: this.baseURL,
            auth: this.auth,
            timeout: 60000, // Увеличиваем таймаут для больших запросов
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
    }

    // Проверка соединения
    async testConnection() {
        try {
            const response = await this.axiosInstance.get('/repositories');
            return {
                connected: true,
                repositories: response.data,
                message: 'Успешное подключение к GraphDB'
            };
        } catch (error) {
            console.error('GraphDB connection error:', error.message);
            return {
                connected: false,
                error: error.message,
                message: 'Не удалось подключиться к GraphDB'
            };
        }
    }
    async importRDF(data, contentType = 'text/turtle', context = 'http://test.com/ontology#') {
        try {
            const endpoint = `/repositories/${this.repository}/statements`;

            const response = await this.axiosInstance.post(endpoint, data, {
                params: context ? { context: `<${context}>` } : undefined,
                headers: {
                    'Content-Type': contentType,
                    'Accept': 'application/json'
                }
            });

            return {
                success: true,
                data: response.data,
                status: response.status,
                message: 'RDF imported successfully'
            };
        } catch (error) {
            console.error('Import RDF error:', error.message);

            if (error.response) {
                return {
                    success: false,
                    error: error.response.data?.message ||
                        error.response.data?.error ||
                        error.response.data?.toString().substring(0, 500) ||
                        `HTTP ${error.response.status}: ${error.response.statusText}`,
                    status: error.response.status,
                    details: error.response.data
                };
            }
            return { success: false, error: error.message, status: 500 };
        }
    }
    // Выполнить SPARQL Query
    async executeSparql(query, format = 'json') {
        try {
            const endpoint = `/repositories/${this.repository}`;
            console.log(`Executing SPARQL query on: ${endpoint}`);
            console.log(`Format: ${format}`);

            const params = new URLSearchParams();
            params.append('query', query);

            const acceptHeader = this.getAcceptHeader(format);

            const response = await this.axiosInstance.post(endpoint, params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': acceptHeader
                }
            });

            console.log(`Query successful, status: ${response.status}`);

            return {
                success: true,
                data: response.data,
                headers: response.headers,
                status: response.status
            };
        } catch (error) {
            console.error('SPARQL Query execution error:', error.message);
            console.error('Query that failed:', query.substring(0, 200) + '...');

            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);

                return {
                    success: false,
                    error: error.response.data?.message ||
                        error.response.data?.error ||
                        error.response.data?.toString().substring(0, 500) ||
                        `HTTP ${error.response.status}: ${error.response.statusText}`,
                    status: error.response.status,
                    details: error.response.data
                };
            } else if (error.request) {
                return {
                    success: false,
                    error: 'Нет ответа от GraphDB. Проверьте подключение.',
                    status: 503
                };
            } else {
                return {
                    success: false,
                    error: error.message,
                    status: 500
                };
            }
        }
    }

    // Выполнить SPARQL Update
    async executeUpdate(query) {
        try {
            const endpoint = `/repositories/${this.repository}/statements`;
            console.log(`Executing SPARQL update on: ${endpoint}`);
            console.log(`Update query: ${query.substring(0, 200)}...`);

            const params = new URLSearchParams();
            params.append('update', query);

            const response = await this.axiosInstance.post(endpoint, params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                }
            });

            console.log(`Update successful, status: ${response.status}`);

            return {
                success: true,
                data: response.data,
                status: response.status,
                message: 'Update executed successfully'
            };
        } catch (error) {
            console.error('SPARQL Update execution error:', error.message);
            console.error('Update query that failed:', query.substring(0, 200) + '...');

            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);

                return {
                    success: false,
                    error: error.response.data?.message ||
                        error.response.data?.error ||
                        error.response.data?.toString().substring(0, 500) ||
                        `HTTP ${error.response.status}: ${error.response.statusText}`,
                    status: error.response.status,
                    details: error.response.data
                };
            } else if (error.request) {
                return {
                    success: false,
                    error: 'Нет ответа от GraphDB. Проверьте подключение.',
                    status: 503
                };
            } else {
                return {
                    success: false,
                    error: error.message,
                    status: 500
                };
            }
        }
    }

    // Универсальный метод
    async executeAnySparql(query, format = 'json') {
        try {
            const queryType = this.getQueryType(query);
            console.log(`executeAnySparql: Query type detected: ${queryType}`);

            if (['SELECT', 'ASK', 'CONSTRUCT', 'DESCRIBE'].includes(queryType)) {
                return await this.executeSparql(query, format);
            } else if (['INSERT', 'DELETE', 'UPDATE', 'CLEAR', 'DROP', 'LOAD', 'CREATE'].includes(queryType)) {
                return await this.executeUpdate(query);
            } else {
                console.error(`Unknown query type: ${queryType}`);
                return {
                    success: false,
                    error: `Неизвестный тип запроса: ${queryType}`,
                    status: 400,
                    allowed_types: ['SELECT', 'INSERT', 'DELETE', 'UPDATE', 'ASK', 'CONSTRUCT', 'DESCRIBE', 'CLEAR', 'DROP', 'LOAD', 'CREATE']
                };
            }
        } catch (error) {
            console.error('Error in executeAnySparql:', error);
            return {
                success: false,
                error: error.message,
                status: 500
            };
        }
    }

    // Определить тип запроса
    getQueryType(query) {
        if (!query || typeof query !== 'string') return 'UNKNOWN';

        const queryUpper = query.trim().toUpperCase();

        // Удаляем PREFIX строки
        let queryWithoutPrefix = queryUpper;
        queryWithoutPrefix = queryWithoutPrefix.replace(/PREFIX\s+[^\s:]+\s*:\s*<[^>]+>\s*/g, '');
        queryWithoutPrefix = queryWithoutPrefix.replace(/PREFIX\s+[^\s]+\s+<[^>]+>\s*/g, '');
        queryWithoutPrefix = queryWithoutPrefix.trim();

        const firstWord = queryWithoutPrefix.split(' ')[0];

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

    // Получить Accept header
    getAcceptHeader(format) {
        const formatMap = {
            'json': 'application/sparql-results+json',
            'xml': 'application/sparql-results+xml',
            'csv': 'text/csv',
            'tsv': 'text/tab-separated-values',
            'turtle': 'text/turtle',
            'rdf+xml': 'application/rdf+xml',
            'n-triples': 'application/n-triples',
            'ld+json': 'application/ld+json'
        };

        return formatMap[format] || 'application/sparql-results+json';
    }

    // Загрузка RDF данных (для обратной совместимости)
    async uploadRDF(data, format = 'text/turtle', context = 'http://test.com/ontology#') {
        return await this.importRDF(data, format, context);
    }

    // Получить статистику
    async getStatistics() {
        const query = `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>

    SELECT ?triples ?classes ?properties ?individuals
    WHERE {
      {
        SELECT (COUNT(*) AS ?triples)
        WHERE {
          ?s ?p ?o .
          FILTER(
            STRSTARTS(STR(?s), "http://test.com/ontology#") ||
            STRSTARTS(STR(?p), "http://test.com/ontology#") ||
            (isIRI(?o) && STRSTARTS(STR(?o), "http://test.com/ontology#"))
          )
        }
      }
      {
        SELECT (COUNT(DISTINCT ?class) AS ?classes)
        WHERE {
          ?class a owl:Class .
          FILTER(STRSTARTS(STR(?class), "http://test.com/ontology#"))
        }
      }
      {
        SELECT (COUNT(DISTINCT ?property) AS ?properties)
        WHERE {
          ?property a ?t .
          FILTER(?t IN (rdf:Property, owl:ObjectProperty, owl:DatatypeProperty, owl:AnnotationProperty))
          FILTER(STRSTARTS(STR(?property), "http://test.com/ontology#"))
        }
      }
      {
        SELECT (COUNT(DISTINCT ?individual) AS ?individuals)
        WHERE {
          ?individual rdf:type ?type .
          FILTER(?type NOT IN (owl:Class, rdf:Property, owl:ObjectProperty, owl:DatatypeProperty, owl:AnnotationProperty))
          FILTER(STRSTARTS(STR(?individual), "http://test.com/ontology#"))
        }
      }
    }
  `;

        const result = await this.executeSparql(query, 'json');

        if (!result.success) {
            return result; // вернём {success:false,...} как и остальные методы
        }

        const b = result.data?.results?.bindings?.[0] || {};
        const data = {
            triples: parseInt(b.triples?.value || '0', 10),
            classes: parseInt(b.classes?.value || '0', 10),
            properties: parseInt(b.properties?.value || '0', 10),
            individuals: parseInt(b.individuals?.value || '0', 10),
        };

        return { success: true, data };
    }
    // Получить все классы
    async getClasses(limit = 100) {
        const query = `
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX owl: <http://www.w3.org/2002/07/owl#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            
            SELECT DISTINCT ?class ?label ?comment
            WHERE {
                ?class a owl:Class .
                OPTIONAL { ?class rdfs:label ?label }
                OPTIONAL { ?class rdfs:comment ?comment }
            }
            ORDER BY ?label
            LIMIT ${limit}
        `;

        return await this.executeSparql(query);
    }

    // Получить все свойства
    async getProperties(limit = 100) {
        const query = `
 PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
 PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
 PREFIX owl: <http://www.w3.org/2002/07/owl#>
            
            SELECT DISTINCT ?property ?label ?comment ?domain ?range
            WHERE {
                ?property rdf:type owl:DatatypeProperty .
                OPTIONAL { ?property rdfs:label ?label }
                OPTIONAL { ?property rdfs:comment ?comment }
                OPTIONAL { ?property rdfs:domain ?domain }
                OPTIONAL { ?property rdfs:range ?range }
            }
            ORDER BY ?label
            LIMIT ${limit}
        `;

        return await this.executeSparql(query);
    }

    // Получить всех индивидов
    async getIndividuals(limit = 100) {
        const query = `
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX owl: <http://www.w3.org/2002/07/owl#>
            
            SELECT ?individual ?type ?label
            WHERE {
                ?individual a ?type .
                FILTER (?type != owl:Class && ?type != rdf:Property)
                OPTIONAL { ?individual rdfs:label ?label }
            }
            ORDER BY ?type
            LIMIT ${limit}
        `;

        return await this.executeSparql(query);
    }
}

module.exports = new GraphDBClient();