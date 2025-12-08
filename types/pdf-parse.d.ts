declare module 'pdf-parse' {
  interface PDFInfo {
    Title?: string;
    Author?: string;
    Subject?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
    ModDate?: string;
  }

  interface PDFData {
    numpages: number;
    numrender: number;
    info: PDFInfo | null;
    metadata: any | null;
    text: string;
    version: string;
  }

  function pdfParse(data: Buffer, options?: any): Promise<PDFData>;
  export = pdfParse;
}
