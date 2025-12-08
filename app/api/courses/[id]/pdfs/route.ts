import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

interface CoursePDFs {
  course_id: number;
  course_title: string;
  pdfs: {
    toc_pdf: {
      id: number;
      url: string;
      filename: string;
    } | null;
    full_pdf: {
      id: number;
      url: string;
      filename: string;
    } | null;
  };
}

/**
 * GET /api/courses/[id]/pdfs
 * Fetches PDF file information for a specific course
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const courseId = params.id;
    const searchParams = request.nextUrl.searchParams;
    const wordpressUrl = searchParams.get('wordpress_url');
    const apiKey = searchParams.get('api_key');

    if (!wordpressUrl) {
      return NextResponse.json(
        { error: 'wordpress_url parameter is required' },
        { status: 400 }
      );
    }

    if (!courseId) {
      return NextResponse.json(
        { error: 'Course ID is required' },
        { status: 400 }
      );
    }

    // Normalize WordPress URL (remove trailing slash)
    const baseUrl = wordpressUrl.replace(/\/$/, '');
    const endpoint = `${baseUrl}/wp-json/about-pdf-extract/v1/course-pdfs/${courseId}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const response = await axios.get<CoursePDFs>(endpoint, { headers });

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error('Error fetching course PDFs:', error);
    
    if (error.response) {
      return NextResponse.json(
        { 
          error: 'WordPress API error', 
          message: error.response.data?.message || error.message,
          status: error.response.status 
        },
        { status: error.response.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch course PDFs', message: error.message },
      { status: 500 }
    );
  }
}
