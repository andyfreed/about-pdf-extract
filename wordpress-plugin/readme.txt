=== About PDF Extract ===
Contributors: andyfreed
Tags: courses, pdf, woocommerce
Requires at least: 5.0
Tested up to: 6.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

WordPress plugin for extracting table of contents from course PDFs.

== Description ==

This plugin provides REST API endpoints for:
* Getting active courses (flms-courses post type)
* Retrieving PDF file URLs associated with courses
* Supporting integration with external PDF processing services

== Installation ==

1. Upload the plugin files to the `/wp-content/plugins/about-pdf-extract` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Optionally set an API key in the plugin settings (if you want to secure the endpoints).

== API Endpoints ==

= GET /wp-json/about-pdf-extract/v1/active-courses =

Returns a list of active courses.

Parameters:
* include_all (optional): Set to 'true' to include archived courses

Headers:
* X-API-Key (optional): API key for authentication

= GET /wp-json/about-pdf-extract/v1/course-pdfs/{id} =

Returns PDF file information for a specific course.

Parameters:
* id (required): Course post ID

Headers:
* X-API-Key (optional): API key for authentication

== Changelog ==

= 1.0.0 =
* Initial release
