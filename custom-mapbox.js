/* Положите этот файл custom-mapbox.js в Путь хранения: /wp-content/themes/THEME_NAME/js/custom-mapbox.js */
window.mapInstances = {}; // Глобальный объект для хранения экземпляров карт

window.onload = async function() {
    // Загружаем конфигурацию
    const config = await fetchConfig();
    if (!config) {
        console.error('Failed to load config');
        return;
    }

    mapboxgl.accessToken = config.accessToken; // Вставьте свой токен с mapbox в файл 

    // Получаем маршруты
    const routes = await fetchRoutes(config.routesUrl);

    // Инициализация карт для всех маршрутов
    routes.forEach(route => {
        const container = document.getElementById(route.id);
        if (container) {
            initializeMap(container, route, config.markerImageUrl);
        } else {
            console.error(`Container ${route.id} not found.`);
        }
    });

    /**
     * Загрузка конфигурации из JSON-файла
     * @returns {Promise<Object>} Объект конфигурации
     */
    async function fetchConfig() {
        try {
            const response = await fetch('/wp-content/themes/THEME_NAME/js/config_mapbox.json'); // Путь к файлу конфигурации
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('Error fetching config:', error);
            return null;
        }
    }

    /**
     * Получение данных о маршрутах, сначала проверяя кэш
     * @param {string} routesUrl - URL для загрузки маршрутов
     * @returns {Promise<Array>} Массив маршрутов
     */
    async function fetchRoutes(routesUrl) {
        try {
            // Пытаемся получить данные из кэша WordPress
            const cachedData = await fetch('/wp-json/custom-routes/v1/routes');
            if (cachedData.ok) {
                const data = await cachedData.json();
                console.log('Routes loaded from cache.');
                return data;
            } else {
                console.log('Cache not found, fetching routes from file.');
                // Если данных нет в кэше, получаем их из файла и сохраняем в кэш
                const response = await fetch(routesUrl);
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                await cacheRoutes(data); // Сохраняем данные в кэш
                return data;
            }
        } catch (error) {
            console.error('Error fetching routes:', error);
            return [];
        }
    }

    /**
     * Сохранение данных о маршрутах в кэш WordPress
     * @param {Array} routes - Массив маршрутов для кэширования
     * @returns {Promise<Response>} Ответ от сервера
     */
    async function cacheRoutes(routes) {
        try {
            const response = await fetch('/wp-json/custom-routes/v1/routes', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(routes) 
            });
            if (response.ok) {
                console.log('Routes cached successfully.');
            } else {
                console.error('Error caching routes:', response.status);
            }
            return response;
        } catch (error) {
            console.error('Error caching routes:', error);
            throw error;
        }
    }

    /**
     * Инициализация карты для конкретного маршрута
     * @param {HTMLElement} container - Контейнер для карты
     * @param {Object} route - Объект маршрута
     * @param {string} markerImageUrl - URL изображения маркера
     */
    async function initializeMap(container, route, markerImageUrl) {
        container.style.width = '100%';
        container.style.height = '400px';

        // Инициализация карты
        const map = new mapboxgl.Map({
            container: container.id,
            style: 'mapbox://styles/mapbox/streets-v11',
            center: route.coordinates[0], // Устанавливаем центр на начало маршрута
            zoom: 8
        });

        window.mapInstances[container.id] = map; // Сохраняем экземпляр карты

        // Настройка языка карты в зависимости от языка браузера пользователя
        const userLanguage = navigator.language || navigator.userLanguage || 'en';
        const supportedLanguages = ['en', 'ru'];
        const defaultLanguage = supportedLanguages.includes(userLanguage) ? userLanguage : 'en';

        // Убедитесь, что язык поддерживается
        const language = supportedLanguages.includes(userLanguage) ? userLanguage : defaultLanguage;

        map.addControl(new MapboxLanguage({ defaultLanguage: language }));

        // Добавление маршрута на карту при загрузке карты
        map.on('load', () => {
            addRoute(map, route);
        });

        // Обновление маршрута при изменении стиля карты
        map.on('styledata', () => {
            addRoute(map, route);
        });

        // Обработка ошибок карты
        map.on('error', e => console.error('Mapbox error:', e));
    }

    /**
     * Добавление маршрута на карту
     * @param {mapboxgl.Map} map - Экземпляр карты
     * @param {Object} route - Объект маршрута
     */
    async function addRoute(map, route) {
        try {
            const routeData = await fetchRouteData(route.coordinates);
            const { id } = route;
            const sourceId = `route${id}`;
    
            if (!map.getSource(sourceId)) {
                map.addSource(sourceId, {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: {},
                        geometry: {
                            type: 'LineString',
                            coordinates: routeData
                        }
                    }
                });
    
                map.addLayer({
                    id: sourceId,
                    type: 'line',
                    source: sourceId,
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': '#FF0000',
                        'line-width': 6
                    }
                });
            } else {
                const source = map.getSource(sourceId);
                source.setData({
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: routeData
                    }
                });
            }
    
            addMarker(map, route, config.markerImageUrl);
            map.resize();
        } catch (error) {
            console.error(`Error adding route ${route.id}:`, error);
        }
    }

    /**
     * Добавление маркера на карту
     * @param {mapboxgl.Map} map - Экземпляр карты
     * @param {Object} route - Объект маршрута
     * @param {string} markerImageUrl - URL изображения маркера
     */
    function addMarker(map, route, markerImageUrl) {
        const markerElement = document.createElement('div');
        markerElement.className = 'custom-marker';
        markerElement.style.backgroundImage = `url(${markerImageUrl})`; // Ссылка на свой маркер карты
        markerElement.style.width = '30px';
        markerElement.style.height = '30px';
        markerElement.style.backgroundSize = '100%';

        new mapboxgl.Marker(markerElement)
            .setLngLat(route.coordinates[route.coordinates.length - 1])
            .addTo(map);
    }

    /**
     * Получение данных маршрута с Mapbox Directions API
     * @param {Array} coordinates - Массив координат маршрута
     * @returns {Promise<Array>} Массив координат маршрута в формате GeoJSON
     */
    async function fetchRouteData(coordinates) {
        const key = `route_${coordinates.join('_')}`;
        const cachedData = localStorage.getItem(key);
    
        if (cachedData) {
            console.log('Route data loaded from local storage.');
            return JSON.parse(cachedData);
        } else {
            const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates.map(coord => coord.join(',')).join(';')}?geometries=geojson&access_token=${mapboxgl.accessToken}`;
    
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                if (data.routes && data.routes.length > 0) {
                    const routeCoordinates = data.routes[0].geometry.coordinates;
                    localStorage.setItem(key, JSON.stringify(routeCoordinates));
                    return routeCoordinates;
                } else {
                    throw new Error('No routes found');
                }
            } catch (error) {
                console.error('Error fetching route data:', error);
                return [];
            }
        }
    }

    // Обработчик события для аккордеона с задержкой
    $('.collapse').on('shown.bs.collapse', function () {
        const $maps = $(this).find('.map'); // Находим карты внутри вкладки
        setTimeout(() => {
            $maps.each(function() {
                const mapId = $(this).attr('id');
                const map = window.mapInstances[mapId];
                if (map) {
                    map.resize();
                }
            });
        }, 50); // Задержка в 50 миллисекунд
    });
};
