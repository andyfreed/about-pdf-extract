import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import pdfParse from 'pdf-parse';

interface ExtractTOCRequest {
  pdf_url: string;
  wordpress_url?: string;
  api_key?: string;
}

/**
 * POST /api/extract-toc
 * Extracts table of contents from a PDF and converts it to HTML
 */
export async function POST(request: NextRequest) {
  try {
    const body: ExtractTOCRequest = await request.json();
    const { pdf_url, wordpress_url, api_key } = body;

    if (!pdf_url) {
      return NextResponse.json(
        { error: 'pdf_url is required' },
        { status: 400 }
      );
    }

    // Download the PDF
    const headers: Record<string, string> = {};
    if (api_key) {
      headers['X-API-Key'] = api_key;
    }

    const pdfResponse = await axios.get(pdf_url, {
      responseType: 'arraybuffer',
      headers,
    });

    const pdfBuffer = Buffer.from(pdfResponse.data);

    // Parse the PDF
    const pdfData = await pdfParse(pdfBuffer);

    // Extract table of contents
    const tocHtml = extractTOCFromPDF(pdfData.text);

    return NextResponse.json({
      success: true,
      toc_html: tocHtml,
      pdf_info: {
        pages: pdfData.numpages,
        title: pdfData.info?.Title || null,
        author: pdfData.info?.Author || null,
      },
    });
  } catch (error: any) {
    console.error('Error extracting TOC:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to extract TOC', 
        message: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Extract table of contents from PDF text
 * This function looks for common TOC patterns and formats them as HTML
 */
function extractTOCFromPDF(text: string): string {
  // Split text into lines
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // Common TOC patterns:
  // 1. Lines with page numbers at the end (e.g., "Chapter 1 ................ 5")
  // 2. Lines with dots/leaders before page numbers
  // 3. Numbered items (1., 2., etc.)
  // 4. Chapter/Section headings

  const tocItems: Array<{ title: string; page: number; level: number }> = [];
  const tocPattern = /^(.+?)\s*[.\s]+\s*(\d+)$/;
  const numberedPattern = /^(\d+[.)]\s*)(.+?)\s*[.\s]+\s*(\d+)$/;
  const chapterPattern = /^(Chapter\s+\d+|Section\s+\d+|[IVX]+\.)\s*(.+?)\s*[.\s]+\s*(\d+)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Try numbered pattern first (most specific)
    let match = line.match(numberedPattern);
    if (match) {
      const level = match[1].split('.').length;
      const title = match[2].trim();
      const page = parseInt(match[3], 10);
      tocItems.push({ title, page, level });
      continue;
    }

    // Try chapter pattern
    match = line.match(chapterPattern);
    if (match) {
      const title = match[2].trim();
      const page = parseInt(match[3], 10);
      tocItems.push({ title, page, level: 1 });
      continue;
    }

    // Try general TOC pattern (title ... page)
    match = line.match(tocPattern);
    if (match) {
      const title = match[1].trim();
      const page = parseInt(match[2], 10);
      
      // Heuristic: if title starts with common TOC prefixes, it's likely a TOC item
      if (title.match(/^(Chapter|Section|Part|Unit|\d+[.)])/i) || 
          title.length > 3 && title.length < 100) {
        // Determine level by indentation or numbering
        const level = title.match(/^\d+\.\d+/) ? 2 : 
                     title.match(/^\d+\.\d+\.\d+/) ? 3 : 1;
        tocItems.push({ title, page, level });
      }
    }
  }

  // If we found TOC items, format them as HTML
  if (tocItems.length > 0) {
    return formatTOCAsHTML(tocItems);
  }

  // Fallback: try to find a TOC section in the text
  // Look for "Table of Contents" or "Contents" heading
  const tocStartIndex = text.search(/Table\s+of\s+Contents|Contents\s*$/i);
  if (tocStartIndex !== -1) {
    // Extract a reasonable chunk after TOC heading
    const tocSection = text.substring(tocStartIndex, tocStartIndex + 5000);
    const tocLines = tocSection.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    for (const line of tocLines) {
      const match = line.match(tocPattern);
      if (match) {
        const title = match[1].trim();
        const page = parseInt(match[2], 10);
        if (title.length > 2 && title.length < 150 && page > 0 && page < 1000) {
          const level = title.match(/^\d+\.\d+/) ? 2 : 
                       title.match(/^\d+\.\d+\.\d+/) ? 3 : 1;
          tocItems.push({ title, page, level });
        }
      }
    }

    if (tocItems.length > 0) {
      return formatTOCAsHTML(tocItems);
    }
  }

  // Last resort: return a message indicating TOC couldn't be extracted
  return '<div class="toc-error">Unable to automatically extract table of contents from this PDF. The PDF may not have a structured TOC, or it may be in an image format.</div>';
}

/**
 * Format TOC items as HTML
 */
function formatTOCAsHTML(items: Array<{ title: string; page: number; level: number }>): string {
  let html = '<div class="table-of-contents">\n';
  html += '<h2>Table of Contents</h2>\n';
  html += '<ul class="toc-list">\n';

  let currentLevel = 0;
  const openLists: string[] = [];

  for (const item of items) {
    // Close lists if we're going up in hierarchy
    while (currentLevel >= item.level && openLists.length > 0) {
      html += '</ul>\n';
      openLists.pop();
      currentLevel--;
    }

    // Open new nested lists if needed
    while (currentLevel < item.level - 1) {
      html += '<ul class="toc-sublist">\n';
      openLists.push('ul');
      currentLevel++;
    }

    // Add the item
    const indentClass = item.level > 1 ? ` toc-level-${item.level}` : '';
    html += `<li class="toc-item${indentClass}">\n`;
    html += `  <span class="toc-title">${escapeHtml(item.title)}</span>\n`;
    html += `  <span class="toc-page">${item.page}</span>\n`;
    html += '</li>\n';

    currentLevel = item.level;
  }

  // Close any remaining open lists
  while (openLists.length > 0) {
    html += '</ul>\n';
    openLists.pop();
  }

  html += '</ul>\n';
  html += '</div>\n';

  // Add CSS styles
  html += `
<style>
.table-of-contents {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.table-of-contents h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #1a1a1a;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 10px;
}

.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.toc-item:last-child {
  border-bottom: none;
}

.toc-title {
  flex: 1;
  margin-right: 20px;
}

.toc-page {
  color: #666;
  font-weight: 500;
  white-space: nowrap;
}

.toc-sublist {
  list-style: none;
  padding-left: 30px;
  margin: 5px 0;
}

.toc-level-2 .toc-title {
  font-weight: 500;
}

.toc-level-3 .toc-title {
  font-weight: 400;
  font-size: 0.95em;
}

.toc-item:hover {
  background-color: #f9f9f9;
  padding-left: 10px;
  padding-right: 10px;
  margin-left: -10px;
  margin-right: -10px;
  border-radius: 4px;
}

.toc-error {
  padding: 20px;
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  color: #856404;
}
</style>
`;

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
