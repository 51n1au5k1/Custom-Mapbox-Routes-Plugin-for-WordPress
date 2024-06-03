<?php
// Положите этот файл `enqueue-scripts.php` в директорию вашей темы: `/wp-content/themes/THEME_NAME/inc/enqueue-scripts.php`
// Подключаем стили и скрипты для карты
add_action('wp_enqueue_scripts', 'enqueue_mapbox_scripts');

function enqueue_mapbox_scripts() {
    if (is_page() && strpos($_SERVER['REQUEST_URI'], '/contacts/scheme') !== false) {
        wp_enqueue_style('mapbox-gl-css', 'https://api.mapbox.com/mapbox-gl-js/v2.11.0/mapbox-gl.css');
        wp_enqueue_script('mapbox-gl-js', 'https://api.mapbox.com/mapbox-gl-js/v2.11.0/mapbox-gl.js', [], null, true);
        wp_enqueue_script('mapbox-gl-language', 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-language/v1.0.0/mapbox-gl-language.js', ['mapbox-gl-js'], null, true);
        wp_enqueue_script('custom-mapbox-js', get_template_directory_uri() . '/js/custom-mapbox.js', ['mapbox-gl-js', 'mapbox-gl-language'], null, true);
    }
}

// Регистрируем REST API endpoints
add_action('rest_api_init', function () {
    register_rest_route('custom-routes/v1', '/routes', array(
        'methods' => 'GET',
        'callback' => function () {
            $routes = get_transient('mapbox_routes'); // Получаем данные из transient API
            if ($routes) {
                return rest_ensure_response($routes);
            } else {
                return new WP_Error('no_routes_found', 'Routes not found in cache.', array('status' => 404));
            }
        }
    ));

    register_rest_route('custom-routes/v1', '/routes', array(
        'methods' => 'POST',
        'callback' => function (WP_REST_Request $request) {
            $routes = $request->get_json_params();
            if (empty($routes)) {
                return new WP_Error('no_routes', 'No routes provided.', array('status' => 400));
            }
            set_transient('mapbox_routes', $routes, MONTH_IN_SECONDS); // Кэшируем данные на 1 месяц
            return rest_ensure_response(array('message' => 'Routes cached successfully.'));
        },
        'permission_callback' => '__return_true' // Разрешаем всем пользователям
    ));
});
