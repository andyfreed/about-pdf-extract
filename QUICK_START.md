# Quick Start Guide

## WordPress Plugin Setup (via WP Pusher)

1. **Install WP Pusher** in your WordPress site
   - Go to Plugins → Add New
   - Search for "WP Pusher"
   - Install and activate

2. **Connect to GitHub**
   - In WP Pusher settings, connect your GitHub account
   - Authorize the application

3. **Add the Plugin**
   - Click "Add Plugin"
   - Repository: `https://github.com/andyfreed/about-pdf-extract.git`
   - Branch: `main` (or your default branch)
   - **Important**: Set "Push to directory" to `wordpress-plugin`
   - Click "Add Plugin"

4. **Activate the Plugin**
   - Go to Plugins in WordPress admin
   - Find "About PDF Extract" and activate it

5. **Test the Endpoint**
   - Visit: `https://yoursite.com/wp-json/about-pdf-extract/v1/active-courses`
   - You should see a JSON array of active courses

## Vercel App Setup

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js
   - Click "Deploy"

3. **Access Your App**
   - Once deployed, visit your Vercel URL
   - Enter your WordPress URL
   - Click "Fetch Active Courses"

## Testing

### Test WordPress Plugin Endpoints

1. **Get Active Courses:**
   ```bash
   curl "https://yoursite.com/wp-json/about-pdf-extract/v1/active-courses"
   ```

2. **Get Course PDFs:**
   ```bash
   curl "https://yoursite.com/wp-json/about-pdf-extract/v1/course-pdfs/123"
   ```
   (Replace 123 with an actual course ID)

### Test Vercel App

1. Open your Vercel app URL
2. Enter your WordPress site URL
3. Click "Fetch Active Courses"
4. Click "Extract TOC" on any course
5. View the extracted table of contents

## Troubleshooting

### Plugin Not Showing Courses

- Verify courses are published and not archived
- Check that `flms-courses` post type exists
- Try adding `?include_all=true` to see all courses

### No PDFs Found

- Ensure PDFs are attached to course posts
- Check WordPress media library
- Verify PDF file permissions

### TOC Extraction Fails

- PDF may not have extractable text (could be scanned/image-based)
- Try opening PDF in a text editor to verify
- Some PDFs have TOCs as images, which can't be extracted

## Next Steps

- Set up API key authentication (optional but recommended)
- Customize TOC HTML styling
- Add batch processing for multiple courses
- Integrate with your course display pages
