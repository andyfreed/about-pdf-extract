import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import pdfParse from 'pdf-parse';

interface ProcessCourseRequest {
  course_id: number;
  wordpress_url: string;
  api_key?: string;
}

/**
 * POST /api/process-course
 * Processes a course: fetches PDFs and extracts TOC
 */
export async function POST(request: NextRequest) {
  try {
    const body: ProcessCourseRequest = await request.json();
    const { course_id, wordpress_url, api_key } = body;

    if (!course_id || !wordpress_url) {
      return NextResponse.json(
        { error: 'course_id and wordpress_url are required' },
        { status: 400 }
      );
    }

    // Normalize WordPress URL
    const baseUrl = wordpress_url.replace(/\/$/, '');
    
    // Fetch course PDF information
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (api_key) {
      headers['X-API-Key'] = api_key;
    }

    const pdfsEndpoint = `${baseUrl}/wp-json/about-pdf-extract/v1/course-pdfs/${course_id}`;
    const pdfsResponse = await axios.get(pdfsEndpoint, { headers });

    const pdfs = pdfsResponse.data.pdfs;

    if (!pdfs.toc_pdf) {
      return NextResponse.json(
        { error: 'No TOC PDF found for this course' },
        { status: 404 }
      );
    }

    // Download and process the TOC PDF
    const pdfResponse = await axios.get(pdfs.toc_pdf.url, {
      responseType: 'arraybuffer',
      headers,
    });

    const pdfBuffer = Buffer.from(pdfResponse.data);
    const pdfData = await pdfParse(pdfBuffer);

    // Extract TOC
    const tocHtml = extractTOCFromPDF(pdfData.text);

    return NextResponse.json({
      success: true,
      course_id,
      course_title: pdfsResponse.data.course_title,
      toc_html: tocHtml,
      pdfs: {
        toc_pdf: pdfs.toc_pdf,
        full_pdf: pdfs.full_pdf,
      },
      pdf_info: {
        pages: pdfData.numpages,
        title: pdfData.info?.Title || null,
        author: pdfData.info?.Author || null,
      },
    });
  } catch (error: any) {
    console.error('Error processing course:', error);
    
    if (error.response) {
      return NextResponse.json(
        { 
          error: 'API error', 
          message: error.response.data?.message || error.message,
          status: error.response.status 
        },
        { status: error.response.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process course', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Extract table of contents from PDF text
 * This function filters out front matter and extracts only the actual TOC section
 */
function extractTOCFromPDF(text: string): string {
  // Patterns to identify front matter and non-TOC content
  const frontMatterPatterns = [
    /credit\s*(hours?|amount|value)?/i,
    /governing\s+body/i,
    /board\s+number/i,
    /ceu\s*(credits?)?/i,
    /continuing\s+education/i,
    /instructions?\s+(for|on)/i,
    /how\s+to\s+(take|complete|use)/i,
    /requirements?/i,
    /prerequisites?/i,
    /course\s+description/i,
    /learning\s+objectives?/i,
    /objectives?/i,
    /overview/i,
    /introduction\s*$/i,
    /^\s*\d+\s*(credit|ceu|hour)/i,
    /^\s*#\s*\d+/i, // Governing body numbers like "#123"
  ];

  // Patterns that indicate the end of TOC section
  const tocEndPatterns = [
    /^introduction$/i,
    /^chapter\s+1\s*$/i,
    /^section\s+1\s*$/i,
    /^part\s+i\s*$/i,
    /^getting\s+started/i,
    /^how\s+to\s+use/i,
    /^instructions/i,
    /^course\s+information/i,
    /^overview/i,
  ];

  // Find the TOC section start
  const tocStartMatch = text.match(/(?:^|\n)\s*(?:Table\s+of\s+Contents|Contents|TABLE\s+OF\s+CONTENTS)\s*(?:\n|$)/i);
  if (!tocStartMatch) {
    return '<div class="toc-error">Unable to find "Table of Contents" heading in this PDF.</div>';
  }

  const tocStartIndex = tocStartMatch.index! + tocStartMatch[0].length;
  
  // Extract text starting from TOC heading, but limit to reasonable size
  // Look for where TOC likely ends (usually before Introduction or Chapter 1)
  let tocEndIndex = text.length;
  const textAfterTOC = text.substring(tocStartIndex);
  
  // Find potential end markers
  for (const pattern of tocEndPatterns) {
    const match = textAfterTOC.match(new RegExp(`\\n\\s*${pattern.source}\\s*(?:\\n|$)`, 'i'));
    if (match && match.index !== undefined) {
      tocEndIndex = Math.min(tocEndIndex, tocStartIndex + match.index);
    }
  }

  // If we found an end marker, use it; otherwise use a reasonable chunk (8000 chars)
  const tocSection = text.substring(tocStartIndex, Math.min(tocEndIndex, tocStartIndex + 8000));
  const lines = tocSection.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  const tocItems: Array<{ title: string; page: number; level: number }> = [];
  const tocPattern = /^(.+?)\s*[.\s]+\s*(\d+)$/;
  const numberedPattern = /^(\d+[.)]\s*)(.+?)\s*[.\s]+\s*(\d+)$/;
  const chapterPattern = /^(Chapter\s+\d+|Section\s+\d+|Part\s+[IVX\d]+|[IVX]+\.)\s*(.+?)\s*[.\s]+\s*(\d+)$/i;

  let foundFirstTOCItem = false;
  let consecutiveNonTOCLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip lines that are clearly front matter
    const isFrontMatter = frontMatterPatterns.some(pattern => pattern.test(line));
    if (isFrontMatter) {
      continue;
    }

    // Skip lines that are too short or look like metadata
    if (line.length < 3 || line.match(/^[#\d\s\-\.]+$/)) {
      continue;
    }

    // Stop if we hit content that's clearly not TOC
    const isTOCEnd = tocEndPatterns.some(pattern => pattern.test(line));
    if (isTOCEnd && foundFirstTOCItem) {
      break;
    }

    let matched = false;
    
    // Try numbered pattern first (most specific)
    let match = line.match(numberedPattern);
    if (match) {
      const level = match[1].split('.').length;
      const title = match[2].trim();
      const page = parseInt(match[3], 10);
      
      // Validate it's a real TOC item
      if (page > 0 && page < 1000 && title.length > 2 && !frontMatterPatterns.some(p => p.test(title))) {
        tocItems.push({ title, page, level });
        foundFirstTOCItem = true;
        consecutiveNonTOCLines = 0;
        matched = true;
      }
    }

    if (!matched) {
      // Try chapter pattern
      match = line.match(chapterPattern);
      if (match) {
        const title = match[2].trim();
        const page = parseInt(match[3], 10);
        
        if (page > 0 && page < 1000 && title.length > 2 && !frontMatterPatterns.some(p => p.test(title))) {
          tocItems.push({ title, page, level: 1 });
          foundFirstTOCItem = true;
          consecutiveNonTOCLines = 0;
          matched = true;
        }
      }
    }

    if (!matched) {
      // Try general TOC pattern (title ... page)
      match = line.match(tocPattern);
      if (match) {
        const title = match[1].trim();
        const page = parseInt(match[2], 10);
        
        // Validate it's a real TOC item
        if (page > 0 && page < 1000 && 
            title.length > 2 && title.length < 150 &&
            !frontMatterPatterns.some(p => p.test(title)) &&
            !title.match(/^(Page|P\.|P\s*\d+)/i)) {
          
          // Heuristic: if title starts with common TOC prefixes, it's likely a TOC item
          if (title.match(/^(Chapter|Section|Part|Unit|Module|Lesson|\d+[.)])/i) || 
              (title.length > 3 && title.length < 100)) {
            // Determine level by indentation or numbering
            const level = title.match(/^\d+\.\d+\.\d+/) ? 3 :
                         title.match(/^\d+\.\d+/) ? 2 : 1;
            tocItems.push({ title, page, level });
            foundFirstTOCItem = true;
            consecutiveNonTOCLines = 0;
            matched = true;
          }
        }
      }
    }

    // If we haven't matched and we've already found TOC items, count non-TOC lines
    if (!matched && foundFirstTOCItem) {
      consecutiveNonTOCLines++;
      // If we hit 5+ consecutive non-TOC lines after finding TOC items, we're probably done
      if (consecutiveNonTOCLines >= 5) {
        break;
      }
    }
  }

  // Filter out any remaining front matter that might have slipped through
  const filteredItems = tocItems.filter(item => {
    const titleLower = item.title.toLowerCase();
    return !frontMatterPatterns.some(pattern => pattern.test(item.title)) &&
           !titleLower.match(/^(credit|ceu|hour|governing|board|instruction|requirement|prerequisite|objective|overview)/i) &&
           item.title.length > 2;
  });

  if (filteredItems.length > 0) {
    return formatTOCAsHTML(filteredItems);
  }

  return '<div class="toc-error">Unable to extract table of contents from this PDF. The TOC section may be in an image format or have an unusual structure.</div>';
}

function formatTOCAsHTML(items: Array<{ title: string; page: number; level: number }>): string {
  let html = '<div class="table-of-contents">\n';
  html += '<h2>Table of Contents</h2>\n';
  html += '<ul class="toc-list">\n';

  let currentLevel = 0;
  const openLists: string[] = [];

  for (const item of items) {
    while (currentLevel >= item.level && openLists.length > 0) {
      html += '</ul>\n';
      openLists.pop();
      currentLevel--;
    }

    while (currentLevel < item.level - 1) {
      html += '<ul class="toc-sublist">\n';
      openLists.push('ul');
      currentLevel++;
    }

    const indentClass = item.level > 1 ? ` toc-level-${item.level}` : '';
    html += `<li class="toc-item${indentClass}">\n`;
    html += `  <span class="toc-title">${escapeHtml(item.title)}</span>\n`;
    html += `  <span class="toc-page">${item.page}</span>\n`;
    html += '</li>\n';

    currentLevel = item.level;
  }

  while (openLists.length > 0) {
    html += '</ul>\n';
    openLists.pop();
  }

  html += '</ul>\n';
  html += '</div>\n';

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
