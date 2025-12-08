import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

interface Course {
  id: number;
  title: string;
  slug: string;
  permalink: string;
  product_id?: string;
}

/**
 * GET /api/courses
 * Fetches active courses from WordPress
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const wordpressUrl = searchParams.get('wordpress_url');
    const apiKey = searchParams.get('api_key');

    if (!wordpressUrl) {
      return NextResponse.json(
        { error: 'wordpress_url parameter is required' },
        { status: 400 }
      );
    }

    // Normalize WordPress URL (remove trailing slash)
    const baseUrl = wordpressUrl.replace(/\/$/, '');
    const endpoint = `${baseUrl}/wp-json/about-pdf-extract/v1/active-courses`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const response = await axios.get<Course[]>(endpoint, { headers });

    return NextResponse.json({
      success: true,
      courses: response.data,
      count: response.data.length,
    });
  } catch (error: any) {
    console.error('Error fetching courses:', error);
    
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
      { error: 'Failed to fetch courses', message: error.message },
      { status: 500 }
    );
  }
}
