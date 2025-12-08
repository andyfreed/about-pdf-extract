<?php
/**
 * Plugin Name: About PDF Extract
 * Plugin URI: https://github.com/andyfreed/about-pdf-extract
 * Description: WordPress plugin for extracting table of contents from course PDFs
 * Version: 1.0.0
 * Author: Andy Freed
 * Author URI: https://github.com/andyfreed
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: about-pdf-extract
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class About_PDF_Extract {
    
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_rest_routes'));
    }
    
    /**
     * Register REST API routes
     */
    public function register_rest_routes() {
        register_rest_route('about-pdf-extract/v1', '/active-courses', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_active_courses'),
            'permission_callback' => array($this, 'check_api_permission'),
        ));
        
        register_rest_route('about-pdf-extract/v1', '/course-pdfs/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_course_pdfs'),
            'permission_callback' => array($this, 'check_api_permission'),
            'args' => array(
                'id' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_numeric($param);
                    }
                ),
            ),
        ));
    }
    
    /**
     * Check API permission (optional API key support)
     */
    public function check_api_permission($request) {
        // Allow if API key matches or if no API key is required
        $api_key = $request->get_header('X-API-Key');
        $stored_key = get_option('about_pdf_extract_api_key', '');
        
        // If no key is set, allow all requests
        if (empty($stored_key)) {
            return true;
        }
        
        // If key is set, require it to match
        return !empty($api_key) && $api_key === $stored_key;
    }
    
    /**
     * Get active courses
     */
    public function get_active_courses($request) {
        $include_all = $request->get_param('include_all') === 'true';
        
        $args = array(
            'post_type' => 'flms-courses',
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'meta_query' => array(),
        );
        
        $courses = get_posts($args);
        $active_courses = array();
        
        foreach ($courses as $course) {
            // Check archive flags
            $archived_from_versions = get_post_meta($course->ID, 'bhfe_archived_from_course_versions', true);
            $archived_course = get_post_meta($course->ID, 'bhfe_archived_course', true);
            
            // Exclude archived courses unless include_all is true
            if (!$include_all) {
                if ($archived_from_versions === '1' || $archived_course === '1') {
                    continue;
                }
            }
            
            // Handle version logic
            $active_version = get_post_meta($course->ID, 'flms_course_active_version', true);
            $version_content = get_post_meta($course->ID, 'flms_version_content', true);
            
            // If active version is set, include the course
            if (!empty($active_version)) {
                $active_courses[] = $this->format_course_data($course);
                continue;
            }
            
            // If no version data exists, assume active for backward compatibility
            if (empty($version_content)) {
                $active_courses[] = $this->format_course_data($course);
                continue;
            }
            
            // Check if all versions are archived
            $versions = is_array($version_content) ? $version_content : array();
            $all_archived = true;
            foreach ($versions as $version) {
                if (isset($version['is_archived']) && $version['is_archived'] !== true) {
                    $all_archived = false;
                    break;
                }
            }
            
            // If all versions are archived but active version is set, include it
            if ($all_archived && !empty($active_version)) {
                $active_courses[] = $this->format_course_data($course);
                continue;
            }
            
            // If not all archived, include it
            if (!$all_archived) {
                $active_courses[] = $this->format_course_data($course);
            }
        }
        
        return rest_ensure_response($active_courses);
    }
    
    /**
     * Format course data for API response
     */
    private function format_course_data($course) {
        $product_id = get_post_meta($course->ID, '_product_id', true);
        if (empty($product_id)) {
            // Try alternative meta keys
            $product_id = get_post_meta($course->ID, 'product_id', true);
        }
        
        $product = null;
        if (!empty($product_id) && function_exists('wc_get_product')) {
            $product = wc_get_product($product_id);
        }
        
        return array(
            'id' => $course->ID,
            'title' => html_entity_decode(get_the_title($course->ID), ENT_QUOTES, 'UTF-8'),
            'slug' => $course->post_name,
            'permalink' => get_permalink($course->ID),
            'excerpt' => get_the_excerpt($course->ID),
            'content' => apply_filters('the_content', $course->post_content),
            'product_id' => $product_id,
            'product_sku' => $product ? $product->get_sku() : null,
            'product_price' => $product ? $product->get_price() : null,
            'updated_at' => get_post_modified_time('c', false, $course->ID),
            'created_at' => get_post_time('c', false, $course->ID),
        );
    }
    
    /**
     * Get PDF files for a specific course
     */
    public function get_course_pdfs($request) {
        $course_id = intval($request->get_param('id'));
        
        if (!$course_id) {
            return new WP_Error('invalid_course_id', 'Invalid course ID', array('status' => 400));
        }
        
        $course = get_post($course_id);
        if (!$course || $course->post_type !== 'flms-courses') {
            return new WP_Error('course_not_found', 'Course not found', array('status' => 404));
        }
        
        // Get PDF attachments for this course
        // Look for PDFs in post meta or attached files
        $pdfs = $this->get_course_pdf_files($course_id);
        
        return rest_ensure_response(array(
            'course_id' => $course_id,
            'course_title' => get_the_title($course_id),
            'pdfs' => $pdfs,
        ));
    }
    
    /**
     * Get PDF files associated with a course
     * This looks for PDFs in various common locations
     */
    private function get_course_pdf_files($course_id) {
        $pdfs = array(
            'toc_pdf' => null,
            'full_pdf' => null,
        );
        
        // Method 1: Check for specific meta keys
        $toc_pdf_id = get_post_meta($course_id, 'toc_pdf_id', true);
        $full_pdf_id = get_post_meta($course_id, 'full_pdf_id', true);
        
        // Alternative meta key names
        if (empty($toc_pdf_id)) {
            $toc_pdf_id = get_post_meta($course_id, 'table_of_contents_pdf', true);
        }
        if (empty($full_pdf_id)) {
            $full_pdf_id = get_post_meta($course_id, 'course_pdf', true);
        }
        
        // Get file URLs if IDs are found
        if (!empty($toc_pdf_id)) {
            $toc_url = wp_get_attachment_url($toc_pdf_id);
            if ($toc_url) {
                $pdfs['toc_pdf'] = array(
                    'id' => $toc_pdf_id,
                    'url' => $toc_url,
                    'filename' => basename($toc_url),
                );
            }
        }
        
        if (!empty($full_pdf_id)) {
            $full_url = wp_get_attachment_url($full_pdf_id);
            if ($full_url) {
                $pdfs['full_pdf'] = array(
                    'id' => $full_pdf_id,
                    'url' => $full_url,
                    'filename' => basename($full_url),
                );
            }
        }
        
        // Method 2: Search for attached PDFs if meta keys don't exist
        if (empty($pdfs['toc_pdf']) || empty($pdfs['full_pdf'])) {
            $attachments = get_attached_media('application/pdf', $course_id);
            
            if (!empty($attachments)) {
                $attachment_array = array_values($attachments);
                
                // Try to identify TOC vs Full PDF by filename
                foreach ($attachment_array as $attachment) {
                    $filename = basename(get_attached_file($attachment->ID));
                    $url = wp_get_attachment_url($attachment->ID);
                    
                    // Common patterns for TOC PDFs
                    if (preg_match('/toc|table.?of.?contents|contents|summary/i', $filename)) {
                        if (empty($pdfs['toc_pdf'])) {
                            $pdfs['toc_pdf'] = array(
                                'id' => $attachment->ID,
                                'url' => $url,
                                'filename' => $filename,
                            );
                        }
                    } else {
                        // Assume it's the full PDF if we don't have one yet
                        if (empty($pdfs['full_pdf'])) {
                            $pdfs['full_pdf'] = array(
                                'id' => $attachment->ID,
                                'url' => $url,
                                'filename' => $filename,
                            );
                        }
                    }
                }
                
                // If we still don't have both, assign by order (first = TOC, second = Full)
                if (empty($pdfs['toc_pdf']) && !empty($attachment_array[0])) {
                    $url = wp_get_attachment_url($attachment_array[0]->ID);
                    $pdfs['toc_pdf'] = array(
                        'id' => $attachment_array[0]->ID,
                        'url' => $url,
                        'filename' => basename(get_attached_file($attachment_array[0]->ID)),
                    );
                }
                
                if (empty($pdfs['full_pdf']) && !empty($attachment_array[1])) {
                    $url = wp_get_attachment_url($attachment_array[1]->ID);
                    $pdfs['full_pdf'] = array(
                        'id' => $attachment_array[1]->ID,
                        'url' => $url,
                        'filename' => basename(get_attached_file($attachment_array[1]->ID)),
                    );
                }
            }
        }
        
        return $pdfs;
    }
}

// Initialize the plugin
new About_PDF_Extract();
