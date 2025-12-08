# About PDF Extract

A WordPress plugin and Vercel-hosted application for extracting table of contents from course PDFs.

## Overview

This project consists of two main components:

1. **WordPress Plugin** - Provides REST API endpoints to:
   - List active courses (excluding archived ones)
   - Retrieve PDF file URLs associated with courses
   - Supports WP Pusher for deployment

2. **Vercel App** - A Next.js application that:
   - Fetches active courses from WordPress
   - Downloads and processes PDF files
   - Extracts table of contents from PDFs
   - Converts TOC to nicely formatted HTML

## WordPress Plugin Installation

### Via WP Pusher

1. Install the [WP Pusher plugin](https://wppusher.com/) in your WordPress site
2. Connect your GitHub account
3. Add this repository: `https://github.com/andyfreed/about-pdf-extract.git`
4. Select the `wordpress-plugin` folder as the plugin directory
5. Activate the plugin in WordPress

### Manual Installation

1. Upload the `wordpress-plugin` folder to `/wp-content/plugins/`
2. Rename it to `about-pdf-extract`
3. Activate the plugin through the WordPress admin panel

## WordPress Plugin Configuration

The plugin exposes two REST API endpoints:

### GET `/wp-json/about-pdf-extract/v1/active-courses`

Returns a list of active courses (excluding archived ones).

**Query Parameters:**
- `include_all` (optional): Set to `true` to include archived courses

**Headers:**
- `X-API-Key` (optional): API key for authentication

**Response:**
```json
[
  {
    "id": 123,
    "title": "Course Title",
    "slug": "course-slug",
    "permalink": "https://example.com/course/course-slug",
    "product_id": "456",
    "product_sku": "COURSE-001",
    "product_price": "99.00"
  }
]
```

### GET `/wp-json/about-pdf-extract/v1/course-pdfs/{id}`

Returns PDF file information for a specific course.

**Path Parameters:**
- `id` (required): Course post ID

**Headers:**
- `X-API-Key` (optional): API key for authentication

**Response:**
```json
{
  "course_id": 123,
  "course_title": "Course Title",
  "pdfs": {
    "toc_pdf": {
      "id": 789,
      "url": "https://example.com/wp-content/uploads/toc.pdf",
      "filename": "toc.pdf"
    },
    "full_pdf": {
      "id": 790,
      "url": "https://example.com/wp-content/uploads/full.pdf",
      "filename": "full.pdf"
    }
  }
}
```

## PDF Detection Logic

The plugin looks for PDFs in the following order:

1. **Meta Keys**: Checks for `toc_pdf_id` and `full_pdf_id` (or `table_of_contents_pdf` and `course_pdf`)
2. **Attached Files**: Searches for PDF attachments to the course post
3. **Filename Patterns**: Identifies TOC PDFs by filename patterns (toc, table of contents, contents, summary)
4. **Order Fallback**: If two PDFs are found, the first is assumed to be TOC, the second is the full PDF

## Vercel App Setup

### Prerequisites

- Node.js 18+ installed
- A Vercel account

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/andyfreed/about-pdf-extract.git
cd about-pdf-extract
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Vercel will automatically detect Next.js and configure the build
4. Deploy!

The app will be available at `https://your-app.vercel.app`

## Vercel App API Endpoints

### GET `/api/courses`

Fetches active courses from WordPress.

**Query Parameters:**
- `wordpress_url` (required): Your WordPress site URL
- `api_key` (optional): API key for WordPress authentication

### GET `/api/courses/[id]/pdfs`

Fetches PDF information for a specific course.

**Path Parameters:**
- `id` (required): Course ID

**Query Parameters:**
- `wordpress_url` (required): Your WordPress site URL
- `api_key` (optional): API key for WordPress authentication

### POST `/api/extract-toc`

Extracts table of contents from a PDF URL.

**Request Body:**
```json
{
  "pdf_url": "https://example.com/toc.pdf",
  "wordpress_url": "https://yoursite.com",
  "api_key": "optional-api-key"
}
```

### POST `/api/process-course`

Processes a course: fetches PDFs and extracts TOC in one call.

**Request Body:**
```json
{
  "course_id": 123,
  "wordpress_url": "https://yoursite.com",
  "api_key": "optional-api-key"
}
```

## How It Works

1. **Active Course Detection**: The plugin follows the logic in `ACTIVE_COURSES_LOGIC.md`:
   - Fetches published `flms-courses` posts
   - Excludes courses with `bhfe_archived_from_course_versions === '1'` or `bhfe_archived_course === '1'`
   - Handles version logic with `flms_course_active_version` meta

2. **PDF Processing**: 
   - Downloads the TOC PDF from WordPress
   - Uses `pdf-parse` to extract text content
   - Identifies TOC patterns (numbered items, chapter headings, etc.)
   - Formats as structured HTML with CSS styling

3. **TOC Extraction Patterns**:
   - Numbered items: `1. Title ... 5`
   - Chapter patterns: `Chapter 1 Title ... 5`
   - General TOC: `Title ... 5`
   - Handles nested hierarchies (1.1, 1.2, etc.)

## Project Structure

```
about-pdf-extract/
├── wordpress-plugin/          # WordPress plugin files
│   ├── about-pdf-extract.php  # Main plugin file
│   └── readme.txt             # Plugin readme
├── app/                       # Next.js app directory
│   ├── api/                   # API routes
│   │   ├── courses/           # Course endpoints
│   │   ├── extract-toc/       # TOC extraction
│   │   └── process-course/    # Full course processing
│   ├── page.tsx               # Main UI
│   └── layout.tsx             # App layout
├── ACTIVE_COURSES_LOGIC.md    # Documentation on active course logic
├── package.json               # Node.js dependencies
├── tsconfig.json             # TypeScript configuration
├── next.config.js            # Next.js configuration
├── vercel.json               # Vercel configuration
└── README.md                 # This file
```

## Troubleshooting

### No PDFs Found

- Check that PDFs are attached to the course post or set in meta fields
- Verify PDF file permissions are accessible
- Check WordPress media library for PDF attachments

### TOC Not Extracting

- The PDF may not have a structured text-based TOC
- Some PDFs have TOCs as images, which can't be extracted
- Try opening the PDF in a text editor to verify it has extractable text

### API Authentication Issues

- Verify the API key matches what's configured in WordPress
- Check that the `X-API-Key` header is being sent correctly
- If no API key is set, the endpoints are open (consider setting one for security)

## License

GPL v2 or later

## Support

For issues or questions, please open an issue on GitHub.
